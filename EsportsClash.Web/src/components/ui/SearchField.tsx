import {useId, useRef, type KeyboardEvent, type ReactNode} from 'react';
import {Loader2, Search, X} from 'lucide-react';

export interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Accessible name; shown above the field when `showLabel` is set. */
  label: string;
  placeholder?: string;
  showLabel?: boolean;
  /** A request is in flight. */
  loading?: boolean;
  /** Result summary announced politely and shown under the field ("12 players"). */
  status?: ReactNode;
  maxLength?: number;
  autoFocus?: boolean;
  /** Called on Enter. */
  onSubmit?: (value: string) => void;
  /** Called on Escape when the field is already empty (close a popover, for example). */
  onEscape?: () => void;
  onFocus?: () => void;
  className?: string;
  /** For combobox use: id of the results popup this field controls and whether it is open. */
  controls?: string;
  expanded?: boolean;
  size?: 'md' | 'lg';
}

/**
 * The one search input. Leading icon, visible clear button, Escape to clear, busy state and a status line,
 * styled so that no page-level input rule can push text under the icon.
 */
export function SearchField({
  value, onChange, label, placeholder, showLabel = false, loading = false, status, maxLength = 100, autoFocus,
  onSubmit, onEscape, onFocus, className = '', controls, expanded, size = 'md',
}: SearchFieldProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      if (value) { event.preventDefault(); onChange(''); } else onEscape?.();
    } else if (event.key === 'Enter' && onSubmit) {
      event.preventDefault(); onSubmit(value);
    }
  };
  return (
    <div className={`ui-search ui-search--${size} ${className}`} role="search">
      <label htmlFor={id} className={showLabel ? 'ui-field-label' : 'sr-only'}>{label}</label>
      <div className="ui-search__control">
        <Search className="ui-search__icon" size={size === 'lg' ? 18 : 16} strokeWidth={1.8} aria-hidden="true" />
        <input
          ref={input} id={id} type="text" inputMode="search" enterKeyHint="search" autoComplete="off" spellCheck={false}
          className="ui-search__input" value={value} maxLength={maxLength} placeholder={placeholder ?? label} autoFocus={autoFocus}
          onChange={event => onChange(event.target.value)} onKeyDown={onKey} onFocus={onFocus}
          role={controls ? 'combobox' : undefined} aria-controls={controls} aria-expanded={controls ? !!expanded : undefined}
          aria-busy={loading || undefined}
        />
        {loading && <Loader2 className="ui-search__busy" size={15} aria-hidden="true" />}
        {value && !loading && (
          <button type="button" className="ui-search__clear" aria-label={`Clear ${label.toLowerCase()}`} onClick={() => { onChange(''); input.current?.focus(); }}>
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>
      {status !== undefined && status !== null && <p className="ui-search__status" role="status" aria-live="polite">{status}</p>}
    </div>
  );
}
