import { Crosshair, Radio, ScanEye, Bomb, Footprints, Shield, Swords } from 'lucide-react';
import { rankFpsRoleFits } from '../fps/fpsRoleFit';
import './role-label.css';

const roleIcons = { entry: Swords, caller: Radio, sniper: ScanEye, support: Bomb, lurker: Footprints, anchor: Shield, trade: Crosshair };

export function FpsPlayerRole({stats}: {stats?: Record<string,number>}) {
  const [primary, secondary] = rankFpsRoleFits(stats);
  const Icon = primary ? roleIcons[primary.id as keyof typeof roleIcons] : Crosshair;
  return <span className="role-label" title="Scouting fits from current skills. Match assignments depend on the full lineup."><Icon size={13} aria-hidden="true"/><span className="role-label__specialties"><span>{primary?.name ?? 'Unscouted'}</span>{secondary&&<small className="role-label__secondary">Secondary: {secondary.name}</small>}</span></span>;
}
