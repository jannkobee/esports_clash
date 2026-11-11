<?php
namespace App\Services;

use Illuminate\Support\Carbon;

/** Read projection only: retained posts and their provenance remain untouched. */
class WorldNewsPresentation
{
    public function body(string $body): string
    {
        $body=preg_replace('/^Published registration event\. Registration closes /','Registration notice. Entry deadline: ',$body);
        $body=preg_replace('/^Published active event\. Registration closes /','Competition update. Entry deadline: ',$body);
        return preg_replace_callback('/\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?\b/', function ($match) {
            try { return Carbon::parse($match[0], 'UTC')->timezone('Asia/Manila')->format('j M Y, g:i A').' Manila'; }
            catch (\Throwable) { return $match[0]; }
        }, $body);
    }
}
