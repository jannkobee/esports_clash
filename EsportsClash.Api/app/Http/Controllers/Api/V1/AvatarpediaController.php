<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\{AvatarpediaService, ClubTournamentService, OnlineService};
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class AvatarpediaController extends Controller
{
    public function teamGames(\Illuminate\Http\Request $r,int $id,\App\Services\AvatarpediaService $pedia){
        $v=$r->validate(['kind'=>'nullable|in:all,scrimmages,tournaments','page'=>'nullable|integer|min:1|max:1000000']);
        return ['data'=>$pedia->teamGames($id,$v['kind']??'all',$v['page']??1)];
    }

    public function world(AvatarpediaService $pedia)
    {
        return response()->json(['data' => $pedia->world()])->header('Cache-Control', 'public, max-age=3, stale-while-revalidate=5');
    }

    public function index(AvatarpediaService $pedia)
    {
        return response()->json(['data' => Cache::remember('pedia.home.v3:'.Cache::get('world.public.cache-revision','initial'),5,fn()=>$pedia->index())])->header('Cache-Control', 'public, max-age=3, stale-while-revalidate=5');
    }

    public function directory(Request $request, string $kind, AvatarpediaService $pedia)
    {
        $data = $request->validate(['q' => ['nullable', 'string', 'max:100'], 'page' => ['nullable', 'integer', 'min:1', 'max:1000000'],'per_page'=>'nullable|integer|in:20,30,50','tier'=>'nullable|integer|between:1,5','year'=>'nullable|integer|min:2020|max:2200','status'=>'nullable|string|max:30','nationality'=>'nullable|string|size:2','role'=>'nullable|string|max:40','phase'=>'nullable|in:upcoming,ongoing,finished,review,cancelled','sort'=>'nullable|in:lifecycle,starts_asc,starts_desc,ends_desc,name,prize']);
        return response()->json(['data' => Cache::remember('pedia.dir.v4:'.Cache::get('world.public.cache-revision','initial').':'.hash('sha256',json_encode([$kind,$data])),10,fn()=>$pedia->directory($kind, $data['q'] ?? '', (int) ($data['page'] ?? 1),(int)($data['per_page']??30),$data))])->header('Cache-Control', 'public, max-age=3, stale-while-revalidate=5');
    }

    public function search(Request $request, AvatarpediaService $pedia)
    {
        $data = $request->validate(['q' => ['required', 'string', 'min:2', 'max:100']]);
        return response()->json(['data' => $pedia->search($data['q'])])->header('Cache-Control', 'public, max-age=3, stale-while-revalidate=5');
    }

    public function article(string $kind, string $id, AvatarpediaService $pedia)
    {
        return response()->json(['data' => Cache::remember('pedia.article.v3:'.Cache::get('world.public.cache-revision','initial').':'.$kind.':'.$id,10,fn()=>$pedia->article($kind,$id))])->header('Cache-Control', 'public, max-age=3, stale-while-revalidate=5');
    }

    public function register(Request $request, int $id, OnlineService $online, ClubTournamentService $events)
    {
        $events->register($id, $online->provision($request->user()));
        return response()->noContent();
    }
}
