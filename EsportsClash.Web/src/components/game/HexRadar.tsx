import {ATTRIBUTES, type AttributeKey} from './positions';
import './game.css';

/**
 * Six attributes on a hexagon (1–10). An optional comparison shape (dashed) shows what a player would change,
 * for example a transfer target against your current five.
 */
export function HexRadar({values, compare, size = 120, labels = false, tone = 'accent', className = ''}: {
  values: Partial<Record<AttributeKey, number>>;
  compare?: Partial<Record<AttributeKey, number>>;
  size?: number;
  labels?: boolean;
  tone?: string;
  className?: string;
}) {
  const pad = labels ? 22 : 4, r = size / 2 - pad, c = size / 2;
  const point = (i: number, level: number) => {
    const angle = -Math.PI / 2 + (i * Math.PI) / 3;
    const d = (Math.max(0, Math.min(10, level)) / 10) * r;
    return [c + d * Math.cos(angle), c + d * Math.sin(angle)] as const;
  };
  const shape = (v: Partial<Record<AttributeKey, number>>) => ATTRIBUTES.map((a, i) => point(i, v[a.key] ?? 0).join(',')).join(' ');
  const ring = (level: number) => ATTRIBUTES.map((_, i) => point(i, level).join(',')).join(' ');
  const summary = ATTRIBUTES.map(a => `${a.label} ${values[a.key] ?? 'unknown'}`).join(', ');
  return (
    <svg className={`hex-radar hex-radar--${tone} ${className}`} width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Attributes: ${summary}`}>
      {[10, 7.5, 5, 2.5].map(level => <polygon key={level} className={'hex-radar__ring' + (level === 10 ? ' is-outer' : '')} points={ring(level)} />)}
      {ATTRIBUTES.map((_, i) => { const [x, y] = point(i, 10); return <line key={i} className="hex-radar__axis" x1={c} y1={c} x2={x} y2={y} />; })}
      {compare && <polygon className="hex-radar__compare" points={shape(compare)} />}
      <polygon className="hex-radar__shape" points={shape(values)} style={{transformOrigin: `${c}px ${c}px`}} />
      {ATTRIBUTES.map((a, i) => { const v = values[a.key]; if (v == null) return null; const [x, y] = point(i, v); return <circle key={a.key} className="hex-radar__dot" cx={x} cy={y} r={size > 100 ? 2.6 : 1.8} style={{transformOrigin: `${c}px ${c}px`}} />; })}
      {labels && ATTRIBUTES.map((a, i) => {
        const [x, y] = point(i, 12.6);
        const delta = compare && values[a.key] != null && compare[a.key] != null ? values[a.key]! - compare[a.key]! : 0;
        return <text key={a.key} className="hex-radar__label" x={x} y={y} textAnchor="middle" dominantBaseline="middle">
          {a.short}<tspan className="hex-radar__value" dx="3">{values[a.key] == null ? '–' : Number.isInteger(values[a.key]) ? values[a.key] : values[a.key]!.toFixed(1)}</tspan>
          {delta !== 0 && <tspan className={delta > 0 ? 'hex-radar__up' : 'hex-radar__down'} dx="2">{delta > 0 ? '▲' : '▼'}</tspan>}
        </text>;
      })}
    </svg>
  );
}
