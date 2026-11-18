import {ICONS, type IconKey} from './icons';

/** The registered icon for a destination. Decorative: the visible label carries the meaning. */
export function AppIcon({name, size = 16, className}: {name: IconKey; size?: number; className?: string}) {
  const Icon = ICONS[name];
  return <Icon size={size} strokeWidth={1.8} aria-hidden="true" focusable="false" className={className ?? 'ui-icon'} />;
}
