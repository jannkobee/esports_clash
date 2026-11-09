<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up():void{
        Schema::table('player_progress_snapshots',fn(Blueprint $t)=>$t->timestampTz('media_reviewed_at')->nullable()->index());
        Schema::create('world_media_reports',function(Blueprint $t){$t->id();$t->foreignId('post_id')->constrained('world_news_posts');$t->foreignId('comment_id')->nullable()->constrained('world_news_comments');$t->foreignId('user_id')->constrained('users');$t->string('target_key',50);$t->string('reason',30);$t->string('detail',500)->nullable();$t->string('status',20)->default('open')->index();$t->string('resolution',20)->nullable();$t->foreignId('reviewer_id')->nullable()->constrained('users');$t->timestampTz('created_at');$t->timestampTz('reviewed_at')->nullable();$t->unique(['user_id','target_key']);});
    }
    public function down():void{throw new RuntimeException('Social reports and review evidence are retained.');}
};
