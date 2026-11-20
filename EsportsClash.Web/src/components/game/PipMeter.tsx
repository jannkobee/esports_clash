import type {CSSProperties} from 'react';
import './game.css';

/** A labelled count shown as lit pips: "T positions 3 / 5". */
export function PipMeter({label, value, max = 5, color}: {label: string; value: number; max?: number; color?: string}) {
  return (
    <div className="pip-meter" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <div className="pip-meter__head"><span>{label}</span><b>{value} / {max}</b></div>
      <div className="pip-meter__pips" style={{'--pips': max, ...(color ? {'--pip': color} : {})} as CSSProperties}>
        {Array.from({length: max}, (_, i) => <span key={i} className={i < value ? 'is-on' : ''} />)}
      </div>
    </div>
  );
}
