/** Manila-time formatting and plain-language relative times for matchday screens. */
const TZ = 'Asia/Manila';
const dayFormat = new Intl.DateTimeFormat('en-PH', {timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short'});
const timeFormat = new Intl.DateTimeFormat('en-PH', {timeZone: TZ, hour: 'numeric', minute: '2-digit'});
const fullFormat = new Intl.DateTimeFormat('en-PH', {timeZone: TZ, dateStyle: 'medium', timeStyle: 'short'});

export const matchDay = (iso: string) => dayFormat.format(new Date(iso));
export const matchTime = (iso: string) => timeFormat.format(new Date(iso));
export const matchDateTime = (iso: string) => fullFormat.format(new Date(iso));

/** "in 2 h 15 min", "in 3 days", "20 min ago", "now". */
export function relativeTime(iso: string, now: number): string {
  const diff = Date.parse(iso) - now;
  const abs = Math.abs(diff);
  const minutes = Math.round(abs / 60000);
  let text: string;
  if (minutes < 1) return 'now';
  if (minutes < 60) text = `${minutes} min`;
  else if (minutes < 60 * 24) {
    const h = Math.floor(minutes / 60), m = minutes % 60;
    text = m && h < 6 ? `${h} h ${m} min` : `${Math.round(minutes / 60)} h`;
  } else {
    const days = Math.round(minutes / 1440);
    text = `${days} ${days === 1 ? 'day' : 'days'}`;
  }
  return diff > 0 ? `in ${text}` : `${text} ago`;
}
