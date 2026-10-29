<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\{DB, Schema};
return new class extends Migration {
    public function up(): void {
        Schema::create('game_contents', function (Blueprint $table) {
            $table->string('id', 100)->primary();
            $table->string('kind', 16)->index();
            $table->json('payload');
            $table->unsignedInteger('version')->default(1);
            $table->boolean('builtin')->default(false);
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });
        Schema::create('game_content_revisions', function (Blueprint $table) {
            $table->id();
            $table->string('content_id', 100);
            $table->foreign('content_id')->references('id')->on('game_contents');
            $table->unsignedInteger('version');
            $table->string('action', 16);
            $table->json('payload');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at');
            $table->unique(['content_id', 'version']);
        });
        $source=json_decode(file_get_contents(resource_path('game/editor-catalog.json')),true,flags:JSON_THROW_ON_ERROR);
        foreach($source['records'] as $record) DB::table('game_contents')->insert([
            ...$record,'payload'=>json_encode($record['payload'],JSON_THROW_ON_ERROR),
            'builtin'=>true,'created_at'=>now(),'updated_at'=>now(),
        ]);
    }
    public function down(): void { Schema::dropIfExists('game_content_revisions'); Schema::dropIfExists('game_contents'); }
};
