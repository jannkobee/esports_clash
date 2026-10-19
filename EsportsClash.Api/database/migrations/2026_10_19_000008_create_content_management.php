<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        Schema::create('managed_contents', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('kind', 16);
            $table->string('source_id')->nullable();
            $table->string('name');
            $table->string('status', 16)->default('draft');
            $table->unsignedInteger('version')->default(1);
            $table->json('payload');
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['kind', 'source_id']);
            $table->index(['kind', 'status']);
        });
        Schema::create('managed_content_revisions', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('content_id')->constrained('managed_contents')->cascadeOnDelete();
            $table->unsignedInteger('version');
            $table->string('action');
            $table->string('status', 16);
            $table->json('payload');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at');
            $table->unique(['content_id', 'version']);
        });
    }
    public function down(): void {
        Schema::dropIfExists('managed_content_revisions');
        Schema::dropIfExists('managed_contents');
    }
};
