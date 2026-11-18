import type {ReactNode} from 'react';
import {AlertTriangle, Inbox, RefreshCw} from 'lucide-react';

/** Nothing to show, and what to do about it. */
export function EmptyState({title, children, action}: {title: string; children?: ReactNode; action?: ReactNode}) {
  return (
    <div className="ui-state ui-state--empty">
      <Inbox size={22} strokeWidth={1.6} aria-hidden="true" />
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action && <div className="ui-state__actions">{action}</div>}
    </div>
  );
}

/** A failed request with a retry. */
export function ErrorState({title = 'This could not be loaded', message, onRetry}: {title?: string; message?: string; onRetry?: () => void}) {
  return (
    <div className="ui-state ui-state--error" role="alert">
      <AlertTriangle size={22} strokeWidth={1.6} aria-hidden="true" />
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {onRetry && <div className="ui-state__actions"><button type="button" className="cm-btn" onClick={onRetry}><RefreshCw size={13} aria-hidden="true" />Try again</button></div>}
    </div>
  );
}

/** Placeholder rows while a list loads, so the page keeps its shape. */
export function ListSkeleton({rows = 6, label = 'Loading'}: {rows?: number; label?: string}) {
  return (
    <div className="ui-skeleton" role="status" aria-live="polite" aria-label={label}>
      {Array.from({length: rows}, (_, i) => (
        <div className="ui-skeleton__row" key={i} aria-hidden="true"><span className="ui-skeleton__avatar" /><span className="ui-skeleton__line" style={{width: `${58 + ((i * 17) % 34)}%`}} /></div>
      ))}
      <span className="sr-only">{label}…</span>
    </div>
  );
}
