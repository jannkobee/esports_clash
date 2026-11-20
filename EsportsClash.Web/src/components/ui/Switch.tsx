import {useId, type ReactNode} from 'react';

/** One on/off setting: its name, what it does, and a real switch control. */
export function Switch({checked, onChange, label, description, disabled}: {checked: boolean; onChange: (next: boolean) => void; label: ReactNode; description?: ReactNode; disabled?: boolean}) {
  const id = useId();
  return (
    <div className={`ui-switch-row${disabled ? ' is-disabled' : ''}`}>
      <div className="ui-switch-row__text">
        <span id={id + 'label'} className="ui-switch-row__label">{label}</span>
        {description && <span id={id + 'desc'} className="ui-switch-row__desc">{description}</span>}
      </div>
      <button type="button" role="switch" className="ui-switch" aria-checked={checked} aria-labelledby={id + 'label'} aria-describedby={description ? id + 'desc' : undefined} disabled={disabled} onClick={() => onChange(!checked)}>
        <span className="ui-switch__thumb" aria-hidden="true" />
      </button>
    </div>
  );
}
