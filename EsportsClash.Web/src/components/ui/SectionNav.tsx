import type {ReactNode} from 'react';
import {AppIcon} from './AppIcon';
import type {IconKey} from './icons';

export interface SectionNavItem {key: string; label: string; href: string; icon: IconKey; current?: boolean; badge?: ReactNode}
export interface SectionNavGroup {id: string; label: string; description?: string; items: SectionNavItem[]}

/**
 * Two-tier navigation for large page families: a short row of groups, then only the active group's pages.
 * Replaces long wrapping tab rows. Every item has its own icon; the current page is marked with aria-current.
 */
export function SectionNav({label, groups, activeGroup}: {label: string; groups: SectionNavGroup[]; activeGroup: string}) {
  const group = groups.find(g => g.id === activeGroup) ?? groups[0];
  return (
    <div className="ui-section-nav">
      <nav className="ui-section-nav__groups" aria-label={`${label} groups`}>
        {groups.map(g => (
          <a key={g.id} href={g.items[0]?.href} className="ui-section-nav__group" aria-current={g.id === group.id ? 'true' : undefined}>
            <strong>{g.label}</strong>
            {g.description && <small>{g.description}</small>}
          </a>
        ))}
      </nav>
      <nav className="ui-section-nav__items" aria-label={`${label}: ${group.label}`}>
        {group.items.map(item => (
          <a key={item.key} href={item.href} className="ui-section-nav__item" aria-current={item.current ? 'page' : undefined}>
            <AppIcon name={item.icon} size={15} />
            <span>{item.label}</span>
            {item.badge}
          </a>
        ))}
      </nav>
    </div>
  );
}
