<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('world_wire_accounts', function (Blueprint $t) {
            $t->id(); $t->string('source_key', 120)->unique(); $t->string('kind', 24)->index(); $t->string('source_id', 80);
            $t->string('name', 160); $t->string('handle', 80)->unique(); $t->string('role', 32); $t->json('profile');
            $t->foreignId('owner_id')->nullable()->constrained('users'); $t->boolean('autonomous')->default(false);
            $t->text('memory')->nullable(); $t->timestampTz('last_post_at')->nullable(); $t->timestampsTz();
        });
        Schema::create('arena_update_bulletins', function (Blueprint $t) {
            $t->id(); $t->string('version', 60); $t->string('title', 180); $t->string('category', 24);
            $t->string('status', 24); $t->text('body'); $t->string('implementation_ref', 200)->nullable();
            $t->foreignId('author_id')->constrained('users'); $t->string('content_hash', 64); $t->timestampTz('published_at');
            $t->unique('version');
        });
        Schema::table('world_news_posts', function (Blueprint $t) {
            $t->foreignId('wire_account_id')->nullable()->constrained('world_wire_accounts');
            $t->foreignId('source_post_id')->nullable()->constrained('world_news_posts');
            $t->foreignId('arena_update_id')->nullable()->constrained('arena_update_bulletins');
        });
        Schema::create('world_voice_attempts', function (Blueprint $t) {
            $t->id(); $t->foreignId('account_id')->constrained('world_wire_accounts'); $t->foreignId('source_post_id')->constrained('world_news_posts');
            $t->string('status', 24); $t->string('reason', 160)->nullable(); $t->string('model', 80); $t->string('prompt_hash', 64)->nullable();
            $t->unsignedInteger('input_tokens')->default(0); $t->unsignedInteger('output_tokens')->default(0); $t->timestampTz('created_at'); $t->timestampTz('completed_at')->nullable();
            $t->unique(['account_id','source_post_id']); $t->index(['status','created_at']);
        });
    }
    public function down(): void { throw new RuntimeException('Wire identity and published opinions require a reviewed rollback.'); }
};
