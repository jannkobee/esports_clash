<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('world_voice_states',function(Blueprint $t){
            $t->foreignId('account_id')->primary()->constrained('world_wire_accounts');
            $t->string('engine',32);$t->json('traits');$t->json('mood');$t->json('interests');$t->json('goals');
            $t->string('current_goal',48)->nullable();$t->unsignedInteger('observations')->default(0);$t->timestampTz('updated_at');
        });
        Schema::create('world_voice_memories',function(Blueprint $t){
            $t->id();$t->foreignId('account_id')->constrained('world_wire_accounts');$t->foreignId('source_post_id')->constrained('world_news_posts');
            $t->foreignId('post_id')->nullable()->constrained('world_news_posts');$t->string('topic_key',180)->index();
            $t->string('event_type',32);$t->string('intent',32);$t->string('goal',48);$t->string('outcome',24);
            $t->string('reason',80);$t->float('salience');$t->json('composition')->nullable();$t->string('body_hash',64)->nullable()->index();
            $t->timestampTz('observed_at')->index();$t->unique(['account_id','source_post_id']);$t->index(['account_id','topic_key']);
        });
        Schema::create('world_voice_relationships',function(Blueprint $t){
            $t->id();$t->foreignId('account_id')->constrained('world_wire_accounts');$t->string('subject_kind',24);$t->string('subject_id',80);
            $t->unsignedInteger('observations')->default(0);$t->float('attention')->default(0);$t->timestampTz('last_observed_at');
            $t->unique(['account_id','subject_kind','subject_id'],'voice_relationship_identity');
        });
    }
    public function down(): void { throw new RuntimeException('Published world memories require a reviewed rollback.'); }
};
