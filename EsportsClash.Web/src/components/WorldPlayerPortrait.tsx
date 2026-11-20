import {useId} from 'react';
import type {PlayerAppearance} from '../supporter';

const SKIN = ['#f3ccaa', '#dfae85', '#c88e64', '#ad7050', '#88533d', '#603f34'];
const SKIN_SHADE = ['#d6a47f', '#c08c63', '#a5704a', '#8a573b', '#6a3f2d', '#472c23'];
const HAIR = ['#272527', '#52382b', '#805237', '#d6b16b', '#4a4442', '#ad6742'];
const ACCENTS = ['#70e1d0', '#f0b765', '#8bb7ff', '#e38ac8', '#c9e475'];
const IRIS = ['#5b3a24', '#3b2a1e', '#4a6b8a', '#55724a', '#7a5a2e'];

/** Seven hairstyles, in the order Supporter studio names them: Crop, Spikes, Sweep, Curls, Short, Fringe, Classic. */
function Hair({style, color, highlight}: {style: number; color: string; highlight: string}) {
  const shapes = [
    'M37 55C35 31 47 20 60 20s25 11 23 35c-3-10-7-16-13-18-6 4-16 4-22 0-6 3-9 9-11 18Z',
    'M36 55c-1-14 2-24 8-29l-2-12 10 8 4-12 6 11 8-10 1 12 9-6-2 12c5 7 7 16 6 25-4-12-10-17-24-18-13 1-20 6-24 19Z',
    'M36 59C34 34 46 19 62 19c16 0 24 12 22 33-4-12-14-16-26-12-8 3-14 8-18 19Zm4-9c8-14 26-18 40-10-10-6-26-4-40 10Z',
    'M35 57c-5-10-1-18 5-20-2-9 6-14 12-12 3-7 14-7 17-1 7-3 15 4 13 12 6 4 7 13 2 21-2-10-8-16-14-15-4-4-14-4-20 0-6-2-12 5-15 15Z',
    'M38 51c0-18 10-28 22-28s22 10 22 28c-4-10-12-16-22-16s-18 6-22 16Z',
    'M34 71c-4-24 4-51 26-52 22 1 30 28 26 52h-4c0-16-2-24-6-28-10 6-24 6-32 0-4 4-6 12-6 28Z',
    'M36 57c-1-24 11-37 24-37 15 0 25 11 24 37-2-12-6-18-12-20H56c-6 2-12 4-16 10-2 3-3 6-4 10Z',
  ];
  const d = shapes[style] ?? shapes[0];
  return <g>
    <path d={d} fill={color} />
    <path d={d} fill={`url(#${highlight})`} />
    {style === 6 && <path d="M56 37c-3 3-5 7-6 12" fill="none" stroke="rgba(0,0,0,.25)" strokeWidth="1.2" strokeLinecap="round" />}
    {style === 4 && <path d={d} fill="rgba(0,0,0,.12)" />}
  </g>;
}

/**
 * Original illustrated player portrait on a transparent background. Every feature comes from the player ID, and
 * Supporter presentation (skin, hair, style, glasses, headset, jersey, trim) overrides it.
 */
export function WorldPlayerPortrait({id, name, size = 96, jersey = '#39728c', appearance = {}}: {id: string; name: string; size?: number; jersey?: string; appearance?: PlayerAppearance}) {
  let seed = 2166136261; for (const c of id) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619) >>> 0;
  const pick = (offset: number, count: number) => (seed >>> offset) % count;
  const skinIndex = appearance.skin ?? pick(0, 6);
  const skin = SKIN[skinIndex], shade = SKIN_SHADE[skinIndex];
  const hair = HAIR[appearance.hair ?? pick(5, 6)];
  const accent = appearance.accent ?? ACCENTS[pick(27, 5)];
  jersey = appearance.jersey ?? jersey;
  const style = appearance.style ?? pick(10, 7), wide = pick(14, 5) * 0.8, glasses = appearance.glasses ?? (pick(18, 5) === 0);
  const brow = pick(21, 3), mouth = pick(23, 3), headset = appearance.headset ?? (pick(25, 4) !== 0), facial = pick(26, 5);
  const iris = skinIndex >= 3 ? IRIS[pick(3, 2)] : IRIS[pick(3, 5)];
  const chin = pick(8, 2) ? 74 : 70;
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const ids = {face: 'f' + uid, hair: 'h' + uid, shirt: 's' + uid, glow: 'g' + uid};
  const head = `M${38 - wide} 56C${38 - wide} 34 48 22 60 22s${22 + wide} 12 ${22 + wide} 34v12c0 20-${chin - 60} 33-${22 + wide} 33S${38 - wide} 88 ${38 - wide} 68Z`;
  const line = 'rgba(28,20,18,.42)';
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 140" width={size} height={Math.round(size * 7 / 6)} role="img" aria-label={`${name}, illustrated player portrait`} className="world-player-portrait">
      <defs>
        <linearGradient id={ids.face} x1="0" x2="1" y1="0" y2="0"><stop offset="0" stopColor="#fff" stopOpacity=".12" /><stop offset=".55" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".16" /></linearGradient>
        <linearGradient id={ids.hair} x1="0" x2=".6" y1="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".22" /><stop offset=".4" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".18" /></linearGradient>
        <linearGradient id={ids.shirt} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".16" /><stop offset=".45" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".28" /></linearGradient>
        <radialGradient id={ids.glow} cx=".5" cy=".5" r=".5"><stop offset="0" stopColor={accent} stopOpacity=".9" /><stop offset="1" stopColor={accent} stopOpacity="0" /></radialGradient>
      </defs>

      {/* Jersey and shoulders */}
      <path d="M8 140v-12c2-18 26-24 26-24l14-3c4 7 8 10 12 10s8-3 12-10l14 3s24 6 26 24v12Z" fill={jersey} stroke={line} strokeWidth="1.2" />
      <path d="M8 140v-12c2-18 26-24 26-24l14-3c4 7 8 10 12 10s8-3 12-10l14 3s24 6 26 24v12Z" fill={`url(#${ids.shirt})`} />
      <path d="M20 113 31 140M100 113 89 140" stroke={accent} strokeWidth="3" strokeLinecap="round" opacity=".9" />
      <path d="M46 100.5 60 117l14-16.5-4-1-10 11-10-11Z" fill="#f1e9dc" stroke={line} strokeWidth="1" strokeLinejoin="round" />
      <path d="M60 123.5l5.2 3v6l-5.2 3-5.2-3v-6Z" fill="none" stroke={accent} strokeWidth="1.8" strokeLinejoin="round" />

      {/* Neck */}
      <path d="M50 90v12c4 6 16 6 20 0V90Z" fill={skin} stroke={line} strokeWidth="1" />
      <path d="M50 94c4 7 16 7 20 0v6c-4 6-16 6-20 0Z" fill={shade} opacity=".7" />

      {/* Ears and head */}
      <ellipse cx={37 - wide} cy="65" rx="5.5" ry="8.5" fill={skin} stroke={line} strokeWidth="1" />
      <ellipse cx={83 + wide} cy="65" rx="5.5" ry="8.5" fill={skin} stroke={line} strokeWidth="1" />
      <path d={`M${36 - wide} 63q2-2 3 2M${84 + wide} 63q-2-2-3 2`} fill="none" stroke={shade} strokeWidth="1.4" strokeLinecap="round" />
      <path d={head} fill={skin} stroke={line} strokeWidth="1.2" />
      <path d={head} fill={`url(#${ids.face})`} />
      <ellipse cx="46" cy="79" rx="4.5" ry="2.6" fill="#e2766a" opacity=".16" /><ellipse cx="74" cy="79" rx="4.5" ry="2.6" fill="#e2766a" opacity=".16" />

      {/* Facial hair: a beard for some, stubble for others */}
      {facial <= 1 && <path d="M41 74c0 16 9 26 19 26s19-10 19-26c-4 9-10 13-19 13s-15-4-19-13Zm11 9.5q8-4 16 0-8 2.5-16 0Z" fill={hair} opacity={facial === 0 ? .88 : .22} />}

      {/* Eyes */}
      {[49, 71].map(x => <g key={x}>
        <path d={`M${x - 6} 64q6-5.5 12 0q-6 4.5-12 0Z`} fill="#fbf7f2" />
        <circle cx={x + (pick(16, 3) - 1) * .6} cy="64" r="2.9" fill={iris} />
        <circle cx={x + (pick(16, 3) - 1) * .6} cy="64" r="1.4" fill="#141111" />
        <circle cx={x + .9 + (pick(16, 3) - 1) * .6} cy="62.9" r=".8" fill="#fff" />
        <path d={`M${x - 6.4} 64.2q6.4-6.4 12.8 0`} fill="none" stroke="#2a1f1b" strokeWidth="1.5" strokeLinecap="round" />
      </g>)}
      <path d={brow === 0 ? 'M42.5 57.5q6-3.4 12.5-1.4M65 56.1q6.5-2 12.5 1.4' : brow === 1 ? 'M42.5 56.6q6-1.6 12.5-.4M65 56.2q6.5-1.2 12.5.4' : 'M42.5 55.8q6 .4 12.5 1.6M65 57.4q6.5-1.2 12.5-1.6'} fill="none" stroke={hair} strokeWidth="2.8" strokeLinecap="round" />

      {/* Nose and mouth */}
      <path d="M60.5 66q-1.2 7-4 10.6 3.4 2 7.2.2" fill="none" stroke={shade} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d={mouth === 0 ? 'M52 86q8 6.5 16 0' : mouth === 1 ? 'M53 87.2q7 2 14 0' : 'M53 87.5q8 2.6 15-2.4'} fill="none" stroke="#6b3b30" strokeWidth="1.9" strokeLinecap="round" />
      {mouth === 0 && <path d="M55 89.4q5 2.6 10 0" fill="none" stroke={shade} strokeWidth="1.1" strokeLinecap="round" opacity=".8" />}

      <Hair style={style} color={hair} highlight={ids.hair} />

      {glasses && <g fill="rgba(170,215,255,.14)" stroke="#262d33" strokeWidth="1.8">
        <rect x="41" y="58.5" width="16" height="11.5" rx="4.5" /><rect x="63" y="58.5" width="16" height="11.5" rx="4.5" />
        <path d="M57 63q3-2 6 0M41 62l-4.5-1.5M79 62l4.5-1.5" fill="none" />
        <path d="M44 61l3-1.5M66 61l3-1.5" stroke="#fff" strokeOpacity=".5" strokeWidth="1" />
      </g>}

      {headset && <g strokeLinecap="round" strokeLinejoin="round">
        <path d={`M${33 - wide} 60C${32 - wide} 30 44 16 60 16s${28 + wide} 14 ${27 + wide} 44`} fill="none" stroke="#1b2228" strokeWidth="6.5" />
        <path d={`M${33 - wide} 58C${33 - wide} 32 45 18.5 60 18.5s${27 + wide} 13.5 ${27 + wide} 40`} fill="none" stroke={accent} strokeWidth="1.5" opacity=".85" />
        {[{x: 25 - wide}, {x: 83 + wide}].map(({x}, i) => <g key={i}>
          <rect x={x} y="53" width="12" height="23" rx="6" fill="#232c33" stroke="#10161a" strokeWidth="1.6" />
          <rect x={x + 3} y="57" width="6" height="15" rx="3" fill={`url(#${ids.glow})`} />
          <rect x={x + 3} y="57" width="6" height="15" rx="3" fill="none" stroke={accent} strokeWidth="1.2" />
        </g>)}
        <path d={`M${31 - wide} 73c1 11 9 17 20 17`} fill="none" stroke="#1b2228" strokeWidth="2.6" />
        <circle cx="52" cy="90" r="2.6" fill="#232c33" stroke={accent} strokeWidth="1.2" />
      </g>}
    </svg>
  );
}
