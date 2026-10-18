<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BalanceProposal extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return ['changes' => 'array', 'evidence' => 'array', 'evaluation' => 'array'];
    }

    public function immutableManifest(): array
    {
        return ['title' => $this->title, 'baseline_version' => $this->evidence['baseline_version'] ?? null,
            'changes' => $this->changes, 'evidence' => $this->evidence, 'evaluation' => $this->evaluation];
    }

    public function intact(): bool
    {
        return hash_equals($this->manifest_hash, hash('sha256', json_encode($this->immutableManifest(), JSON_THROW_ON_ERROR)));
    }
}
