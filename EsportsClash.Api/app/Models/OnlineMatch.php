<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OnlineMatch extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';
    protected $guarded = [];
    protected function casts(): array { return ['plan' => 'array', 'result' => 'array', 'started_at' => 'immutable_datetime', 'completed_at' => 'immutable_datetime', 'spectator_ready' => 'boolean']; }

    public function toArray(): array
    {
        $out=parent::toArray();
        unset($out['plan']['fps_identity']);
        unset($out['result']['report']['identityExperiment'],$out['result']['report']['identityDevelopment']);
        return $out;
    }

    public function isBeforeKickoff(): bool
    {
        $kickoff = $this->plan['fixture']['kickoff_at'] ?? null;
        return $kickoff !== null && \Illuminate\Support\Carbon::parse($kickoff)->isFuture();
    }

    public function belongsToParticipant(int $userId): bool
    {
        return in_array($userId, [$this->blue_user_id, $this->red_user_id], true);
    }

    public function canSpectate(): bool
    {
        return $this->spectator_ready && isset($this->plan['fixture']) && ! $this->isBeforeKickoff()
            && in_array($this->status, ['running', 'completed', 'interrupted'], true);
    }
}
