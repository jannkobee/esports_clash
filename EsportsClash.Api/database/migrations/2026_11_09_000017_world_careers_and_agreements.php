<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('world_agents',function(Blueprint $t){
            $t->uuid('id')->primary();$t->string('source_key',160)->unique();$t->string('source_id',100);$t->string('kind',24);$t->string('name',160);$t->string('profession',40)->index();
            $t->foreignId('club_id')->nullable()->constrained('online_clubs');$t->foreignId('wire_account_id')->nullable()->constrained('world_wire_accounts');
            $t->string('status',24)->default('available');$t->json('skills');$t->json('traits');$t->json('goals');$t->json('policy');$t->unsignedInteger('policy_version')->default(1);$t->unsignedInteger('experience')->default(0);
            $t->timestampTz('review_at')->nullable()->index();$t->timestampsTz();$t->index(['status','profession']);$t->index(['club_id','profession','status']);
        });
        Schema::create('world_agent_memories',function(Blueprint $t){
            $t->id();$t->uuid('agent_id');$t->foreign('agent_id')->references('id')->on('world_agents');$t->string('cause_key',180);$t->string('kind',40);$t->string('outcome',32);
            $t->decimal('confidence',5,4);$t->decimal('salience',5,4);$t->json('facts');$t->timestampTz('observed_at');$t->unique(['agent_id','cause_key']);$t->index(['agent_id','observed_at']);
        });
        Schema::create('world_agent_relationships',function(Blueprint $t){
            $t->id();$t->uuid('agent_id');$t->foreign('agent_id')->references('id')->on('world_agents');$t->string('subject_key',100);$t->decimal('trust',6,4)->default(0);$t->decimal('respect',6,4)->default(0);$t->unsignedInteger('interactions')->default(0);$t->timestampTz('updated_at');$t->unique(['agent_id','subject_key']);
        });
        Schema::create('world_employments',function(Blueprint $t){
            $t->id();$t->uuid('agent_id');$t->foreign('agent_id')->references('id')->on('world_agents');$t->uuid('active_agent_id')->nullable()->unique();$t->foreignId('club_id')->nullable()->constrained('online_clubs');
            $t->string('profession',40);$t->string('source_key',160)->unique();$t->timestampTz('starts_at');$t->timestampTz('ends_at')->nullable();$t->string('end_reason',40)->nullable();$t->json('terms');$t->index(['agent_id','starts_at']);
        });
        Schema::create('world_vacancies',function(Blueprint $t){
            $t->id();$t->foreignId('club_id')->constrained('online_clubs');$t->string('role',40);$t->string('open_key',100)->nullable()->unique();$t->unsignedBigInteger('weekly_salary');$t->unsignedTinyInteger('weeks');$t->unsignedTinyInteger('minimum_skill');$t->string('status',24)->default('open');$t->unsignedInteger('management_epoch');$t->boolean('autonomous')->default(false);$t->timestampTz('expires_at')->index();$t->timestampTz('review_at')->nullable()->index();$t->timestampsTz();
        });
        Schema::create('world_applications',function(Blueprint $t){$t->id();$t->foreignId('vacancy_id')->constrained('world_vacancies');$t->uuid('agent_id');$t->foreign('agent_id')->references('id')->on('world_agents');$t->decimal('utility',8,4);$t->json('reasons');$t->string('status',24);$t->timestampTz('created_at');$t->unique(['vacancy_id','agent_id']);});
        Schema::create('world_negotiations',function(Blueprint $t){
            $t->id();$t->string('request_key',160)->unique();$t->string('kind',32);$t->foreignId('club_id')->constrained('online_clubs');$t->uuid('agent_id');$t->foreign('agent_id')->references('id')->on('world_agents');$t->uuid('player_id')->nullable();$t->foreign('player_id')->references('id')->on('owned_player_cards');$t->foreignId('vacancy_id')->nullable()->constrained('world_vacancies');
            $t->string('status',24)->default('pending');$t->json('offer');$t->json('counter')->nullable();$t->json('evaluation')->nullable();$t->unsignedTinyInteger('round')->default(0);$t->unsignedInteger('management_epoch');$t->boolean('autonomous')->default(false);$t->timestampTz('review_at')->index();$t->timestampTz('expires_at')->index();$t->timestampTz('resolved_at')->nullable();$t->timestampsTz();$t->index(['club_id','status']);
        });
        Schema::create('world_player_terms',function(Blueprint $t){
            $t->id();$t->uuid('player_id');$t->foreign('player_id')->references('id')->on('owned_player_cards');$t->uuid('active_player_id')->nullable()->unique();$t->foreignId('club_id')->constrained('online_clubs');$t->foreignId('negotiation_id')->nullable()->unique()->constrained('world_negotiations');$t->unsignedBigInteger('weekly_salary');$t->string('playing_time',24);$t->string('status',24);$t->timestampTz('starts_at');$t->timestampTz('ends_at')->nullable();$t->timestampTz('ended_at')->nullable();$t->index(['club_id','status']);
        });
        Schema::create('world_representation',function(Blueprint $t){$t->id();$t->uuid('player_agent_id')->unique();$t->foreign('player_agent_id')->references('id')->on('world_agents');$t->uuid('representative_id');$t->foreign('representative_id')->references('id')->on('world_agents');$t->json('mandate');$t->timestampTz('starts_at');$t->timestampTz('ends_at')->nullable();});
        Schema::create('world_free_agents',function(Blueprint $t){$t->uuid('player_id')->primary();$t->foreign('player_id')->references('id')->on('owned_player_cards');$t->foreignId('released_from')->constrained('online_clubs');$t->unsignedBigInteger('previous_weekly_salary');$t->unsignedBigInteger('compensation');$t->string('status',24)->index();$t->timestampTz('available_at')->index();$t->timestampTz('signed_at')->nullable();});
        Schema::create('world_registry_accounts',function(Blueprint $t){$t->string('role',40)->primary();$t->foreignId('user_id')->unique()->constrained('users');$t->timestampTz('created_at');});
        Schema::create('world_sponsors',function(Blueprint $t){$t->id();$t->string('slug')->unique();$t->string('name');$t->string('objective',32);$t->json('preferences');$t->timestampsTz();});
        Schema::create('world_sponsor_entries',function(Blueprint $t){$t->id();$t->foreignId('sponsor_id')->constrained('world_sponsors');$t->string('reference',160)->unique();$t->string('kind',40);$t->bigInteger('amount');$t->timestampTz('created_at');$t->index(['sponsor_id','created_at']);});
        Schema::create('world_sponsor_deals',function(Blueprint $t){
            $t->id();$t->foreignId('sponsor_id')->constrained('world_sponsors');$t->foreignId('club_id')->constrained('online_clubs');$t->string('active_club_key',60)->nullable()->unique();$t->string('request_key',160)->unique();$t->string('status',24);$t->unsignedInteger('management_epoch');$t->boolean('autonomous');$t->unsignedBigInteger('weekly_amount');$t->unsignedBigInteger('reserved_amount')->default(0);$t->unsignedBigInteger('paid_amount')->default(0);$t->unsignedTinyInteger('weeks');$t->json('assessment');$t->timestampTz('starts_at')->nullable();$t->timestampTz('ends_at')->nullable();$t->timestampTz('next_payment_at')->nullable()->index();$t->timestampTz('expires_at');$t->timestampsTz();
        });
        Schema::create('world_delegations',function(Blueprint $t){$t->id();$t->foreignId('club_id')->constrained('online_clubs');$t->string('scope',32);$t->boolean('enabled');$t->boolean('automatic');$t->unsignedBigInteger('weekly_limit')->default(0);$t->unsignedSmallInteger('inactive_days')->default(0);$t->unsignedInteger('management_epoch');$t->timestampTz('review_at')->nullable()->index();$t->timestampsTz();$t->unique(['club_id','scope']);});
        Schema::create('world_recommendations',function(Blueprint $t){$t->id();$t->foreignId('club_id')->constrained('online_clubs');$t->string('cause_key',160)->unique();$t->string('scope',32);$t->string('action',32);$t->json('proposal');$t->json('diagnostics');$t->string('status',24);$t->unsignedInteger('management_epoch');$t->unsignedInteger('club_revision');$t->unsignedBigInteger('commitment_cost')->default(0);$t->timestampTz('expires_at')->index();$t->timestampTz('resolved_at')->nullable();$t->timestampsTz();});
        Schema::create('world_permission_history',function(Blueprint $t){$t->id();$t->foreignId('club_id')->constrained('online_clubs');$t->foreignId('changed_by')->constrained('users');$t->string('scope',32);$t->json('previous')->nullable();$t->json('current');$t->string('reason',40);$t->timestampTz('created_at');$t->index(['club_id','created_at']);});
        Schema::create('world_delegated_spending',function(Blueprint $t){$t->id();$t->foreignId('club_id')->constrained('online_clubs');$t->foreignId('recommendation_id')->unique()->constrained('world_recommendations');$t->string('scope',32);$t->unsignedBigInteger('amount');$t->timestampTz('created_at');$t->index(['club_id','scope','created_at']);});
        Schema::table('online_clubs',function(Blueprint $t){$t->timestampTz('manager_seen_at')->nullable();$t->timestampTz('world_career_review_at')->nullable()->index();});
        Schema::table('club_auctions',function(Blueprint $t){$t->foreignId('career_negotiation_id')->nullable()->constrained('world_negotiations');});
        Schema::table('club_trade_proposals',function(Blueprint $t){$t->unsignedInteger('proposer_epoch')->default(0);$t->unsignedInteger('recipient_epoch')->default(0);});
        Schema::table('living_world_runtime',function(Blueprint $t){$t->unsignedBigInteger('agent_cursor')->default(0);$t->timestampTz('last_career_sync_at')->nullable();$t->timestampTz('careers_activated_at')->nullable();});
        \Illuminate\Support\Facades\DB::table('living_world_runtime')->update(['careers_activated_at'=>now()]);
    }
    public function down(): void { /* Employment, financial and consent history is retained. */ }
};
