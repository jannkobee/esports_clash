<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up():void {
        Schema::table('club_tournaments',function(Blueprint $t){$t->string('provenance',24)->default('verified')->index();});
        Schema::table('competition_year_records',function(Blueprint $t){$t->json('calendar_plan')->nullable();$t->string('calendar_hash',64)->nullable();$t->timestampTz('published_at')->nullable();$t->timestampTz('play_opens_at')->nullable();});
        Schema::create('launch_history_games',function(Blueprint $t){
            $t->id();$t->foreignId('tournament_id')->constrained('club_tournaments');$t->unsignedInteger('slot');$t->unsignedSmallInteger('round');$t->string('phase',24);$t->string('group_key',8)->nullable();
            $t->foreignId('home_club_id')->nullable()->constrained('online_clubs');$t->foreignId('away_club_id')->nullable()->constrained('online_clubs');$t->timestampTz('scheduled_at')->index();
            $t->string('status',24)->default('waiting')->index();$t->uuid('run_id')->nullable()->unique();$t->json('allocation')->nullable();$t->string('allocation_hash',64)->nullable();
            $t->json('report')->nullable();$t->string('report_hash',64)->nullable();$t->foreignId('winner_id')->nullable()->constrained('online_clubs');$t->foreignId('fixture_id')->nullable()->unique()->constrained('club_fixtures');
            $t->timestampTz('generated_at')->nullable();$t->string('error',500)->nullable();$t->unique(['tournament_id','slot']);
        });
        Schema::create('world_media_personalities',function(Blueprint $t){$t->id();$t->string('slug',60)->unique();$t->string('name',80);$t->string('role',30);$t->string('style',80);$t->text('bio');});
        Schema::create('world_news_posts',function(Blueprint $t){
            $t->id();$t->string('event_key',180)->unique();$t->foreignId('personality_id')->nullable()->constrained('world_media_personalities');$t->foreignId('author_id')->nullable()->constrained('users');
            $t->string('kind',30);$t->string('headline',200);$t->text('body');$t->json('facts')->nullable();$t->foreignId('tournament_id')->nullable()->constrained('club_tournaments');
            $t->foreignUuid('match_id')->nullable()->constrained('online_matches');$t->foreignId('launch_game_id')->nullable()->constrained('launch_history_games');$t->timestampTz('published_at')->index();$t->timestampTz('hidden_at')->nullable();
        });
        Schema::create('world_news_comments',function(Blueprint $t){$t->id();$t->foreignId('post_id')->constrained('world_news_posts');$t->foreignId('user_id')->constrained('users');$t->text('body');$t->timestampTz('created_at');$t->timestampTz('hidden_at')->nullable();$t->index(['post_id','id']);});
        Schema::create('world_broadcast_presence',function(Blueprint $t){$t->id();$t->foreignUuid('match_id')->constrained('online_matches');$t->string('viewer_hash',64);$t->timestampTz('seen_at')->index();$t->unique(['match_id','viewer_hash']);});
    }
    public function down():void{throw new RuntimeException('Published launch history and social records require a reviewed rollback.');}
};
