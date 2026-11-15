import {Crosshair} from 'lucide-react';
import {fpsRoleFit} from '../fps/fpsRoleFit';
import './role-label.css';
export function FpsPlayerRole({stats}:{stats?:Record<string,number>}){return <span className="role-label" title="Execution strength; tactical assignments are managed separately"><Crosshair size={13}/>{fpsRoleFit(stats)}</span>;}
