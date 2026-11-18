import type {ReactNode} from 'react';
import {AppIcon} from './AppIcon';
import type {IconKey} from './icons';

/** Page title block: where you are, what the page is for, and the page's primary actions. */
export function PageHeader({eyebrow, title, icon, description, actions, meta}: {eyebrow?: string; title: ReactNode; icon?: IconKey; description?: ReactNode; actions?: ReactNode; meta?: ReactNode}) {
  return (
    <header className="ui-page-header">
      <div className="ui-page-header__text">
        {eyebrow && <p className="ui-eyebrow">{eyebrow}</p>}
        <h1>{icon && <AppIcon name={icon} size={22} />}{title}</h1>
        {description && <p className="ui-page-header__desc">{description}</p>}
      </div>
      {(actions || meta) && <div className="ui-page-header__aside">{meta && <span className="ui-page-header__meta">{meta}</span>}{actions}</div>}
    </header>
  );
}
