<?php

namespace App\Services;

use App\Models\{ClubFixture, ClubTournament, OnlineCatalog, OnlineClub, OwnedPlayerCard};
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/** Public reference projections. Ownership, private orders and match execution stay in their own domains. */
class AvatarpediaService
{
    private ?OnlineCatalog $catalog = null;
    private bool $loaded = false;
    private ?array $content = null;
    private ?Collection $playerRecords = null;
    private ?Collection $avatarRecords = null;
    private ?array $entryCounts = null;

    public const KINDS = ['tournaments', 'teams', 'nations', 'players', 'coaches', 'avatars', 'items', 'releases', 'organizers', 'sponsors', 'talent', 'managers'];

    private function catalog(): ?OnlineCatalog
    {
        if (! $this->loaded) {
            $this->catalog = OnlineCatalog::where('active', true)->latest('updated_at')->first();
            $this->loaded = true;
        }
        return $this->catalog;
    }

    public function world(): array { return app(WorldActivityService::class)->feed(); }

    private function content(): array { return $this->content ??= app(GameContentService::class)->snapshot(); }

    private function players(): Collection
    {
        return $this->playerRecords ??= OwnedPlayerCard::where('catalog_id',$this->catalog()?->id)->orderBy('persona_name')->limit(100)->get()->map(fn($owned)=>$this->worldPlayer($owned))->filter()->values();
    }

    private function worldPlayer(OwnedPlayerCard $owned): ?array
    {
        $card=collect($this->catalog()?->payload['cards']??[])->firstWhere('id',$owned->definition_id);
        if(!$card)return null;
        $card=app(WorldPlayerProfiles::class)->definition($owned,$card);
        return [
            'id'=>$owned->id,'name'=>$owned->persona_name??$card['name'],'archetype_id'=>$owned->definition_id,
            'role' => $card['preferredRole'] ?? $card['role'] ?? null,
            'nationality'=>$card['nationality']??null,'status'=>$owned->retired_at?'retired':'active',
            'presentation'=>$owned->presentation,'personal_details'=>$owned->personal_details,
            'age' => $card['age'] ?? null, 'overall' => $card['ovr'] ?? null,
            'stats' => array_intersect_key($card['stats'] ?? [], array_flip(['lan', 'tf', 'iq', 'ldr', 'clu', 'sta', 'flx'])),
            'primaryPersonality' => $card['primaryPersonality'] ?? null,
            'secondaryPersonality' => $card['secondaryPersonality'] ?? null,
            'signature_avatar_ids' => collect($this->catalog()?->payload['avatars'] ?? [])
                ->filter(fn ($avatar) => in_array($avatar['name'], $card['signatureChampions'] ?? [], true))->pluck('id')->values()->all(),
        ];
    }

    private function coaches(): Collection
    {
        return collect($this->catalog()?->payload['coaches'] ?? [])->map(fn ($coach) => array_intersect_key($coach,
            array_flip(['id', 'name', 'style', 'tier', 'chemistryBonus', 'playbookBonus', 'extraBans', 'quote', 'rating10', 'coachAttributes'])))->sortBy('name')->values();
    }

    private function avatars(): Collection
    {
        if ($this->avatarRecords !== null) return $this->avatarRecords;
        $content = $this->content();
        return $this->avatarRecords = collect($this->catalog()?->payload['avatars'] ?? [])->map(function ($base) use ($content) {
            $avatar = app(GameContentService::class)->avatar($base, $content);
            $skills = [['id' => $avatar['id'].':passive', 'slot' => 'passive', 'name' => $avatar['passiveName'] ?? 'Passive', 'desc' => $avatar['passiveDesc'] ?? '']];
            foreach (['skill1', 'skill2', 'ultimate'] as $slot) {
                $skills[] = ['id' => $avatar['id'].':'.$slot, 'slot' => $slot, ...array_intersect_key($avatar[$slot] ?? [], array_flip(['name', 'desc', 'cooldown', 'damage', 'disabled']))];
            }
            foreach ($content['records'] as $row) {
                $data = $row['data'];
                if ($row['kind'] !== 'skill' || $row['deleted'] || ! in_array($data['slot'] ?? '', ['invoked', 'library'], true)) continue;
                if (($data['avatarId'] ?? null) !== $avatar['id'] && ! in_array($data['avatarName'] ?? null, [$avatar['name'], $avatar['displayName'] ?? ''], true)) continue;
                $skills[] = ['id' => $row['id'], ...array_intersect_key($data, array_flip(['slot', 'name', 'desc', 'cooldown', 'damage']))];
            }
            return ['id' => $avatar['id'], 'name' => $avatar['displayName'] ?? $avatar['name'],
                ...array_intersect_key($avatar, array_flip(['title', 'primaryRole', 'secondaryRole', 'archetype', 'lore', 'hp', 'ad', 'armor', 'mr', 'aspd', 'range'])),
                'skills' => $skills];
        })->sortBy('name')->values();
    }

    private function items(): Collection
    {
        return collect($this->content()['records'])->filter(fn ($row) => $row['kind'] === 'item' && ! $row['deleted'])
            ->map(fn ($row) => ['id' => $row['id'], 'version' => $row['version'], ...array_intersect_key($row['data'], array_flip(['name', 'cost', 'tier', 'stats', 'passiveName', 'passiveDesc', 'suitableRoles']))])->sortBy('name')->values();
    }

    private function club(OnlineClub $club): array
    {
        return $club->only(['id', 'name', 'tag', 'identity', 'tier', 'is_bot', 'created_at', 'updated_at']);
    }

    private function tournament(ClubTournament $event): array
    {
        $definition=$event->definition_id ? \App\Models\CompetitionDefinition::find($event->definition_id) : null;
        $organizer=$definition ? DB::table('competition_organizers')->find($definition->organizer_id) : null;
        $this->entryCounts ??= [];
        $this->entryCounts[$event->id] ??= DB::table('club_tournament_entries')->where('tournament_id',$event->id)->where('status','accepted')->count();
        return [...$event->only(['id', 'year', 'tier', 'status', 'registration_closes_at', 'semifinals_at', 'final_at', 'champion_id', 'champion_prize', 'runner_up_prize', 'updated_at','starts_at','ends_at']),
            'capacity'=>$event->capacity,'participant_type'=>$event->participant_type,'definition_id'=>$event->definition_id,
            'regulations'=>$event->regulations,'ranked'=>$event->ranked,'provenance'=>$event->provenance,
            'name' => $event->title(), 'organizer' => $organizer?->name ?? ClubTournament::ORGANIZER, 'organizer_id' => $organizer?->slug ?? 'signal-circuit',
            'sponsor_ids'=>$definition?array_map(fn($s)=>\Illuminate\Support\Str::slug($s['name']),$event->sponsors??[]):['lantern-relay'],
            'sponsor' => $definition ? implode(', ',array_column($event->sponsors??[],'name')) : ClubTournament::SPONSOR, 'sponsor_id' => $definition ? \Illuminate\Support\Str::slug($event->sponsors[0]['name']??'') : 'lantern-relay',
            'rules' => $event->provenance==='launch_simulation' ? $event->regulations['notice'] : ($definition ? 'Published regulations version '.$event->rules_version.'. '.implode(' → ',array_column($event->regulations['stages']??[],'format')).'. Qualification follows the frozen edition rules. Only verified scheduled Arena results advance stages.' : ClubTournament::RULES),
            'entries' => (int) ($this->entryCounts[$event->id] ?? 0),
            'second_semifinal_at' => $event->semifinals_at?->addHour(), 'currency' => 'PHP',
        ];
    }

    private function fixtures($query, int $limit = 100): array
    {
        return $query->with(['homeClub:id,name,tag', 'awayClub:id,name,tag','homeNation:id,name,flag','awayNation:id,name,flag', 'match:id,status,plan,result,spectator_ready,started_at,completed_at'])
            ->limit($limit)->get()->map(function (ClubFixture $fixture) {
                $match = $fixture->match;
                $teams = $match?->plan['clubs'] ?? ['blue' => $fixture->homeClub?->name??$fixture->homeNation?->name, 'red' => $fixture->awayClub?->name??$fixture->awayNation?->name];
                $winner = $match?->status === 'completed' ? ($match->result['winner'] ?? null) : null;
                return ['id' => $fixture->id, 'competition' => $fixture->competition, 'kickoff_at' => $fixture->kickoff_at,
                    'orders_close_at' => $fixture->orders_close_at, 'tournament_id' => $fixture->tournament_id, 'bracket_slot' => $fixture->bracket_slot,
                    'status' => $fixture->hold_reason ? 'review' : ($match?->status ?? 'scheduled'), 'started_at' => $match?->started_at,
                    'watch_match_id' => $match?->canSpectate() ? $match->id : null,
                    'home' => ['id' => $fixture->home_club_id??$fixture->home_national_team_id, 'name' => $teams['blue'],'national'=>(bool)$fixture->home_national_team_id,'flag'=>$fixture->homeNation?->flag], 'away' => ['id' => $fixture->away_club_id??$fixture->away_national_team_id, 'name' => $teams['red'],'national'=>(bool)$fixture->away_national_team_id,'flag'=>$fixture->awayNation?->flag],
                    'winner' => $winner === null ? null : $teams[$winner], 'winner_id' => $winner === null ? null : ($winner === 'blue' ? $fixture->home_club_id : $fixture->away_club_id),
                    'score' => $winner !== null && isset($match->result['report']['blueKills'], $match->result['report']['redKills'])
                        ? ['blue' => $match->result['report']['blueKills'], 'red' => $match->result['report']['redKills']] : null,
                    'duration_seconds' => $winner === null ? null : $match->result['report']['durationSeconds'] ?? null];
            })->all();
    }

    public function teamGames(int $id,string $kind,int $page):array
    {
        OnlineClub::whereKey($id)->whereNotNull('tag')->firstOrFail();
        $q=ClubFixture::where(fn($q)=>$q->where('home_club_id',$id)->orWhere('away_club_id',$id));
        if($kind==='scrimmages')$q->whereNull('tournament_id')->whereIn('competition',['Club Friendly','Scrimmage']);
        if($kind==='tournaments')$q->whereNotNull('tournament_id');
        $count=(clone $q)->count();
        return ['items'=>$this->fixtures($q->orderByDesc('kickoff_at')->orderByDesc('id')->offset(($page-1)*20),20),
            'meta'=>['page'=>$page,'last_page'=>max(1,(int)ceil($count/20)),'total'=>$count]];
    }

    private function fixtureQuery() { return ClubFixture::query(); }

    public function directory(string $kind, string $search = '', int $page = 1, int $perPage = 30,array $filters=[]): array
    {
        abort_unless(in_array($kind, self::KINDS, true), 404);
        if($kind==='talent')return app(WorldTalent::class)->directory($search,$page,$perPage);
        if($kind==='managers')return app(ManagerRecordBook::class)->directory($search,$page,$perPage);
        $q = mb_strtolower(trim($search));
        if ($kind === 'teams') {
            $query = OnlineClub::whereNotNull('tag')->orderBy('name');
            if($filters['tier']??null)$query->where('tier',$filters['tier']);
            if ($q !== '') $query->where(fn ($query) => $query->whereRaw('LOWER(name) LIKE ?', ['%'.$q.'%'])->orWhereRaw('LOWER(tag) LIKE ?', ['%'.$q.'%']));
            $total = (clone $query)->count();
            $rows = $query->offset(($page - 1) * $perPage)->limit($perPage)->get()->map(fn ($club) => $this->club($club));
        } elseif($kind==='nations') {
            $query=\App\Models\NationalTeam::orderBy('name');if($q!=='')$query->whereRaw('LOWER(name) LIKE ?',['%'.$q.'%']);
            $total=(clone $query)->count();$rows=$query->offset(($page-1)*$perPage)->limit($perPage)->get(['id','name','flag','geography_id'])->map(fn($n)=>$n->toArray()+['type'=>'National association']);
        } elseif($kind==='players') {
            $query=OwnedPlayerCard::where('catalog_id',$this->catalog()?->id)->orderBy('persona_name')->orderBy('id');if($q!=='')$query->where(fn($query)=>$query->whereRaw('LOWER(persona_name) LIKE ?',['%'.$q.'%'])->orWhereRaw('LOWER(CAST(personal_details AS TEXT)) LIKE ?',['%'.$q.'%']));
            if($filters['nationality']??null)$query->whereIn('nationality_id',DB::table('competition_geographies')->where('kind','country')->where('code',$filters['nationality'])->select('id'));
            if($filters['role']??null){$ids=collect($this->catalog()?->payload['cards']??[])->filter(fn($c)=>($c['preferredRole']??$c['role']??'')===$filters['role'])->pluck('id');$query->whereIn('definition_id',$ids);}
            $total=(clone $query)->count();$players=$query->offset(($page-1)*$perPage)->limit($perPage)->get();$clubs=OnlineClub::whereIn('user_id',$players->pluck('user_id'))->get(['id','name','tag','user_id'])->keyBy('user_id');$rows=$players->map(fn($p)=>$this->worldPlayer($p)+['club'=>isset($clubs[$p->user_id])?$clubs[$p->user_id]->only(['id','name','tag']):null])->filter();
        } elseif($kind==='tournaments') {
            $directory=app(TournamentDirectory::class);$options=[...$filters,'q'=>$search,'page'=>$page];$events=$directory->page($options,$perPage);
            return ['items'=>$events->getCollection()->map(fn($e)=>$this->tournament($e)+['lifecycle'=>$e->lifecycle,'effective_starts_at'=>$e->effective_starts_at,'effective_ends_at'=>$e->effective_ends_at]),'meta'=>['page'=>$page,'per_page'=>$perPage,'total'=>$events->total(),'last_page'=>$events->lastPage()],'counts'=>$directory->counts($options)];
        } else {
            $rows = match ($kind) {
                'players' => $this->players(), 'coaches' => $this->coaches(), 'avatars' => $this->avatars(), 'items' => $this->items(),
                'tournaments' => ClubTournament::orderByDesc('year')->orderBy('tier')->get()->map(fn ($event) => $this->tournament($event)),
                'releases' => OnlineCatalog::latest('updated_at')->get()->map(fn ($release) => $this->release($release)),
                'organizers' => collect([['id' => 'signal-circuit', 'name' => ClubTournament::ORGANIZER, 'type' => 'Fictional tournament organizer']])->concat(DB::table('competition_organizers')->where('status','verified')->get(['slug','name','category'])->map(fn($o)=>['id'=>$o->slug,'name'=>$o->name,'type'=>$o->category])),
                'sponsors' => collect([['id'=>'lantern-relay','name'=>ClubTournament::SPONSOR,'type'=>'Fictional tournament sponsor']])->concat(
                    \App\Models\CompetitionDefinition::where('status','approved')->get(['sponsors'])->flatMap(fn($d)=>collect($d->sponsors??[])->map(fn($s)=>['id'=>\Illuminate\Support\Str::slug($s['name']),'name'=>$s['name'],'type'=>'Published tournament sponsor'])))->unique('id'),
            };
            if ($q !== '') $rows = $rows->filter(fn ($row) => str_contains(mb_strtolower(implode(' ', array_filter([$row['name'] ?? '', $row['role'] ?? '', $row['style'] ?? '', $row['primaryRole'] ?? '', $row['year'] ?? '', $row['tier'] ?? '']))), $q));
            $total = $rows->count();
            $rows = $rows->slice(($page - 1) * $perPage, $perPage);
        }
        return ['items' => $rows->values(), 'meta' => ['page' => $page, 'per_page' => $perPage, 'total' => $total, 'last_page' => max(1, (int) ceil($total / $perPage))]];
    }

    public function search(string $query): array
    {
        return collect(self::KINDS)->flatMap(fn ($kind) => collect($this->directory($kind, $query, 1, 5)['items'])->map(fn ($row) => ['kind' => $kind, 'id' => $row['id'], 'name' => $row['name']]))->values()->all();
    }

    private function release(OnlineCatalog $release): array
    {
        return ['id' => $release->id, 'name' => ($release->manifest['ability_ruleset'] ?? 'Arena catalog').' · '.substr($release->id, 0, 8),
            'active' => $release->active, 'date' => $release->updated_at, 'rules' => $release->manifest['rules_version'] ?? null,
            'ability_ruleset' => $release->manifest['ability_ruleset'] ?? null];
    }

    public function index(): array
    {
        return ['name' => 'Hexapedia', 'generated_at' => now(), 'catalog_id' => $this->catalog()?->id,
            'content_hash' => $this->content()['hash'], 'clubs' => $this->directory('teams', '', 1, 100)['items'],
            'players' => $this->players(), 'avatars' => $this->avatars(), 'items' => $this->items(),
            'events' => $this->directory('tournaments', '', 1, 50)['items'], 'patches' => $this->directory('releases', '', 1, 20)['items'],
            'fixtures' => [
                ...$this->fixtures($this->fixtureQuery()->where(fn ($query) => $query->whereNull('match_id')->orWhereHas('match', fn ($match) => $match->whereIn('status', ['allocated', 'running'])))->orderBy('kickoff_at'), 30),
                ...$this->fixtures($this->fixtureQuery()->where('kickoff_at', '>=', now()->subDays(30))->whereHas('match', fn ($query) => $query->where('status', 'completed'))->orderByDesc('kickoff_at'), 30),
            ],
            'standings' => $this->standings(),
            'counts' => ['talent'=>DB::table('world_media_personalities')->count(), 'teams' => OnlineClub::whereNotNull('tag')->count(), 'players' => OwnedPlayerCard::where('catalog_id',$this->catalog()?->id)->count(), 'avatars' => $this->avatars()->count(),
                'items' => $this->items()->count(), 'coaches' => $this->coaches()->count(), 'tournaments' => ClubTournament::count()]];
    }

    public function article(string $kind, string $id): array
    {
        abort_unless(in_array($kind, self::KINDS, true), 404);
        if (in_array($kind, ['teams', 'tournaments'], true)) abort_if(filter_var($id, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) === false, 404);
        $data = match ($kind) {
            'managers'=>app(ManagerRecordBook::class)->article($id),'talent'=>app(WorldTalent::class)->article($id), 'teams' => $this->teamArticle($id), 'tournaments' => $this->tournamentArticle($id),
            'nations' => \App\Models\NationalTeam::findOrFail($id)->only(['id','name','flag','geography_id']),
            'players' => $this->playerArticle($id), 'coaches' => $this->coaches()->firstWhere('id', $id), 'avatars' => $this->avatarArticle($id),
            'items' => $this->items()->firstWhere('id', $id),
            'releases' => $this->release(OnlineCatalog::findOrFail($id)),
            'organizers', 'sponsors' => $this->directory($kind,'',1,PHP_INT_MAX)['items']->firstWhere('id', $id),
        };
        abort_if($data === null, 404);
        if(in_array($kind,['organizers','sponsors'],true)){
            // Related records are selected before pagination; a directory page boundary cannot hide an association.
            $events=ClubTournament::query();
            if($kind==='organizers'){
                $events->where(function($q)use($id){$q->whereIn('definition_id',DB::table('competition_definitions')->whereIn('organizer_id',DB::table('competition_organizers')->where('slug',$id)->select('id'))->select('id'));if($id==='signal-circuit')$q->orWhereNull('definition_id');});
            }else{
                $events->where(function($q)use($data,$id){$q->whereJsonContains('sponsors',[['name'=>$data['name']]]);if($id==='lantern-relay')$q->orWhereNull('definition_id');});
            }
            $data['tournaments']=$events->orderByDesc('year')->orderBy('starts_at')->get()->map(fn($e)=>$this->tournament($e));
        }
        return ['kind' => $kind, 'record' => $data, 'source' => ['catalog_id' => $this->catalog()?->id, 'content_hash' => $this->content()['hash'], 'generated_at' => now()]];
    }

    private function teamArticle(string $id): array
    {
        $club = OnlineClub::whereNotNull('tag')->findOrFail($id);
        $roster = $this->publicRosters(collect([$club]))[$club->id] ?? [];
        $base = fn () => $this->fixtureQuery()->where(fn ($query) => $query->where('home_club_id', $club->id)->orWhere('away_club_id', $club->id));
        $events = ClubTournament::whereIn('id', DB::table('club_tournament_entries')->where('club_id', $club->id)->select('tournament_id'))->orderByDesc('year')->get()->map(fn ($event) => $this->tournament($event));
        $completed = $base()->whereHas('match', fn ($query) => $query->where('status', 'completed'))->with('match:id,result')->get();
        $wins = $completed->filter(fn ($fixture) => ($fixture->match->result['winner'] === 'blue' ? $fixture->home_club_id : $fixture->away_club_id) === $club->id)->count();
        return [...$this->club($club), 'manager'=>\App\Models\User::find($club->user_id)?->only(['id','name']), 'roster' => $roster, 'tournaments' => $events,
            'record' => ['played' => $completed->count(), 'wins' => $wins, 'losses' => $completed->count() - $wins],
            'fixtures' => $this->fixtures($base()->orderByDesc('kickoff_at'))];
    }

    private function tournamentArticle(string $id): array
    {
        $event = ClubTournament::findOrFail($id);
        $clubs = OnlineClub::whereIn('id', DB::table('club_tournament_entries')->where('tournament_id', $event->id)->select('club_id'))->orderBy('name')->get();
        $rosters = $this->publicRosters($clubs);
        $teams = $clubs->map(fn ($club) => [...$this->club($club), 'roster' => $rosters[$club->id] ?? []]);
        return [...$this->tournament($event), 'teams' => $teams,
            'talent'=>DB::table('fixture_talent_assignments as a')->join('world_media_personalities as t','t.id','=','a.talent_id')->whereIn('a.fixture_id',$event->fixtures()->select('id'))->distinct()->get(['t.id','t.name','t.role']),
            'fixtures' => $this->fixtures($event->fixtures()->orderBy('bracket_slot')),
            'champion' => $event->champion_id ? $this->club(OnlineClub::findOrFail($event->champion_id)) : null];
    }

    private function publicRosters(Collection $clubs): array
    {
        $cards = OwnedPlayerCard::whereIn('user_id', $clubs->pluck('user_id'))->where('catalog_id', $this->catalog()?->id)
            ->get()->groupBy('user_id');
        return $clubs->mapWithKeys(fn ($club) => [$club->id => ($cards[$club->user_id] ?? collect())
            ->filter(fn ($card) => $this->worldPlayer($card)!==null)
            ->map(fn ($card) => ['player' => $this->worldPlayer($card), 'training_xp' => (int) $card->training_xp])->values()])->all();
    }

    private function playerArticle(string $id): array
    {
        $owned=OwnedPlayerCard::withoutGlobalScopes()->whereKey($id)->first();
        if(!$owned)$owned=OwnedPlayerCard::withoutGlobalScopes()->where('original_identity',$id)->first(); // saved pre-migration named-player links
        $player = $owned ? $this->worldPlayer($owned) : null;
        abort_if($player === null, 404);
        $teams = $owned->retired_at?collect():OnlineClub::whereNotNull('tag')->where('user_id',$owned->user_id)->get()->map(fn ($club) => $this->club($club));
        $nationality=DB::table('player_national_eligibilities as e')->join('competition_geographies as g','g.id','=','e.geography_id')->where('e.player_id',$owned->id)->get(['g.code','g.name']);
        return [...$player, 'nationalities'=>$nationality, 'international_appearances'=>DB::table('international_appearances')->where('player_id',$owned->id)->count(),
            'dossier'=>app(PlayerRecordBook::class)->summary($owned->id),'coverage'=>DB::table('world_news_posts')->where('facts->player_id',$owned->id)->whereNull('hidden_at')->orderByDesc('published_at')->limit(20)->get(['id','headline','body','kind','published_at']),'career'=>app(PlayerCareer::class)->show($owned),'teams' => $teams, 'signature_avatars' => $this->avatars()->whereIn('id', $player['signature_avatar_ids'])->values(), ...$this->appearances('instance', $owned->id)];
    }

    private function avatarArticle(string $id): array
    {
        $avatar = $this->avatars()->firstWhere('id', $id);
        abort_if($avatar === null, 404);
        return [...$avatar, 'signature_players' => $this->players()->filter(fn ($player) => in_array($id, $player['signature_avatar_ids'], true))->values(), ...$this->appearances('champion', $id)];
    }

    private function appearances(string $field, string $id): array
    {
        $stats = ['appearances' => 0, 'wins' => 0, 'losses' => 0, 'minutes' => 0];
        $fixtureIds = [];
        $query=$this->fixtureQuery()->whereHas('match', fn ($query) => $query->where('status', 'completed'));
        if($field==='instance')$query->whereIn('match_id',DB::table('club_training_sessions')->where('card_id',$id)->select('match_id'));
        $query->with('match:id,result,plan')->chunkById(100, function ($fixtures) use (&$stats, &$fixtureIds, $field, $id) {
            foreach ($fixtures as $fixture) {
                $report = $fixture->match->result['report'];
                foreach (['blue', 'red'] as $side) foreach ($report['draft'][$side] ?? [] as $index=>$slot) {
                    if ($field==='instance' ? (($fixture->match->plan[$side][$index]['instance_id']??null)!==$id) : (($slot[$field]['id'] ?? null) !== $id)) continue;
                    $stats['appearances']++;
                    $stats[$report['winner'] === $side ? 'wins' : 'losses']++;
                    $stats['minutes'] += ($report['durationSeconds'] ?? 0) / 60;
                    $fixtureIds[] = $fixture->id;
                }
            }
        });
        $stats['minutes'] = round($stats['minutes'], 1);
        return ['statistics' => $stats, 'fixtures' => $this->fixtures($this->fixtureQuery()->whereIn('id', array_unique($fixtureIds))->orderByDesc('kickoff_at'), 30)];
    }

    private function standings(): array
    {
        $year = now('Asia/Manila')->startOfYear();
        $tables = [];
        $this->fixtureQuery()->whereIn('tournament_id',ClubTournament::where('provenance','verified')->whereIn('definition_id',\App\Models\CompetitionDefinition::where('category','regional_league')->select('id'))->select('id'))
            ->where('kickoff_at', '>=', $year->copy()->utc())->where('kickoff_at', '<', $year->copy()->addYear()->utc())
            ->whereHas('match', fn ($query) => $query->where('status', 'completed'))
            ->with(['homeClub:id,name', 'awayClub:id,name', 'match:id,result'])->chunkById(100, function ($fixtures) use (&$tables) {
                foreach ($fixtures as $fixture) foreach (['blue' => $fixture->homeClub, 'red' => $fixture->awayClub] as $side => $club) {
                    $row = &$tables[$fixture->competition][$club->id];
                    $row ??= ['id' => $club->id, 'name' => $club->name, 'wins' => 0, 'losses' => 0];
                    $row[$side === $fixture->match->result['winner'] ? 'wins' : 'losses']++;
                    unset($row);
                }
            });
        return collect($tables)->map(fn ($clubs, $competition) => ['competition' => $competition, 'year' => $year->year,
            'clubs' => collect($clubs)->sortBy([['wins', 'desc'], ['losses', 'asc'], ['name', 'asc']])->values()])->values()->all();
    }
}
