<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** One plain email to a manager: a subject, short paragraphs, one action and a way to change preferences. */
class ManagerMessage extends Notification implements ShouldQueue
{
    use Queueable;

    /** @param string[] $lines */
    public function __construct(public string $subject, public array $lines, public ?string $actionText = null,
        public ?string $actionUrl = null, public ?string $preferencesUrl = null, public ?string $unsubscribeUrl = null) {}

    public function via(object $notifiable): array { return ['mail']; }

    public function toMail(object $notifiable): MailMessage
    {
        $mail = (new MailMessage)->subject($this->subject)->greeting('Hello '.$notifiable->name.',');
        foreach ($this->lines as $line) $mail->line($line);
        if ($this->actionText && $this->actionUrl) $mail->action($this->actionText, $this->actionUrl);
        if ($this->preferencesUrl) $mail->line('Change which emails you receive: '.$this->preferencesUrl);
        if ($this->unsubscribeUrl) $mail->line('Stop emails like this one: '.$this->unsubscribeUrl);
        return $mail->salutation('— Hexatrick');
    }
}
