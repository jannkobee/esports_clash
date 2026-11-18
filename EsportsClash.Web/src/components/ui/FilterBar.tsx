import type {ReactNode} from 'react';
import {FilterX} from 'lucide-react';

/** A labelled select with a consistent look: the label sits above the control. */
export function SelectField({label, value, onChange, children, disabled}: {label: string; value: string | number; onChange: (value: string) => void; children: ReactNode; disabled?: boolean}) {
  return (
    <label className="ui-select-field">
      <span className="ui-field-label">{label}</span>
      <select value={value} disabled={disabled} onChange={e => onChange(e.target.value)}>{children}</select>
    </label>
  );
}

/**
 * Search, filters and the result count in one aligned row, with Clear filters shown only when something is active.
 * Pass the search field first, then the filters.
 */
export function FilterBar({children, count, active, onClear}: {children: ReactNode; count?: ReactNode; active?: boolean; onClear?: () => void}) {
  return (
    <div className="ui-filter-bar" role="group" aria-label="Search and filters">
      <div className="ui-filter-bar__controls">{children}</div>
      <div className="ui-filter-bar__meta">
        {count !== undefined && count !== null && <span className="ui-filter-bar__count" role="status" aria-live="polite">{count}</span>}
        {active && onClear && <button type="button" className="cm-btn cm-btn-ghost cm-btn-sm" onClick={onClear}><FilterX size={13} aria-hidden="true" />Clear filters</button>}
      </div>
    </div>
  );
}
