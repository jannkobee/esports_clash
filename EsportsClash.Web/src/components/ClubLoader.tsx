import {HexatrickMark} from './HexatrickBrand';
import './club-loader.css';

export function ClubLoader({label='Opening your club',overlay=true}:{label?:string;overlay?:boolean}){
 return <div className={'club-loader '+(overlay?'club-loader--overlay':'club-loader--inline')} role="status" aria-live="polite" aria-busy="true"><div className="club-loader__art" aria-hidden="true"><div className="club-loader__monitor"><div className="club-loader__screen"><HexatrickMark/><span className="club-loader__scan"/><i/><i/><i/></div></div><span className="club-loader__stand"/><span className="club-loader__keyboard"/><span className="club-loader__pixel pixel-one"/><span className="club-loader__pixel pixel-two"/><span className="club-loader__pixel pixel-three"/></div><strong>{label}<span className="club-loader__dots">…</span></strong><span className="club-loader__rail"><i/></span><small>hexatrick</small></div>;
}
