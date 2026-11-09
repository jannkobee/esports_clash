<?php
namespace App\Services;
use App\Models\{TrellisGeneration,AvatarEvolutionSetting};
use App\Jobs\PollTrellisGeneration;
use Illuminate\Support\Facades\{DB,Http};
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class TrellisGenerationService
{
    public const ACTIVE=['queued','waiting_models','waiting_resources','waiting_worker','running'];
    public function catalog(?string $category = null): array
    {
        $avatars = app(AvatarEvolutionService::class)->catalog();
        foreach ($avatars as &$av) {
            $av['category'] = 'avatar';
            $av['category_label'] = 'Champions';
            $av['icon'] = '👑';
        }
        unset($av);

        $worldAssets = $this->worldCatalog();
        $combined = array_merge($avatars, $worldAssets);

        if ($category && $category !== 'all') {
            return array_values(array_filter($combined, fn($item) => ($item['category'] ?? 'avatar') === $category));
        }

        return $combined;
    }

    public function worldCatalog(): array
    {
        $path = resource_path('game/world-assets.json');
        if (!is_file($path)) return [];
        return json_decode(file_get_contents($path), true, flags: JSON_THROW_ON_ERROR)['assets'] ?? [];
    }
    private function referenceIndex(): array
    {
        $manifest=resource_path('avatars/generation-reference-index.json');
        return is_file($manifest)?json_decode(file_get_contents($manifest),true,flags:JSON_THROW_ON_ERROR):[];
    }
    private function referenceFile(array $reference): ?string
    {
        $name=$reference['file']??'';
        if(!is_string($name)||basename($name)!==$name||!str_ends_with($name,'.png'))return null;
        $path=resource_path('avatars/generation-references/'.$name);
        return is_file($path)?$path:null;
    }
    public function localReferences(): array
    {
        $result=[];
        foreach($this->referenceIndex()as $id=>$reference){
            if($path=$this->referenceFile($reference))$result[$id]=[...$reference,'sha256'=>hash_file('sha256',$path)];
        }
        $worldDir = resource_path('game/world-references');
        if (is_dir($worldDir)) {
            foreach (glob($worldDir . '/*.png') as $file) {
                $id = basename($file, '.png');
                $result[$id] = [
                    'file' => basename($file),
                    'sha256' => hash_file('sha256', $file),
                    'provider' => 'system-world',
                ];
            }
        }
        return $result;
    }
    public function references(?array $operations): array
    {
        $references = array_replace($this->localReferences(), $operations['references'] ?? []);
        foreach ($this->catalog() as $avatar) {
            $path = storage_path('app/avatars/references/'.$avatar['id'].'/current.json');
            $meta = is_file($path) ? json_decode(file_get_contents($path), true) : null;
            if ($meta['removed'] ?? false) unset($references[$avatar['id']]);
            elseif (!empty($meta['sha256']) && $this->localReference($avatar['id'], $meta['sha256'])) {
                $references[$avatar['id']] = [...$meta, 'provider' => 'owner-upload'];
            }
        }
        foreach ($references as $id => $reference) {
            if ($this->isLegacyConcept($reference)) unset($references[$id]);
        }
        return $references;
    }
    private function isLegacyConcept(array $reference): bool
    {
        return (bool)preg_match('/relaxed A stance|clearly attached equipment|near-frontal view/i', $reference['prompt'] ?? '');
    }
    public function localReference(string $avatar,string $digest): ?string
    {
        $customPath = storage_path('app/avatars/references/' . $avatar . '/' . $digest . '.png');
        if (is_file($customPath)) return $customPath;
        $currentPath = storage_path('app/avatars/references/' . $avatar . '/current.png');
        if (is_file($currentPath)) {
            $currentMeta = storage_path('app/avatars/references/' . $avatar . '/current.json');
            $metaSha = is_file($currentMeta) ? (json_decode(file_get_contents($currentMeta), true)['sha256'] ?? null) : null;
            if ($digest === $metaSha || hash_equals(hash_file('sha256', $currentPath), $digest)) return $currentPath;
        }

        $worldRef = resource_path('game/world-references/' . $avatar . '.png');
        if (is_file($worldRef) && hash_equals(hash_file('sha256', $worldRef), $digest)) return $worldRef;

        $reference=$this->referenceIndex()[$avatar]??null;
        $path=$reference?$this->referenceFile($reference):null;
        return $path&&hash_equals(hash_file('sha256',$path),$digest)?$path:null;
    }
    public function currentReference(string $avatar, ?array $operations = null): ?array
    {
        $refDir = storage_path('app/avatars/references/' . $avatar);
        $currentMeta = $refDir . '/current.json';
        if (is_file($currentMeta)) {
            $data = json_decode(file_get_contents($currentMeta), true) ?: [];
            if ($data['removed'] ?? false) return null;
            if (!empty($data['sha256']) && (is_file($refDir . '/current.png') || is_file($refDir . '/' . $data['sha256'] . '.png'))) {
                return [
                    'sha256' => $data['sha256'],
                    'provider' => 'owner-upload',
                    'is_custom' => true,
                    'is_legacy' => $this->isLegacyConcept($data),
                    'url' => route('trellis.reference', [$avatar, $data['sha256']]),
                ];
            }
        }
        $worldRef = resource_path('game/world-references/' . $avatar . '.png');
        if (is_file($worldRef)) {
            $sha = hash_file('sha256', $worldRef);
            return [
                'sha256' => $sha,
                'provider' => 'system-world',
                'is_custom' => false,
                'is_legacy' => false,
                'url' => route('trellis.reference', [$avatar, $sha]),
            ];
        }
        $ops = $operations ?? $this->operations();
        $ref = $ops['references'][$avatar] ?? $this->localReferences()[$avatar] ?? null;
        if ($ref) {
            return [
                'sha256' => $ref['sha256'] ?? '',
                'provider' => $ref['provider'] ?? 'system',
                'is_custom' => false,
                'is_legacy' => $this->isLegacyConcept($ref),
                'url' => route('trellis.reference', [$avatar, $ref['sha256']]),
            ];
        }
        return null;
    }
    public function saveReferenceAsset(string $avatarId, \Illuminate\Http\UploadedFile $file, ?string $prompt, string $actor): array
    {
        if (!collect($this->catalog())->contains('id', $avatarId)) {
            throw ValidationException::withMessages(['avatar_id' => 'Unknown avatar.']);
        }
        $dir = storage_path('app/avatars/references/' . $avatarId);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        $realPath = $file->getRealPath();
        $rawBytes = file_get_contents($realPath);
        $localSha = hash('sha256', $rawBytes);

        // Attempt forwarding to worker if configured/available
        $remoteSha = null;
        try {
            $response = $this->worker()->timeout(45)->post($this->endpoint('/references/' . $avatarId), [
                'png_base64' => base64_encode($rawBytes),
                'provider' => 'owner-upload',
                'prompt' => $prompt ?? '',
            ]);
            if ($response->successful()) {
                $remoteSha = $response->json('sha256');
            }
        } catch (\Throwable $e) {
            // Worker is optional or offline; local storage persists the reference
        }

        $sha256 = $remoteSha ?: $localSha;
        $filename = $sha256 . '.png';
        file_put_contents($dir . '/' . $filename, $rawBytes);
        file_put_contents($dir . '/current.png', $rawBytes);

        $meta = [
            'avatar_id' => $avatarId,
            'sha256' => $sha256,
            'filename' => $filename,
            'prompt' => $prompt,
            'updated_at' => now()->toIso8601String(),
        ];
        file_put_contents($dir . '/current.json', json_encode($meta, JSON_PRETTY_PRINT));

        app(EvolutionService::class)->audit($avatarId, 'trellis.reference-uploaded', $actor, [
            'avatar_id' => $avatarId,
            'sha256' => $sha256,
        ]);

        return $meta;
    }
    public function worker() { return Http::withToken(config('avatars.worker_token'))->timeout(10)->connectTimeout(3); }
    public function activeTrellisUrl(): string
    {
        if (app()->runningUnitTests()) {
            return config('avatars.trellis_url') ?? 'http://trellis-worker:8096';
        }
        $urls = array_unique(array_filter([
            config('avatars.trellis_url'),
            'http://172.25.0.1:8096',
            'http://172.17.0.1:8096',
            'http://host.docker.internal:8096',
            'http://127.0.0.1:8096',
        ]));
        static $resolved = null;
        if ($resolved !== null) return $resolved;
        foreach ($urls as $url) {
            try {
                $res = $this->worker()->timeout(2)->connectTimeout(1)->get(rtrim($url, '/').'/health');
                if ($res->successful()) {
                    return $resolved = $url;
                }
            } catch (\Throwable) {}
        }
        return $resolved = config('avatars.trellis_url') ?? 'http://trellis-worker:8096';
    }
    public function endpoint(string $path): string { return rtrim($this->activeTrellisUrl(),'/').$path; }
    public function computePreference(): string
    {
        return 'google'; // Historical settings remain evidence; new work is Colab-only.
    }
    public function saveComputePreference(string $preference, string $actor): void
    {
        if ($preference !== 'google') {
            throw ValidationException::withMessages(['compute_preference' => 'Google Colab is required. Local asset processing is disabled.']);
        }
        AvatarEvolutionSetting::current()->update(['generation_compute_preference' => $preference]);
        app(EvolutionService::class)->audit('generation-compute', 'trellis.compute-updated', $actor, ['preference' => $preference]);
    }
    public function operations(?string $preference = null): ?array
    {
        try{return $this->worker()->withHeaders(['X-Asset-Compute-Preference'=>$preference ?? $this->computePreference()])->get($this->endpoint('/operations'))->throw()->json();}catch(\Throwable){return null;}
    }
    public function start(string $actor,int $seed=25001,string $avatarId='c_invoker',bool $allowNewInstance=false): TrellisGeneration
    {
        $computePreference=$this->computePreference();
        $operations=$this->operations($computePreference);
        $this->requireCloudGeneration($operations);
        if(!$operations||!in_array($operations['provider']??null,['google-colab','trellis2-gguf','trellis2-router'],true))throw ValidationException::withMessages(['provider'=>'A native TRELLIS.2 generation worker is required.']);
        if (($operations['provider'] ?? null) === 'google-colab' && ($operations['generation_model'] ?? null) !== 'TRELLIS.2-4B') {
            throw ValidationException::withMessages(['provider'=>'Google must run native TRELLIS.2 before body generation can start.']);
        }
        if (($operations['compute']['switching_supported'] ?? false) && !($operations['compute']['ready'] ?? false)) {
            throw ValidationException::withMessages(['provider'=>$operations['compute']['blocked_reason'] ?? 'Native TRELLIS.2 is not ready. Reconnect or provision a Google or Local backend.']);
        }
        if(!collect($this->catalog())->contains('id',$avatarId))throw ValidationException::withMessages(['avatar_id'=>'Unknown avatar.']);
        $reference=$this->references($operations)[$avatarId]??null;
        if(!$reference)throw ValidationException::withMessages(['avatar_id'=>'Prepare a reference image for this avatar first.']);
        if (($operations['references'][$avatarId]['sha256'] ?? null) !== $reference['sha256']) {
            $path = $this->localReference($avatarId, $reference['sha256']);
            $response = $path ? $this->worker()->timeout(45)->post($this->endpoint('/references/'.$avatarId), [
                'png_base64' => base64_encode(file_get_contents($path)), 'provider' => 'owner-upload', 'prompt' => $reference['prompt'] ?? '',
            ]) : null;
            if (!$response?->successful() || $response->json('sha256') !== $reference['sha256']) {
                throw ValidationException::withMessages(['reference' => 'The worker has not synced the latest body reference. Try uploading it again before generating.']);
            }
        }
        $operations['reference_sha256']=$reference['sha256'];
        $plan=['version'=>1,'avatar_id'=>$avatarId,'seed'=>$seed];
        // The hybrid bridge advertises routing support. Native TRELLIS workers
        // retain their strict existing plan contract.
        if ($operations['compute']['switching_supported'] ?? false) $plan['compute_preference'] = $computePreference;
        foreach(['reference_sha256','workflow_sha256','pins_sha256','limits_sha256','engine_sha256']as $key){
            if(!preg_match('/^[a-f0-9]{64}$/',$operations[$key]??''))throw ValidationException::withMessages(['provider'=>'The worker configuration has no valid frozen hash.']);
            $plan[$key]=$operations[$key];
        }
        AvatarEvolutionSetting::current();
        return DB::transaction(function()use($plan,$actor,$allowNewInstance){
            AvatarEvolutionSetting::lockForUpdate()->findOrFail(1);
            if(!$allowNewInstance && TrellisGeneration::withTrashed()->currentAssets()->where('avatar_id',$plan['avatar_id'])->where('status','generated_unqualified')->exists())throw ValidationException::withMessages(['avatar_id'=>'This avatar already has a completed generated GLB. Inspect or prepare its existing model instead of queuing another generation. Deleting a report does not delete its model.']);
            if(TrellisGeneration::where('avatar_id',$plan['avatar_id'])->whereIn('status',[...self::ACTIVE,'cancelling'])->exists())throw ValidationException::withMessages(['provider'=>'This avatar already has a queued generation or cancellation awaiting acknowledgement.']);
            if(TrellisGeneration::whereIn('status',self::ACTIVE)->count()>=45)throw ValidationException::withMessages(['provider'=>'The generation queue is full.']);
            $run=TrellisGeneration::create(['id'=>(string)Str::uuid(),'avatar_id'=>$plan['avatar_id'],'status'=>'queued','plan'=>$plan]);
            app(EvolutionService::class)->audit($run->id,'trellis.generation-queued',$actor,['seed'=>$plan['seed'],'reference_sha256'=>$plan['reference_sha256']]);
            DB::afterCommit(fn()=>PollTrellisGeneration::dispatch($run->id));
            return $run;
        });
    }
    public static function cloudGenerationReady(?array $operations): bool
    {
        if (($operations['generation_model']??null)!=='TRELLIS.2-4B') return false;
        if (isset($operations['compute'])) return ($operations['compute']['selected']??null)==='google'
            && ($operations['compute']['ready']??false)===true
            && ($operations['compute']['automatic_fallback']??true)===false;
        return ($operations['provider']??null)==='google-colab' && ($operations['models']['ready']??false)===true;
    }
    public function requireCloudGeneration(?array $operations, string $field='provider'): void
    {
        if (!self::cloudGenerationReady($operations)) throw ValidationException::withMessages([
            $field=>'Connect a ready Google Colab TRELLIS.2 runtime with local fallback disabled. No job was queued.'
        ]);
    }
    public function deleteModel(TrellisGeneration $generation,string $actor,bool $force=false):void
    {
        AvatarEvolutionSetting::current();
        DB::transaction(function()use($generation,$actor,$force){
            AvatarEvolutionSetting::lockForUpdate()->findOrFail(1);
            $run=TrellisGeneration::withTrashed()->lockForUpdate()->findOrFail($generation->id);
            if($run->status!=='generated_unqualified')throw ValidationException::withMessages(['model'=>'Only a completed generated model can be deleted.']);
            $preparations=\App\Models\AvatarPreparation::withTrashed()->where('generation_id',$run->id);
            $ids=(clone $preparations)->pluck('id');
            if(!$force){
                if((clone $preparations)->where(function($query){
                    $query->whereNotIn('status',['failed','cancelled','rejected','paused','ready','needs_review','awaiting_retarget','awaiting_validation','complete'])
                        ->orWhere(function($visible){$visible->whereNull('deleted_at')->whereNotIn('status',['failed','cancelled','rejected']);});
                })->exists()
                    ||\App\Models\AvatarVisualRelease::whereIn('run_id',$ids)->exists()
                    ||(!empty($run->state['artifact']['sha256'])&&\App\Models\AvatarVisualRelease::where('source_sha256',$run->state['artifact']['sha256'])->exists()))
                    throw ValidationException::withMessages(['model'=>'This source is used by a preparation or release. Cancel unfinished preparation first; published and retained release sources are protected.']);
            }
            $response=$this->worker()->delete($this->endpoint('/jobs/'.$run->id.'/artifact'));
            if(!$response->successful()&&$response->status()!==404&&$response->json('status')!=='model_deleted')throw ValidationException::withMessages(['model'=>'The worker could not confirm deletion. The model remains reserved; try again when the worker is available.']);
            $local=storage_path('trellis-sources/'.$run->id.'.glb');
            if(is_file($local)&&!is_link($local)&&!unlink($local))throw ValidationException::withMessages(['model'=>'Local source removal failed. Retry deletion.']);
            $state=$run->state??[];unset($state['artifact']);$state['stage']='model_deleted';
            $run->update(['status'=>'model_deleted','state'=>$state]);
            app(EvolutionService::class)->audit($run->id,'trellis.model-deleted',$actor,['avatar_id'=>$run->avatar_id]);
        });
    }
    public function verifiedAsset(TrellisGeneration $run): string
    {
        if($run->status!=='generated_unqualified')abort(409,'No generated source is available.');
        $local=storage_path('trellis-sources/'.$run->id.'.glb');
        if(is_file($local)&&!is_link($local)){
            abort_if(filesize($local)>32*1024*1024,409,'Generated source exceeds the artifact limit.');
            $bytes=file_get_contents($local);
        }else{
            $bytes=$this->worker()->timeout(45)->get($this->endpoint('/jobs/'.$run->id.'/artifact'))->throw()->body();
        }
        $expected=$run->state['artifact']??[];
        if(strlen($bytes)>32*1024*1024||strlen($bytes)!==($expected['bytes']??null)||strlen($bytes)<20||substr($bytes,0,4)!=='glTF'
            ||!hash_equals($expected['sha256']??'',hash('sha256',$bytes)))abort(409,'Generated source integrity check failed.');
        $header=unpack('Vversion/Vlength',substr($bytes,4,8));
        if($header['version']!==2||$header['length']!==strlen($bytes))abort(409,'Generated GLB container is invalid.');
        return $bytes;
    }

    public function weaponStoragePath(?string $avatarId = null): string
    {
        $base = config('avatars.weapon_path') ?? storage_path('app/avatars/weapons');
        return $avatarId ? $base . '/' . $avatarId : $base;
    }

    public function weaponReferences(): array
    {
        $catalog = $this->catalog();
        $results = [];
        $baseDir = $this->weaponStoragePath();

        foreach ($catalog as $avatar) {
            $id = $avatar['id'];
            $metaPath = $baseDir . '/' . $id . '/metadata.json';
            $meta = is_file($metaPath) ? (json_decode(file_get_contents($metaPath), true) ?: []) : [];

            $role = $avatar['role'] ?? 'Fighter';
            $signature = $avatar['design']['signature'] ?? '';

            $defaultPrimaryType = match(true) {
                str_contains(strtolower($signature), 'bow') => 'bow',
                str_contains(strtolower($signature), 'gun') || str_contains(strtolower($signature), 'shotgun') => 'gun',
                str_contains(strtolower($signature), 'dagger') || (str_contains(strtolower($signature), 'blade') && str_contains(strtolower($signature), 'twin')) => 'dual_daggers',
                str_contains(strtolower($signature), 'staff') || str_contains(strtolower($signature), 'orb') => 'staff',
                str_contains(strtolower($signature), 'greatsword') || str_contains(strtolower($signature), 'axe') || str_contains(strtolower($signature), 'hammer') => 'two_handed',
                $role === 'Marksman' => 'bow',
                $role === 'Mage' => 'staff',
                $role === 'Assassin' => 'dual_daggers',
                $role === 'Tank' => 'one_handed_sword',
                default => 'one_handed_sword',
            };

            $defaultSecondaryType = match(true) {
                str_contains(strtolower($signature), 'shield') => 'shield',
                str_contains(strtolower($signature), 'twin') || str_contains(strtolower($signature), 'dual') => 'dual_daggers',
                str_contains(strtolower($signature), 'orb') => 'orb',
                default => 'none',
            };

            // Primary slot
            $primaryData = $meta['primary'] ?? (isset($meta['weapon_slot']) && $meta['weapon_slot'] === 'primary' ? $meta : null);
            $primaryFile = $this->weaponFile($id, 'primary');
            $hasPrimaryFile = (bool)$primaryFile;
            $primary = [
                'slot' => 'primary',
                'weapon_type' => $primaryData['weapon_type'] ?? $defaultPrimaryType,
                'socket_name' => 'right_hand_socket',
                'has_custom_asset' => $hasPrimaryFile,
                'filename' => $primaryFile ? basename($primaryFile['path']) : null,
                'sha256' => $primaryData['sha256'] ?? null,
                'updated_at' => $primaryData['updated_at'] ?? null,
                'height_cm' => $primaryData['height_cm'] ?? (($primaryData['weapon_type']??$defaultPrimaryType)==='shield' ? 90 : 120),
                'reference_sha256' => $primaryData['reference_sha256'] ?? null,
            ];

            // Secondary slot
            $secondaryData = $meta['secondary'] ?? (isset($meta['weapon_slot']) && $meta['weapon_slot'] === 'secondary' ? $meta : null);
            $secondaryFile = $this->weaponFile($id, 'secondary');
            $hasSecondaryFile = (bool)$secondaryFile;
            $secondary = [
                'slot' => 'secondary',
                'weapon_type' => $secondaryData['weapon_type'] ?? $defaultSecondaryType,
                'socket_name' => 'left_hand_socket',
                'has_custom_asset' => $hasSecondaryFile,
                'filename' => $secondaryFile ? basename($secondaryFile['path']) : null,
                'sha256' => $secondaryData['sha256'] ?? null,
                'updated_at' => $secondaryData['updated_at'] ?? null,
                'height_cm' => $secondaryData['height_cm'] ?? (($secondaryData['weapon_type']??$defaultSecondaryType)==='shield' ? 90 : 120),
                'reference_sha256' => $secondaryData['reference_sha256'] ?? null,
            ];

            $results[$id] = [
                'avatar_id' => $id,
                'primary' => $primary,
                'secondary' => $secondary,
                'has_custom_asset' => $primary['has_custom_asset'] || $secondary['has_custom_asset'],
                'weapon_slot' => 'primary',
                'weapon_type' => $primary['weapon_type'],
                'socket_name' => 'right_hand_socket',
                'signature_name' => $signature ?: ($avatar['name'] . ' Signature Weapon'),
            ];
        }
        return $results;
    }

    public function saveWeaponAsset(string $avatarId, \Illuminate\Http\UploadedFile $file, string $slot, string $type, string $socket, string $actor): array
    {
        return $this->withWeaponLock($avatarId, fn() => $this->storeWeaponAsset($avatarId, $file, $slot, $type, $socket, $actor));
    }
    public function saveGeneratedWeapon(string $avatar,\Illuminate\Http\UploadedFile $file,string $slot,string $reference,string $generation,string $actor):array
    {
        return $this->withWeaponLock($avatar,function()use($avatar,$file,$slot,$reference,$generation,$actor){
            $current=$this->weaponFile($avatar,$slot);
            $expected=$current['meta']['reference_sha256']??($current&&$current['mime']==='image/png'?$current['sha256']:null);
            if(!$current||$expected!==$reference)throw ValidationException::withMessages(['equipment'=>'The equipment reference changed during generation. Review this result before replacing the newer upload.']);
            $directory=$this->weaponStoragePath($avatar);$referenceName=$slot.'-reference-'.$reference.'.png';
            if($current['mime']==='image/png') {
                if(!hash_equals($reference,hash_file('sha256',$current['path'])))throw ValidationException::withMessages(['equipment'=>'Uploaded reference integrity failed.']);
                if(!is_file($directory.'/'.$referenceName))copy($current['path'],$directory.'/'.$referenceName);
            }
            $this->storeWeaponAsset($avatar,$file,$slot,$current['meta']['weapon_type']??'generic',$slot==='primary'?'right_hand_socket':'left_hand_socket',$actor);
            $path=$directory.'/metadata.json';$meta=json_decode(file_get_contents($path),true,flags:JSON_THROW_ON_ERROR);
            $meta[$slot]=[...$meta[$slot],'reference_sha256'=>$reference,'reference_filename'=>$referenceName,'generation_id'=>$generation,'generation_provider'=>'trellis2-equipment','height_cm'=>$current['meta']['height_cm']??(($current['meta']['weapon_type']??'')==='shield'?90:120)];
            \Illuminate\Support\Facades\File::replace($path,json_encode($meta,JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR));
            return $meta[$slot];
        });
    }
    private function withWeaponLock(string $avatar, callable $callback): mixed
    {
        try {
            return \Illuminate\Support\Facades\Cache::lock('trellis.weapon-assets.'.$avatar, 30)->block(5, $callback);
        } catch (\Illuminate\Contracts\Cache\LockTimeoutException) {
            throw ValidationException::withMessages(['weapon_file' => 'Another equipment change is being saved for this avatar. Please try again.']);
        }
    }
    private function storeWeaponAsset(string $avatarId, \Illuminate\Http\UploadedFile $file, string $slot, string $type, string $socket, string $actor): array
    {
        if (!collect($this->catalog())->contains('id', $avatarId)) {
            throw ValidationException::withMessages(['avatar_id' => 'Unknown avatar.']);
        }
        $extension = strtolower($file->getClientOriginalExtension());
        $bytes = file_get_contents($file->getRealPath());
        $valid = false;
        if ($extension === 'png') $valid = str_starts_with($bytes, "\x89PNG\r\n\x1a\n") && @getimagesizefromstring($bytes) !== false;
        if ($extension === 'glb' && strlen($bytes) >= 20 && substr($bytes, 0, 4) === 'glTF') {
            $header = unpack('Vversion/Vlength', substr($bytes, 4, 8));
            $valid = $header['version'] === 2 && $header['length'] === strlen($bytes);
        }
        if ($extension === 'gltf') {
            $json = json_decode($bytes, true);
            $valid = is_array($json) && ($json['asset']['version'] ?? null) === '2.0';
            foreach (['buffers', 'images'] as $key) {
                if (isset($json[$key]) && !is_array($json[$key])) { $valid = false; continue; }
                foreach ($json[$key] ?? [] as $resource) {
                    if (!is_array($resource) || (isset($resource['uri']) && (!is_string($resource['uri']) || !str_starts_with($resource['uri'], 'data:')))) $valid = false;
                }
            }
        }
        if (!$valid) throw ValidationException::withMessages(['weapon_file' => 'Choose a valid PNG, GLB 2.0, or self-contained glTF 2.0 file. External glTF files must be packed into a GLB first.']);
        $dir = $this->weaponStoragePath($avatarId);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        $extension = strtolower($file->getClientOriginalExtension());
        $filename = $slot . '.' . $extension;
        $targetPath = $dir . '/' . $filename;
        $file->move($dir, $filename);

        $sha256 = hash_file('sha256', $targetPath);

        $metaPath = $dir . '/metadata.json';
        $existing = is_file($metaPath) ? (json_decode(file_get_contents($metaPath), true) ?: []) : [];

        $slotData = [
            'weapon_slot' => $slot,
            'weapon_type' => $type,
            'socket_name' => $socket,
            'filename' => $filename,
            'extension' => $extension,
            'mime_type' => $extension === 'png' ? 'image/png' : ($extension === 'gltf' ? 'model/gltf+json' : 'model/gltf-binary'),
            'sha256' => $sha256,
            'has_custom_asset' => true,
            'size_bytes' => filesize($targetPath),
            'updated_at' => now()->toIso8601String(),
        ];

        $existing['avatar_id'] = $avatarId;
        $existing[$slot] = $slotData;
        if ($slot === 'primary') {
            foreach ($slotData as $k => $v) {
                $existing[$k] = $v;
            }
        }

        \Illuminate\Support\Facades\File::replace($metaPath, json_encode($existing, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR));
        foreach (array_diff(['png','glb','gltf'], [$extension]) as $oldExtension) {
            $oldFile = $dir.'/'.$slot.'.'.$oldExtension;
            if (is_file($oldFile)) unlink($oldFile);
        }
        app(EvolutionService::class)->audit($avatarId, 'trellis.weapon-uploaded', $actor, [
            'weapon_slot' => $slot,
            'weapon_type' => $type,
            'socket_name' => $socket,
            'sha256' => $sha256,
        ]);

        return $slotData;
    }

    public function weaponFile(string $avatarId, string $slot = 'primary'): ?array
    {
        if (!in_array($slot, ['primary', 'secondary'], true) || !collect($this->catalog())->contains('id', $avatarId)) return null;
        $dir = $this->weaponStoragePath($avatarId);
        $metaPath = $dir . '/metadata.json';
        $meta = is_file($metaPath) ? (json_decode(file_get_contents($metaPath), true) ?: []) : [];

        $slotData = $meta[$slot] ?? ($slot === 'primary' && isset($meta['filename']) ? $meta : null);
        $filename = $slotData['filename'] ?? null;

        if (!$filename) {
            foreach (['png', 'glb', 'gltf'] as $ext) {
                if (is_file($dir . '/' . $slot . '.' . $ext)) {
                    $filename = $slot . '.' . $ext;
                    break;
                }
            }
        }

        if (!$filename || !in_array($filename, [$slot.'.png', $slot.'.glb', $slot.'.gltf'], true)) return null;
        $filePath = $dir . '/' . $filename;
        if (!is_file($filePath)) return null;

        $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        return [
            'path' => $filePath,
            'mime' => $ext === 'glb' ? 'model/gltf-binary' : ($ext === 'gltf' ? 'model/gltf+json' : 'image/png'),
            'sha256' => $slotData['sha256'] ?? hash_file('sha256', $filePath),
            'meta' => $slotData ?? [],
        ];
    }

    public function removeReference(string $avatar, string $actor): void
    {
        // Remove the active selection, preserving immutable inputs used by old jobs.
        $dir = storage_path('app/avatars/references/'.$avatar);
        \Illuminate\Support\Facades\File::ensureDirectoryExists($dir);
        \Illuminate\Support\Facades\File::replace($dir.'/current.json', json_encode(['removed' => true, 'updated_at' => now()->toIso8601String()]));
        app(EvolutionService::class)->audit($avatar, 'trellis.reference-removed', $actor, []);
    }

    public function updateWeapon(string $avatar, string $slot, string $type, string $actor, ?float $heightCm=null): void
    {
        if($heightCm!==null&&(!is_finite($heightCm)||$heightCm<5||$heightCm>300))throw ValidationException::withMessages(['height_cm'=>'Use a weapon height between 5 and 300 cm.']);
        $this->withWeaponLock($avatar, fn() => $this->storeWeaponSettings($avatar, $slot, $type, $actor, $heightCm));
    }
    private function storeWeaponSettings(string $avatar, string $slot, string $type, string $actor, ?float $heightCm=null): void
    {
        $file = $this->weaponFile($avatar, $slot);
        if (!$file) throw ValidationException::withMessages(['weapon_file' => 'Upload a weapon file before editing its settings.']);
        $path = $this->weaponStoragePath($avatar).'/metadata.json';
        $meta = is_file($path) ? json_decode(file_get_contents($path), true) : [];
        $data = [...$file['meta'], 'filename' => basename($file['path']), 'weapon_type' => $type,
            'weapon_slot' => $slot, 'socket_name' => $slot === 'primary' ? 'right_hand_socket' : 'left_hand_socket',
            'has_custom_asset' => true, 'sha256' => $file['sha256'], 'updated_at' => now()->toIso8601String()];
        $data['height_cm']=$heightCm??($file['meta']['height_cm']??($type==='shield'?90:120));
        $meta[$slot] = $data;
        if ($slot === 'primary') $meta = array_replace($meta, $data);
        \Illuminate\Support\Facades\File::replace($path, json_encode($meta, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR));
        app(EvolutionService::class)->audit($avatar, 'trellis.weapon-updated', $actor, ['slot' => $slot, 'weapon_type' => $type]);
    }

    public function removeWeapon(string $avatar, string $slot, string $actor): void
    {
        $this->withWeaponLock($avatar, fn() => $this->removeWeaponFiles($avatar, $slot, $actor));
    }
    private function removeWeaponFiles(string $avatar, string $slot, string $actor): void
    {
        $dir = $this->weaponStoragePath($avatar);
        $path = $dir.'/metadata.json';
        $meta = is_file($path) ? json_decode(file_get_contents($path), true) : [];
        foreach (['png', 'glb', 'gltf'] as $ext) {
            $file = $dir.'/'.$slot.'.'.$ext;
            if (is_file($file)) unlink($file);
        }
        unset($meta[$slot]);
        if ($slot === 'primary') {
            foreach (['weapon_slot','weapon_type','socket_name','filename','extension','mime_type','sha256','has_custom_asset','size_bytes','updated_at'] as $key) unset($meta[$key]);
        }
        if (is_dir($dir)) \Illuminate\Support\Facades\File::replace($path, json_encode($meta, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR));
        app(EvolutionService::class)->audit($avatar, 'trellis.weapon-removed', $actor, ['slot' => $slot]);
    }
}
