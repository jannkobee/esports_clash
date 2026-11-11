<?php
namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;

class ArenaUpdates
{
    public function publish(User $author, array $input): int {
        abort_unless($author->is_evolution_admin,403);
        return DB::transaction(function()use($author,$input){
            $id=DB::table('arena_update_bulletins')->insertGetId([...$input,'author_id'=>$author->id,
                'content_hash'=>hash('sha256',json_encode($input,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)),'published_at'=>now()]);
            DB::table('world_news_posts')->insert(['event_key'=>'arena-update:'.$id,'wire_account_id'=>app(WireAccounts::class)->game(),'kind'=>'arena_update',
                'headline'=>'Arena '.$input['version'].': '.$input['title'],'body'=>$input['body'],'arena_update_id'=>$id,
                'facts'=>json_encode(['provenance'=>'official_arena_announcement','version'=>$input['version'],'release_status'=>$input['status'],'category'=>$input['category'],'implementation_ref'=>$input['implementation_ref']??null]),'published_at'=>now()]);
            DB::table('competition_audits')->insert(['user_id'=>$author->id,'action'=>'arena.announcement.published','subject'=>(string)$id,'details'=>json_encode(['content_hash'=>hash('sha256',json_encode($input)),'engine_changed'=>false]),'created_at'=>now()]);
            return $id;
        },3);
    }
}
