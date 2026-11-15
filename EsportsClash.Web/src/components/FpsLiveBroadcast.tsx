import {FPS_POSITION_LABELS} from '../fps/fpsPlayerArchitecture';
import type {fetchApprovedLearning} from '../fps/fpsApprovedLearning';
import { canBuyLiveWeapon, LIVE_KNIFE, type LiveEquippedWeapon, type LiveWeapon } from '../fps/fpsLiveWeapons.ts';
import { LIVE_UTILITY_COST, type LiveUtilityItem } from '../fps/fpsLiveEconomy';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { freshFpsExhibitionSeed } from '../fps/fpsExhibitionSeed';
import type { PlayerCard } from '../types';
import type { FpsIdentityExperiment, FpsTeamId } from '../fps/fpsTypes';
import { FpsFixedStepClock } from '../fps/fpsSpatialWorld';
import { getLiveMapRuntime } from '../fps/fpsLiveMapRegistry';
import type { LiveMapId } from '../fps/fpsLiveMapTypes';
import { SIGNAL_CIRCUIT, fpsBroadcastPresentation, fpsBroadcastText, type FpsBroadcastOrganizer } from '../fps/fpsBroadcastPresentation';
import { FpsLiveSimulation, LIVE_FPS_STEP, LIVE_WEAPONS, type LivePlayer, type LiveSnapshot } from '../fps/fpsLiveSimulation';
import { predictLiveGrenade } from '../fps/fpsLiveGrenades';
import type {FpsAudioCue} from '../fps/fpsBroadcastAudio';
import { FpsBroadcastAudio } from '../fps/fpsBroadcastAudio';
import { readFpsLearning, saveFpsLearningRound } from '../fps/fpsLiveLearningStorage';
import { readFpsMechanicsLearning, saveFpsMechanicsRound } from '../fps/fpsLiveMechanicsLearningStorage';
import { readFpsMovementLearning, saveFpsMovementRound } from '../fps/fpsLiveMovementLearningStorage';
import { domRectToBabylonViewport } from '../fps/fpsBroadcastDirector';
import type { BombPlantPipState, LiveCameraMode } from '../fps/fpsLiveViewer';
import { liveImpactRate } from '../fps/fpsLiveImpact';
import type { FpsSkillProfile } from '../fps/fpsSkillProfile';
import {request, isCloudPersistenceConfigured} from '../cloudPersistence';
import {pediaHref, type PediaDirectory} from '../hexapedia';
import type {CSSProperties} from 'react';
import {FPS_ABILITY_LABELS} from '../fps/fpsSkillProfile';
import {FpsIncomingFire} from './FpsIncomingFire';
import {FpsWeaponIcon as WeaponSilhouette} from './FpsWeaponIcon';
import './fps-live-broadcast.css';

interface DocumentPictureInPictureApi {
  window: Window | null;
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
}

const EMPTY_PLANT_PIP: BombPlantPipState = {
  active: false,
  phase: 'planting',
  progress: 0,
  duration: 3.2,
  spot: { x: 0, z: 0 },
};

function cloneDocumentStylesToPipWindow(sourceDoc: Document, targetDoc: Document): void {
  for (const node of Array.from(sourceDoc.querySelectorAll('style, link[rel="stylesheet"]'))) {
    targetDoc.head.appendChild(node.cloneNode(true));
  }
}

interface Props {
  mapId?: LiveMapId;
  blue: PlayerCard[];
  red: PlayerCard[];
  seed: number;
  identity: FpsIdentityExperiment;
  skillProfiles?: Record<string, FpsSkillProfile>;
  learningEnabled?:boolean;
  approvedModel?:Awaited<ReturnType<typeof fetchApprovedLearning>>;
  onExit: () => void;
}

const clock = (seconds: number) => `${Math.floor(Math.ceil(seconds) / 60)}:${String(Math.ceil(seconds) % 60).padStart(2, '0')}`;
const cameraModes:LiveCameraMode[]=['director','first','third','tactical','cinematic','free'];

function TacticalAvatar({ attacking, isDead }: { attacking:boolean; isDead: boolean }) {
  const isCT = !attacking;
  return (
    <div className={`broadcast-avatar ${isCT ? 'is-ct' : 'is-t'} ${isDead ? 'is-dead' : ''}`}>
      <svg viewBox="0 0 48 48" className="broadcast-avatar-svg" aria-hidden="true">
        {isCT ? (
          <g>
            <path d="M6 46c0-9 7-15 18-15s18 6 18 15z" fill="#1e293b" />
            <path d="M12 36h24v10H12z" fill="#0f172a" />
            <rect x="18" y="26" width="12" height="7" rx="2" fill="#090d16" />
            <path d="M11 22c0-8 6-16 13-16s13 8 13 16v3H11z" fill="#1e3a5f" />
            <path d="M10 20h28v4H10z" fill="#0f172a" />
            <rect x="14" y="16" width="20" height="7" rx="3" fill="#38bdf8" />
            <line x1="16" y1="18" x2="23" y2="18" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" opacity="0.8" />
            <circle cx="10" cy="22" r="3" fill="#334155" />
            <path d="M10 23c0 4 5 6 9 6" stroke="#334155" strokeWidth="1.5" fill="none" />
            <circle cx="19" cy="29" r="1.5" fill="#38bdf8" />
          </g>
        ) : (
          <g>
            <path d="M6 46c0-9 7-15 18-15s18 6 18 15z" fill="#991b1b" />
            <line x1="8" y1="46" x2="38" y2="34" stroke="#1c1917" strokeWidth="3" />
            <rect x="18" y="24" width="12" height="9" rx="2" fill="#292524" />
            <path d="M13 22c0-7 5-15 11-15s11 8 11 15v4H13z" fill="#44403c" />
            <rect x="12" y="10" width="24" height="4" rx="2" fill="#292524" />
            <rect x="15" y="15" width="18" height="8" rx="2" fill="#d97706" opacity="0.8" />
            <rect x="15" y="16" width="8" height="5" rx="1.5" fill="#09090b" />
            <rect x="25" y="16" width="8" height="5" rx="1.5" fill="#09090b" />
            <line x1="23" y1="18" x2="25" y2="18" stroke="#09090b" strokeWidth="1.5" />
          </g>
        )}
      </svg>
      {isDead && (
        <div className="broadcast-avatar__dead-badge" title="Eliminated">
          <svg viewBox="0 0 24 24" fill="#ef4444" width="22" height="22">
            <path d="M12 2a7 7 0 00-7 7c0 2.5 1.3 4.6 3.2 5.8V17a1 1 0 001 1h5.6a1 1 0 001-1v-2.2c1.9-1.2 3.2-3.3 3.2-5.8a7 7 0 00-7-7zm-2.5 8a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm5 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
          </svg>
        </div>
      )}
    </div>
  );
}

function BroadcastPlayerCard({
  p,
  slotLabel,
  followed,
  onSelect,
}: {
  p: LivePlayer;
  slotLabel: string;
  followed: string;
  onSelect: (p: LivePlayer) => void;
}) {
  const isObserved = p.id === followed;
  const isDead = p.hp <= 0;
  const lowHp = !isDead && p.hp <= 25;
  return (
    <button
      type="button"
      className={`broadcast-player-card broadcast-player-card--${p.attacking?'red':'blue'} ${isObserved ? 'is-observed' : ''} ${isDead ? 'is-dead' : ''} ${lowHp ? 'is-low-hp' : ''}`}
      onClick={() => onSelect(p)}
      disabled={isDead}
      aria-label={`${p.name} · ${p.hp} HP · ${p.role}`}
    >
      {isObserved && <span className="broadcast-player-card__pointer">▲</span>}
      <span className="broadcast-player-card__slot">{slotLabel}</span>
      <TacticalAvatar attacking={p.attacking} isDead={isDead} />
      <div className="broadcast-player-card__hp-wrap">
        <span className={`broadcast-player-card__hp ${lowHp ? 'is-low' : ''}`}>{isDead ? '0' : Math.ceil(p.hp)}</span>
        <div className="broadcast-player-card__health-bar">
          <div className="broadcast-player-card__health-fill" style={{ width: `${Math.max(0, p.hp)}%` }} />
        </div>
      </div>
      <div className="broadcast-player-card__name-row">
        <strong className="broadcast-player-card__name" title={p.name}>{p.name}</strong>
        <span className="broadcast-player-card__cash">${p.cash}</span>
      </div>
      <div className="broadcast-player-card__kda" aria-label="Kills deaths assists"><b>{p.kills}</b><span>K</span><b>{p.deaths}</b><span>D</span><b>{p.assists??0}</b><span>A</span></div>
      <div className="broadcast-player-card__gear-row">
        <span className="broadcast-player-card__weapon">
          <WeaponSilhouette weapon={p.equipped} attacking={p.attacking} />
        </span>
        <div className="broadcast-player-card__utils">
          {p.flash > 0 && <span className="broadcast-pill broadcast-pill--flash" title={`${p.flash} Flashbang`}>⚡{p.flash > 1 ? p.flash : ''}</span>}
          {p.smoke > 0 && <span className="broadcast-pill broadcast-pill--smoke" title={`${p.smoke} Smoke`}>💨</span>}
          {p.incendiary > 0 && <span className="broadcast-pill broadcast-pill--incendiary" title={`${p.incendiary} ${p.attacking ? 'Molotov' : 'Incendiary'}`}>🔥</span>}
          {p.he > 0 && <span className="broadcast-pill broadcast-pill--he" title={`${p.he} HE grenade`}>HE</span>}
          {p.armor > 0 && <span className="broadcast-pill broadcast-pill--armor" title={`Armor: ${p.armor}`}>🛡️</span>}
          {p.kit && <span className="broadcast-pill broadcast-pill--kit" title="Defuse Kit">✂️</span>}
          {p.bomb && <span className="broadcast-pill broadcast-pill--bomb" title="Carrying Device">💣</span>}
        </div>
      </div>
    </button>
  );
}

type ArmorySideFilter = 'auto' | 'all' | 'ct' | 't';

const ARMORY_SECTIONS: readonly { id: string; title: string; subtitle: string; weapons: readonly LiveWeapon[] }[] = [
  {
    id: 'pistols',
    title: 'Sidearms',
    subtitle: 'Starter & Eco Pistols',
    weapons: ['usp_s', 'glock', 'p250', 'fiveseven', 'tec9', 'cz75', 'deagle'],
  },
  {
    id: 'midtier',
    title: 'SMGs & Shotguns',
    subtitle: 'Force-Buy & Close Hold',
    weapons: ['mac10', 'mp9', 'nova', 'mag7'],
  },
  {
    id: 'rifles',
    title: 'Rifles',
    subtitle: 'Core Rifle Buys',
    weapons: ['budget_t', 'budget_ct', 'ak47', 'm4a1_s'],
  },
  {
    id: 'heavy',
    title: 'Precision & Heavy',
    subtitle: 'Long-Range & Suppression',
    weapons: ['scout', 'negev', 'sniper'],
  },
];

const ARMORY_UTILITY: readonly {
  kind: LiveUtilityItem;
  cost: number;
  limit: number;
  ctLabel: string;
  tLabel: string;
  effect: string;
}[] = [
  { kind: 'flash', cost: LIVE_UTILITY_COST.flash, limit: 2, ctLabel: 'Flashbang', tLabel: 'Flashbang', effect: 'Blinds exposed sightlines' },
  { kind: 'smoke', cost: LIVE_UTILITY_COST.smoke, limit: 1, ctLabel: 'Smoke Grenade', tLabel: 'Smoke Grenade', effect: 'Blocks vision & extinguishes fire (18s)' },
  { kind: 'he', cost: LIVE_UTILITY_COST.he, limit: 1, ctLabel: 'HE Grenade', tLabel: 'HE Grenade', effect: 'Splash damage & brief smoke gap' },
  { kind: 'incendiary', cost: LIVE_UTILITY_COST.incendiary, limit: 1, ctLabel: 'Incendiary', tLabel: 'Molotov', effect: 'Denies chokepoints & post-plant zones' },
];

const ARMORY_GEAR: readonly {
  id: 'armor' | 'kit' | 'restock' | 'knife';
  label: string;
  cost: number;
  side: 'both' | 'ct';
  badge: string;
  detail: string;
  icon?: LiveEquippedWeapon;
}[] = [
  { id: 'armor', label: 'Kevlar Vest + Helmet', cost: 650, side: 'both', badge: '🛡️', detail: 'Reduces incoming body/head damage' },
  { id: 'kit', label: 'Defuse Kit', cost: 400, side: 'ct', badge: '✂️', detail: 'Halves C4 defuse time (CT only)' },
  { id: 'restock', label: 'Ammo Restock', cost: 150, side: 'both', badge: '▣', detail: 'Tops off primary magazine & reserve' },
  { id: 'knife', label: LIVE_KNIFE.name, cost: 0, side: 'both', badge: '🗡', detail: `Melee (${LIVE_KNIFE.damage} dmg / ${LIVE_KNIFE.backDamage} back)`, icon: 'knife' },
];

function BroadcastArmoryModal({
  observed,
  sideFilter,
  onSideFilterChange,
  onClose,
}: {
  observed: LivePlayer;
  sideFilter: ArmorySideFilter;
  onSideFilterChange: (next: ArmorySideFilter) => void;
  onClose: () => void;
}) {
  const effectiveSide = sideFilter === 'auto' ? (observed.attacking ? 't' : 'ct') : sideFilter;
  const matchesWeaponSide = (w: LiveWeapon) =>
    effectiveSide === 'all'
      ? canBuyLiveWeapon(w, false) || canBuyLiveWeapon(w, true)
      : canBuyLiveWeapon(w, effectiveSide === 't');
  const observedSide = observed.attacking ? 't' : 'ct';
  const utilityTotal = observed.flash + observed.smoke + observed.incendiary + observed.he;

  return (
    <div
      className="broadcast-buy-overlay"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="broadcast-buy-modal" role="dialog" aria-modal="true" aria-label="Armory and buy list">
        <header className="broadcast-buy-modal__header">
          <div className="broadcast-buy-modal__title-block">
            <div className="broadcast-buy-modal__eyebrow">
              <span>LIVE MATCH ARMORY</span>
              <span className="broadcast-buy-modal__hotkey"><kbd>B</kbd> TOGGLE · <kbd>ESC</kbd> CLOSE</span>
            </div>
            <h2>Weapons, Utility &amp; Equipment</h2>
            <p className="broadcast-buy-modal__context">
              Observing <strong className={observed.attacking ? 'is-t' : 'is-ct'}>{observed.name}</strong> ({observed.attacking ? 'T Force' : 'CT Force'})
              {' · '}Bank <strong className="broadcast-buy-modal__cash">${observed.cash.toLocaleString()}</strong>
              {' · '}Utility <strong>{utilityTotal}/4</strong>
            </p>
          </div>
          <div className="broadcast-buy-modal__controls">
            <div className="broadcast-buy-modal__tabs" role="tablist" aria-label="Filter items by side">
              {([
                ['auto', `Observed (${observedSide.toUpperCase()})`],
                ['all', 'Both Sides'],
                ['ct', 'CT Force'],
                ['t', 'T Force'],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={sideFilter === key}
                  className={sideFilter === key ? 'is-active' : undefined}
                  onClick={() => onSideFilterChange(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <button type="button" className="broadcast-buy-modal__close" onClick={onClose} aria-label="Close armory buy list">
              ×
            </button>
          </div>
        </header>

        <div className="broadcast-buy-modal__grid">
          {ARMORY_SECTIONS.map(section => {
            const visible = section.weapons.filter(matchesWeaponSide);
            if (!visible.length) return null;
            return (
              <section key={section.id} className="broadcast-buy-section">
                <div className="broadcast-buy-section__head">
                  <h3>{section.title}</h3>
                  <span>{section.subtitle}</span>
                </div>
                <div className="broadcast-buy-cards">
                  {visible.map(id => {
                    const w = LIVE_WEAPONS[id];
                    const sideTag = w.side === 'ct' ? 'CT' : w.side === 't' ? 'T' : 'ALL';
                    const isOwned =
                      observed.primaryWeapon === id ||
                      observed.secondaryWeapon === id ||
                      observed.weapon === id;
                    const canBuyForObservedSide = canBuyLiveWeapon(id, observed.attacking);
                    const affordable = observed.cash >= w.cost;
                    const dmgLabel = w.pellets ? `${w.damage}×${w.pellets}` : `${w.damage}`;
                    return (
                      <article
                        key={id}
                        className={[
                          'broadcast-buy-card',
                          w.side === 'ct' ? 'is-ct' : w.side === 't' ? 'is-t' : 'is-shared',
                          isOwned ? 'is-owned' : '',
                          canBuyForObservedSide && !affordable ? 'is-unaffordable' : '',
                        ].filter(Boolean).join(' ')}
                      >
                        <div className="broadcast-buy-card__top">
                          <span className={`broadcast-buy-side broadcast-buy-side--${sideTag.toLowerCase()}`}>{sideTag}</span>
                          <span className="broadcast-buy-card__price">${w.cost.toLocaleString()}</span>
                        </div>
                        <div className="broadcast-buy-card__art">
                          <WeaponSilhouette weapon={id} attacking={w.side === 't' || (w.side !== 'ct' && observed.attacking)} />
                        </div>
                        <div className="broadcast-buy-card__name-row">
                          <strong>{w.name}</strong>
                          {isOwned && <span className="broadcast-buy-owned">OWNED</span>}
                        </div>
                        <div className="broadcast-buy-card__stats">
                          <span title="Base damage">{dmgLabel} DMG</span>
                          <span title="Magazine / reserve ammo">{w.magazine}/{w.reserve}</span>
                          <span title="Kill reward">+${w.killReward ?? 250}</span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}

          <section className="broadcast-buy-section broadcast-buy-section--utility">
            <div className="broadcast-buy-section__head">
              <h3>Utility &amp; Gear</h3>
              <span>Max 4 grenades · 2 Flashes · 1 Smoke / HE / Fire</span>
            </div>
            <div className="broadcast-buy-cards broadcast-buy-cards--utility">
              {ARMORY_UTILITY.map(item => {
                const count = observed[item.kind];
                const label = effectiveSide === 'ct' ? item.ctLabel : effectiveSide === 't' ? item.tLabel : item.kind === 'incendiary' ? 'Molotov / Incendiary' : item.ctLabel;
                const affordable = observed.cash >= item.cost;
                return (
                  <article
                    key={item.kind}
                    className={[
                      'broadcast-buy-card',
                      count > 0 ? 'is-owned' : '',
                      !affordable ? 'is-unaffordable' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <div className="broadcast-buy-card__top">
                      <span className="broadcast-buy-side broadcast-buy-side--all">UTIL</span>
                      <span className="broadcast-buy-card__price">${item.cost}</span>
                    </div>
                    <div className="broadcast-buy-card__art">
                      <WeaponSilhouette weapon={item.kind} attacking={effectiveSide === 't' || (effectiveSide === 'all' && observed.attacking)} />
                    </div>
                    <div className="broadcast-buy-card__name-row">
                      <strong>{label}</strong>
                      {count > 0 && <span className="broadcast-buy-owned">{count}/{item.limit}</span>}
                    </div>
                    <p className="broadcast-buy-card__desc">{item.effect}</p>
                  </article>
                );
              })}

              {ARMORY_GEAR.filter(gear => effectiveSide !== 't' || gear.side !== 'ct').map(gear => {
                const owned =
                  (gear.id === 'armor' && observed.armor >= 50) ||
                  (gear.id === 'kit' && !observed.attacking && observed.kit) ||
                  gear.id === 'knife';
                const affordable = gear.cost === 0 || observed.cash >= gear.cost;
                return (
                  <article
                    key={gear.id}
                    className={[
                      'broadcast-buy-card',
                      gear.side === 'ct' ? 'is-ct' : 'is-shared',
                      owned ? 'is-owned' : '',
                      !affordable && (gear.side !== 'ct' || !observed.attacking) ? 'is-unaffordable' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <div className="broadcast-buy-card__top">
                      <span className={`broadcast-buy-side broadcast-buy-side--${gear.side === 'ct' ? 'ct' : 'all'}`}>
                        {gear.side === 'ct' ? 'CT GEAR' : 'GEAR'}
                      </span>
                      <span className="broadcast-buy-card__price">{gear.cost === 0 ? 'FREE' : `$${gear.cost}`}</span>
                    </div>
                    <div className="broadcast-buy-card__art">
                      {gear.icon ? (
                        <WeaponSilhouette weapon={gear.icon} attacking={observed.attacking} />
                      ) : (
                        <span className="broadcast-buy-card__glyph" aria-hidden="true">{gear.badge}</span>
                      )}
                    </div>
                    <div className="broadcast-buy-card__name-row">
                      <strong>{gear.label}</strong>
                      {owned && <span className="broadcast-buy-owned">{gear.id === 'armor' ? `${Math.round(observed.armor)} AP` : 'EQUIPPED'}</span>}
                    </div>
                    <p className="broadcast-buy-card__desc">{gear.detail}</p>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function BroadcastCenterFocusCard({
  observed,
  mode,
  mapId,
  onSelectCamera,
}: {
  observed: LivePlayer;
  mode: LiveCameraMode;
  mapId: LiveMapId;
  onSelectCamera: (m: LiveCameraMode) => void;
}) {
  const isCT = !observed.attacking;
  return (
    <div className={`broadcast-focus-card broadcast-focus-card--${observed.attacking?'red':'blue'}`}>
      <div className="broadcast-focus-card__main">
        <div className="broadcast-focus-card__profile">
          <span className="broadcast-focus-card__obs-tag"><span className="broadcast-rec-dot" />{isCT?'CT':'T'} / OBSERVING</span>
          <h3 className="broadcast-focus-card__name">{observed.name}</h3>
          <span className="broadcast-focus-card__role">[{({caller:'IGL',sniper:'AWPER',entry:'ENTRY',support:'SUPPORT',lurker:'LURKER',anchor:'ANCHOR',trade:'RIFLER / ROTATOR'} as const)[observed.role]}]</span>
        </div>
        <div className="broadcast-focus-card__ammo-box">
          {observed.equipped === 'knife' ? (
            <span className="broadcast-focus-card__ammo-val">MELEE</span>
          ) : observed.equipped === 'flash' || observed.equipped === 'smoke' || observed.equipped === 'incendiary' || observed.equipped==='he' ? (
            <span className="broadcast-focus-card__ammo-val">UTILITY</span>
          ) : (
            <span className="broadcast-focus-card__ammo-val">
              {observed.ammo}
              <small> / {observed.reserve}</small>
            </span>
          )}
          <span className="broadcast-focus-card__weapon-name">
            {observed.equipped === 'knife' ? LIVE_KNIFE.name : observed.equipped === 'flash' ? 'Flashbang' : observed.equipped === 'smoke' ? 'Smoke grenade' : observed.equipped === 'incendiary' ? (observed.attacking ? 'Molotov' : 'Incendiary') : observed.equipped==='he'?'HE grenade':LIVE_WEAPONS[observed.weapon].name}
          </span>
        </div>
      </div>
      <div className="broadcast-focus-card__meta">
        <span className="broadcast-focus-card__kda" title="Kills / Deaths / Assists">{observed.kills} / {observed.deaths} / {observed.assists??0}</span>
        <span className="broadcast-focus-card__action-line" title={[observed.action,observed.actionSkill?`${FPS_ABILITY_LABELS[observed.actionSkill.ability]} ${observed.actionSkill.value}/10`:'',fpsBroadcastText(observed.intent, mapId),fpsBroadcastText(observed.radioMessage??'', mapId)].filter(Boolean).join(' / ')}>
          {observed.hp<=0?'Eliminated':observed.action}{observed.channel>0?` (${observed.channel.toFixed(1)}s)`:''}
        </span>
        {observed.enemyRemaining!==undefined&&<span className="broadcast-focus-card__forces" title="Confirmed opponents remaining">{observed.enemyRemaining} left</span>}
      </div>
      {observed.radioMessage && observed.hp > 0 && (
        <div className="broadcast-focus-card__radio" title={fpsBroadcastText(observed.radioMessage, mapId)}>
          <span className="broadcast-focus-card__radio-tag">COMMS</span>
          <span>{fpsBroadcastText(observed.radioMessage, mapId)}</span>
        </div>
      )}
      <div className="broadcast-focus-card__cams" role="group" aria-label="Spectator cameras">
        {(['first', 'third', 'director', 'tactical', 'cinematic', 'free'] as const).map(cm => (
          <button
            type="button"
            key={cm}
            className={`broadcast-cam-btn ${mode === cm ? 'is-active' : ''}`}
            onClick={() => onSelectCamera(cm)}
          >
            {cm === 'first' ? '1P' : cm === 'third' ? '3P' : cm === 'director' ? 'AUTO' : cm==='tactical'?'WIDE':cm==='free'?'FREE':'FILM'}
          </button>
        ))}
      </div>
    </div>
  );
}

function BroadcastScoreboard({
  frame,
  blueSideTitle,
  blueSideRole,
  isBlueDefending,
  redSideTitle,
  redSideRole,
  isRedDefending,
  clutchLabel,
  bluePct,
  redPct,
  paused,
}: {
  frame: LiveSnapshot;
  blueSideTitle: string;
  blueSideRole: string;
  isBlueDefending: boolean;
  redSideTitle: string;
  redSideRole: string;
  isRedDefending: boolean;
  clutchLabel: string;
  bluePct: number;
  redPct: number;
  paused: boolean;
}) {
  const isPlanted = frame.bomb.status === 'planted';
  return (
    <div className="broadcast-scoreboard">
      {/* Blue Team Block */}
      <div className={`broadcast-scoreboard__team broadcast-scoreboard__team--blue ${isBlueDefending ? 'is-ct' : 'is-t'}`}>
        <div className="broadcast-scoreboard__team-info">
          <span className="broadcast-scoreboard__team-name">{blueSideTitle}</span>
          <span className="broadcast-scoreboard__team-sub">BLUE · {blueSideRole}</span>
          <div className="broadcast-scoreboard__pips" aria-label="Blue alive operatives">
            {frame.players.filter(p => !p.attacking).map(p => (
              <span key={p.id} className={`broadcast-alive-pip broadcast-alive-pip--blue ${p.hp > 0 ? 'is-alive' : 'is-dead'}`} />
            ))}
          </div>
        </div>
        <div className="broadcast-scoreboard__score broadcast-scoreboard__score--blue">
          {frame.score.blue}
        </div>
      </div>

      {/* Center Match & Timer Module */}
      <div className="broadcast-scoreboard__center">
        <div className="broadcast-scoreboard__round-info">
          <span>ROUND {frame.round} {frame.round > 30 ? '· OT' : '/ 30'}</span>
          {paused ? (
            <span className="broadcast-scoreboard__paused-badge">⏸ PAUSED</span>
          ) : (
            <span className={`broadcast-scoreboard__phase broadcast-scoreboard__phase--${frame.phase}`}>{frame.phase === 'freeze' ? 'BUY PHASE' : frame.phase === 'post' ? 'ROUND BREAK' : frame.phase === 'finished' ? 'MATCH OVER' : 'LIVE'}</span>
          )}
          {clutchLabel && <span className="broadcast-scoreboard__clutch">{clutchLabel}</span>}
        </div>
        <div className={`broadcast-scoreboard__timer ${isPlanted ? 'is-planted' : ''} ${paused ? 'is-paused' : ''}`}>
          {isPlanted ? (
            <span className="broadcast-planted-pulse">💣 {Math.ceil(frame.remaining)}s</span>
          ) : (
            clock(frame.remaining)
          )}
        </div>
        {/* Win Prediction Bar (producer presentation!) */}
        <div className="broadcast-prediction">
          <div className="broadcast-prediction__header">
            <span className="broadcast-pred-blue">{bluePct}%</span>
            <span className="broadcast-pred-label">WIN ODDS</span>
            <span className="broadcast-pred-red">{redPct}%</span>
          </div>
          <div className="broadcast-prediction__bar">
            <div className="broadcast-pred-fill broadcast-pred-fill--blue" style={{ width: `${bluePct}%` }} />
            <div className="broadcast-pred-fill broadcast-pred-fill--red" style={{ width: `${redPct}%` }} />
          </div>
        </div>
      </div>

      {/* Red Team Block */}
      <div className={`broadcast-scoreboard__team broadcast-scoreboard__team--red ${isRedDefending ? 'is-ct' : 'is-t'}`}>
        <div className="broadcast-scoreboard__score broadcast-scoreboard__score--red">
          {frame.score.red}
        </div>
        <div className="broadcast-scoreboard__team-info">
          <span className="broadcast-scoreboard__team-name">{redSideTitle}</span>
          <span className="broadcast-scoreboard__team-sub">RED · {redSideRole}</span>
          <div className="broadcast-scoreboard__pips broadcast-scoreboard__pips--red" aria-label="Red alive operatives">
            {frame.players.filter(p => p.attacking).map(p => (
              <span key={p.id} className={`broadcast-alive-pip broadcast-alive-pip--red ${p.hp > 0 ? 'is-alive' : 'is-dead'}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface BroadcastHudOptions {
  scoreboard: boolean;
  minimap: boolean;
  killfeed: boolean;
  callouts: boolean;
  playerDock: boolean;
  lineups: boolean;
  cutawayRoofs: boolean;
  debugOverlays: boolean;
}

const DEFAULT_HUD_OPTIONS: BroadcastHudOptions = {
  scoreboard: true,
  minimap: true,
  killfeed: true,
  callouts: true,
  playerDock: true,
  lineups: true,
  cutawayRoofs: false,
  debugOverlays: false,
};

function loadHudOptions(): BroadcastHudOptions {
  try {
    const raw = window.localStorage.getItem('hexatrick:fps-hud-options');
    if (!raw) return DEFAULT_HUD_OPTIONS;
    const parsed = JSON.parse(raw) as Partial<BroadcastHudOptions>;
    return { ...DEFAULT_HUD_OPTIONS, ...parsed };
  } catch {
    return DEFAULT_HUD_OPTIONS;
  }
}

export function FpsLiveBroadcast({ mapId = 'fontessa', blue, red, seed, identity, skillProfiles, learningEnabled=false, approvedModel, onExit }: Props) {
  const [attempt, setAttempt] = useState(0);
  const { simulation, activeSeed } = useMemo(
    () => {
      const activeSeed = freshFpsExhibitionSeed(seed);
      return { activeSeed, simulation: new FpsLiveSimulation(blue, red, activeSeed, identity, { mapId, skillProfiles,
        learning:learningEnabled?{mode:'learn',model:readFpsLearning(),onRound:round=>{saveFpsLearningRound(round);}}:{mode:'frozen',model:approvedModel?.navigation},
        mechanicsLearning:learningEnabled?{model:readFpsMechanicsLearning(),onRound:round=>{saveFpsMechanicsRound(round);}}:{mode:'frozen',model:approvedModel?.combat},
        movementLearning:learningEnabled?{model:readFpsMovementLearning(),onRound:round=>{saveFpsMovementRound(round);}}:{mode:'frozen',model:approvedModel?.movement} }) };
    },
    [mapId, blue, red, seed, identity, skillProfiles, learningEnabled, approvedModel, attempt]
  );
  const [frame, setFrame] = useState(() => simulation.snapshot());
  const activeMapId: LiveMapId = frame.mapId ?? mapId;
  const mapRuntime = useMemo(() => getLiveMapRuntime(activeMapId), [activeMapId]);
  const [paused, setPaused] = useState(false);
  const [fullscreen,setFullscreen]=useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mode, setMode] = useState<LiveCameraMode>('director');
  const [overviewCam, setOverviewCam] = useState(false);
  const [organizers,setOrganizers]=useState<FpsBroadcastOrganizer[]>([SIGNAL_CIRCUIT]);
  const [producer,setProducer]=useState<string>(()=>{
    try{return window.localStorage.getItem('hexatrick:fps-presentation')??SIGNAL_CIRCUIT.id;}catch{return SIGNAL_CIRCUIT.id;}
  });
  const presentation=fpsBroadcastPresentation(producer,organizers,activeMapId);
  const presentationStyle={'--presentation-accent':presentation.accent} as CSSProperties;
  useEffect(()=>{
    if(!isCloudPersistenceConfigured())return;
    const controller=new AbortController();
    void (async()=>{
      const published:FpsBroadcastOrganizer[]=[];
      let page=1,last=1;
      do {
        const response=await request<{data:PediaDirectory}>(`/avatarpedia/directory/organizers?page=${page}&per_page=100`,null,{signal:controller.signal});
        for(const row of response.data.items)if(row.broadcast)published.push({id:String(row.id),name:row.name,broadcast:row.broadcast});
        last=response.data.meta.last_page;page++;
      }while(page<=last);
      if(!controller.signal.aborted&&published.length)setOrganizers(published);
    })().catch(()=>{/* Keep the canonical offline organizer when the directory is unavailable. */});
    return ()=>controller.abort();
  },[]);
  const [selected, setSelected] = useState(blue[0].id);
  const [followed, setFollowed] = useState(blue[0].id);
  const [effectiveCamera, setEffectiveCamera] = useState<Exclude<LiveCameraMode, 'director'>>('cinematic');
  const [autoPipEnabled, setAutoPipEnabled] = useState(true);
  const [hudOptions, setHudOptions] = useState<BroadcastHudOptions>(loadHudOptions);
  const [hudMenuOpen, setHudMenuOpen] = useState(false);
  const [buyMenuOpen, setBuyMenuOpen] = useState(false);
  const [buySideFilter, setBuySideFilter] = useState<ArmorySideFilter>('auto');
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try { return typeof window === 'undefined' || window.localStorage.getItem('hexatrick:fps-sound') !== 'off'; }
    catch { return true; }
  });
  const [plantPip, setPlantPip] = useState<BombPlantPipState>(EMPTY_PLANT_PIP);
  const [plantPipHudVisible, setPlantPipHudVisible] = useState(true);
  const [popoutHudVisible, setPopoutHudVisible] = useState(true);
  const [popoutKind, setPopoutKind] = useState<'none' | 'document' | 'video'>('none');
  const canvas = useRef<HTMLCanvasElement>(null);
  const host = useRef<HTMLElement>(null);
  const stageMount = useRef<HTMLDivElement>(null);
  const stageEl = useRef<HTMLDivElement>(null);
  const pipViewportEl = useRef<HTMLDivElement>(null);
  const pipVideo = useRef<HTMLVideoElement>(null);
  const pipStream = useRef<MediaStream | null>(null);
  const pipWindow = useRef<Window | null>(null);
  const rafWindow = useRef<Window>(window);
  const animId = useRef(0);
  const viewerRef = useRef<import('../fps/fpsLiveViewer').FpsLiveViewer | undefined>(undefined);
  const audioRef = useRef<FpsBroadcastAudio | null>(null);
  if(!audioRef.current)audioRef.current=new FpsBroadcastAudio();
  const audioFollowedId = useRef(blue[0].id);
  const scheduleFrameRef = useRef<(() => void) | null>(null);
  const controls = useRef({ paused, mode, selected, autoPipEnabled, lineups: hudOptions.lineups, cutawayRoofs: hudOptions.cutawayRoofs, debugOverlays: hudOptions.debugOverlays, overviewCam, ready, error, phase:frame.phase, players:frame.players });
  controls.current = { paused, mode, selected, autoPipEnabled, lineups: hudOptions.lineups, cutawayRoofs: hudOptions.cutawayRoofs, debugOverlays: hudOptions.debugOverlays, overviewCam, ready, error, phase:frame.phase, players:frame.players };

  const toggleHudOption = useCallback((key: keyof BroadcastHudOptions) => {
    setHudOptions(prev => {
      const next = { ...prev, [key]: !prev[key] };
      try { window.localStorage.setItem('hexatrick:fps-hud-options', JSON.stringify(next)); } catch { /* Optional storage. */ }
      return next;
    });
  }, []);

  useEffect(() => {
    audioRef.current?.setMapProfile(mapRuntime.definition.audio);
  }, [mapRuntime]);

  useEffect(() => {
    viewerRef.current?.setCutawayRoofs(hudOptions.cutawayRoofs);
  }, [ready, hudOptions.cutawayRoofs]);

  useEffect(() => {
    viewerRef.current?.setDebugOverlays(hudOptions.debugOverlays);
  }, [ready, hudOptions.debugOverlays]);

  useEffect(() => {
    viewerRef.current?.setOverview(overviewCam);
  }, [ready, overviewCam]);

  useEffect(() => {
    audioRef.current?.setEnabled(soundEnabled);
    try { window.localStorage.setItem('hexatrick:fps-sound', soundEnabled ? 'on' : 'off'); } catch { /* Local storage is optional. */ }
  }, [soundEnabled]);

  useEffect(() => () => audioRef.current?.dispose(), []);

  const syncPipViewport = useCallback(() => {
    const activeViewer = viewerRef.current;
    if (!activeViewer || !canvas.current || !pipViewportEl.current || !controls.current.autoPipEnabled) {
      activeViewer?.setPipViewport(null);
      return;
    }
    const vpRect = pipViewportEl.current.getBoundingClientRect();
    const canvasRect = canvas.current.getBoundingClientRect();
    activeViewer.setPipViewport(domRectToBabylonViewport(vpRect, canvasRect));
  }, []);

  const restoreStageFromDocumentPip = useCallback(() => {
    if (stageEl.current && stageMount.current && stageEl.current.parentElement !== stageMount.current) {
      stageMount.current.appendChild(stageEl.current);
      viewerRef.current?.resizeNow();
      requestAnimationFrame(() => {
        viewerRef.current?.resizeNow();
        syncPipViewport();
      });
    }
  }, [syncPipViewport]);

  const closePopout = useCallback(async () => {
    const openWin = pipWindow.current;
    pipWindow.current = null;
    restoreStageFromDocumentPip();
    if (openWin && !openWin.closed) {
      try {
        openWin.close();
      } catch {
        // Ignore cross-window close errors.
      }
    }
    if (pipStream.current) {
      for (const track of pipStream.current.getTracks()) track.stop();
      pipStream.current = null;
    }
    if (pipVideo.current) {
      pipVideo.current.srcObject = null;
    }
    if (document.pictureInPictureElement && document.pictureInPictureElement === pipVideo.current) {
      try {
        await document.exitPictureInPicture();
      } catch {
        // Ignore if PIP already closed.
      }
    }
    setPopoutKind('none');
    scheduleFrameRef.current?.();
  }, [restoreStageFromDocumentPip]);

  useEffect(() => {
    return () => {
      void closePopout();
    };
  }, [closePopout]);

  useEffect(() => {
    let disposed = false;
    let viewer: import('../fps/fpsLiveViewer').FpsLiveViewer | undefined;
    let current = simulation.snapshot(), previous = current, lastHud = 0;
    let latest=current,playbackTime=current.time;
    const history:LiveSnapshot[]=[current];
    const audioQueue:{at:number;cues:FpsAudioCue[]}[]=[];
    let last: number | undefined;
    let lastPipActive = false;
    const fixed = new FpsFixedStepClock(LIVE_FPS_STEP);
    setFrame(current);
    setPlantPip(EMPTY_PLANT_PIP);
    setReady(false);
    setError('');
    setPaused(false);
    setNotice('');
    const visibility = () => {
      last = undefined;
      const docPipOpen = Boolean(pipWindow.current && !pipWindow.current.closed);
      if (document.hidden && !docPipOpen) {
        controls.current.paused = true;
        setPaused(true);
        setNotice('Exhibition paused while this tab is hidden. Resume when you are ready.');
      }
    };
    document.addEventListener('visibilitychange', visibility);
    import('../fps/fpsLiveViewer').then(({ FpsLiveViewer }) => {
      if (disposed || !canvas.current) return;
      viewer = new FpsLiveViewer(canvas.current, () => {
        controls.current.paused = true;
        setPaused(true);
        setError('The 3D graphics context was lost. Restart the exhibition to reconnect.');
      });
      viewer.setMap(current.mapId ?? mapId);
      viewer.setCutawayRoofs(controls.current.cutawayRoofs);
      viewer.setDebugOverlays(controls.current.debugOverlays);
      viewer.setOverview(controls.current.overviewCam);
      viewerRef.current = viewer;
      setReady(true);
      last = undefined;
      const loop = (now: number) => {
        if (disposed) return;
        try {
          const docPipOpen = Boolean(pipWindow.current && !pipWindow.current.closed);
          const elapsed = last === undefined ? 0 : Math.max(0, now - last) / 1000;
          last = last === undefined ? now : Math.max(last, now);
          if (!controls.current.paused && (!document.hidden || docPipOpen)) {
            const workStarted=performance.now();
            fixed.advance(elapsed,()=>{
              if(latest.phase==='finished')return;
              simulation.step();latest=simulation.snapshot();history.push(latest);
              const cues=simulation.drainAudioCues();
              if(cues.length)audioQueue.push({at:latest.time,cues});
            },4,()=>performance.now()-workStarted<5);
            playbackTime=latest.phase==='finished'?Math.min(latest.time,playbackTime+elapsed)
              :Math.max(history[0].time,latest.time-.9+Math.min(LIVE_FPS_STEP,fixed.pendingSeconds));
          }
          while(history.length>1&&history[1].time<=playbackTime)history.shift();
          previous=history[0];current=history[1]??previous;
          const broadcastAlpha=current.time>previous.time?Math.max(0,Math.min(1,(playbackTime-previous.time)/(current.time-previous.time))):1;
          const result=viewer!.render(previous,current,broadcastAlpha,controls.current.mode,controls.current.selected,elapsed,controls.current.autoPipEnabled,latest,controls.current.lineups);
          const listener=current.players.find(player=>player.id===result.followedId)??current.players[0];
          while(audioQueue.length&&audioQueue[0].at<=playbackTime){
            const batch=audioQueue.shift()!;
            if(listener)for(const cue of batch.cues)audioRef.current?.play(cue,listener);
          }

          const pipChanged = result.pip.active !== lastPipActive;
          if (pipChanged || now - lastHud >= 100) {
            lastPipActive = result.pip.active;
            setFrame(current);
            setFollowed(prev => prev === result.followedId ? prev : result.followedId);
            audioFollowedId.current=result.followedId;
            setEffectiveCamera(prev => prev === result.effectiveMode ? prev : result.effectiveMode);
            setPlantPip(prev => result.pip.active ? result.pip : (prev.active ? EMPTY_PLANT_PIP : prev));
            if (!result.pip.active) viewer?.setPipViewport(null);
            lastHud = now;
          }
          const targetWin = (pipWindow.current && !pipWindow.current.closed) ? pipWindow.current : window;
          rafWindow.current = targetWin;
          animId.current = targetWin.requestAnimationFrame(loop);
        } catch (problem) {
          controls.current.paused = true;
          setPaused(true);
          setError(problem instanceof Error ? problem.message : 'The live exhibition stopped.');
        }
      };
      scheduleFrameRef.current = () => {
        if (disposed) return;
        try {
          rafWindow.current.cancelAnimationFrame(animId.current);
        } catch {
          // Ignore stale RAF handle.
        }
        const targetWin = (pipWindow.current && !pipWindow.current.closed) ? pipWindow.current : window;
        rafWindow.current = targetWin;
        animId.current = targetWin.requestAnimationFrame(loop);
      };
      rafWindow.current = (pipWindow.current && !pipWindow.current.closed) ? pipWindow.current : window;
      animId.current = rafWindow.current.requestAnimationFrame(loop);
    }).catch(problem => {
      if (!disposed) setError(problem instanceof Error ? problem.message : 'This browser could not start 3D graphics.');
    });
    return () => {
      disposed = true;
      scheduleFrameRef.current = null;
      viewerRef.current = undefined;
      try {
        rafWindow.current.cancelAnimationFrame(animId.current);
      } catch {
        cancelAnimationFrame(animId.current);
      }
      document.removeEventListener('visibilitychange', visibility);
      viewer?.dispose();
    };
  }, [simulation]);

  useEffect(() => {
    if (!ready || !autoPipEnabled || !plantPip.active) {
      viewerRef.current?.setPipViewport(null);
      return;
    }
    syncPipViewport();
    const ro = new ResizeObserver(() => syncPipViewport());
    if (canvas.current) ro.observe(canvas.current);
    if (pipViewportEl.current) ro.observe(pipViewportEl.current);
    const activeWin = (pipWindow.current && !pipWindow.current.closed) ? pipWindow.current : window;
    activeWin.addEventListener('resize', syncPipViewport);
    return () => {
      ro.disconnect();
      activeWin.removeEventListener('resize', syncPipViewport);
    };
  }, [ready, autoPipEnabled, plantPip.active, popoutKind, hudOptions.callouts, hudOptions.playerDock, fullscreen, syncPipViewport]);

  const togglePopoutPip = async () => {
    if (popoutKind !== 'none') {
      await closePopout();
      return;
    }
    const docPip = (window as unknown as { documentPictureInPicture?: DocumentPictureInPictureApi }).documentPictureInPicture;
    if (docPip && stageEl.current) {
      try {
        setPopoutHudVisible(true);
        const win = await docPip.requestWindow({ width: 960, height: 540 });
        cloneDocumentStylesToPipWindow(document, win.document);
        win.document.title = 'HEXATRICK · Live Broadcast PIP';
        win.document.body.style.margin = '0';
        win.document.body.style.background = '#080c12';
        win.document.body.style.overflow = 'hidden';
        win.document.body.style.height = '100vh';
        win.document.body.className = 'live-fps__doc-pip-body';

        const wrapper = win.document.createElement('div');
        wrapper.className = 'live-fps__doc-pip-shell';
        wrapper.appendChild(stageEl.current);
        win.document.body.appendChild(wrapper);

        pipWindow.current = win;
        setPopoutKind('document');
        setNotice('');

        const onPipResize = () => {
          viewerRef.current?.resizeNow();
          syncPipViewport();
        };
        const onPageHide = () => {
          win.removeEventListener('resize', onPipResize);
          pipWindow.current = null;
          restoreStageFromDocumentPip();
          setPopoutKind('none');
          scheduleFrameRef.current?.();
        };
        win.addEventListener('resize', onPipResize);
        win.addEventListener('pagehide', onPageHide, { once: true });

        viewerRef.current?.resizeNow();
        win.requestAnimationFrame(() => {
          viewerRef.current?.resizeNow();
          syncPipViewport();
        });
        scheduleFrameRef.current?.();
        return;
      } catch (err) {
        restoreStageFromDocumentPip();
        pipWindow.current = null;
        setNotice(err instanceof Error ? err.message : 'Floating broadcast window could not be opened; trying video PIP.');
      }
    }

    const canvasEl = canvas.current as (HTMLCanvasElement & { captureStream?: (fps?: number) => MediaStream }) | null;
    const videoEl = pipVideo.current;
    if (canvasEl && videoEl && document.pictureInPictureEnabled && typeof canvasEl.captureStream === 'function') {
      try {
        const stream = canvasEl.captureStream(30);
        pipStream.current = stream;
        videoEl.srcObject = stream;
        await videoEl.play();
        await videoEl.requestPictureInPicture();
        setPopoutKind('video');
        setNotice('');
        videoEl.addEventListener(
          'leavepictureinpicture',
          () => {
            if (pipStream.current) {
              for (const t of pipStream.current.getTracks()) t.stop();
              pipStream.current = null;
            }
            videoEl.srcObject = null;
            setPopoutKind('none');
          },
          { once: true },
        );
        return;
      } catch {
        if (pipStream.current) {
          for (const t of pipStream.current.getTracks()) t.stop();
          pipStream.current = null;
        }
        videoEl.srcObject = null;
      }
    }
    setNotice('Browser pop-out Picture-in-Picture is unavailable in this browser.');
  };

  const observe = useCallback((p: LivePlayer) => {
    const prevMode = controls.current.mode;
    const nextMode = prevMode === 'director' || prevMode === 'cinematic' ? 'first' : prevMode;
    controls.current.selected = p.id;
    controls.current.mode = nextMode;
    audioFollowedId.current = p.id;
    setSelected(p.id);
    setFollowed(p.id);
    if (nextMode !== prevMode) {
      setMode(nextMode);
      setEffectiveCamera(nextMode === 'free' ? 'free' : nextMode === 'tactical' ? 'tactical' : nextMode === 'third' ? 'third' : 'first');
    }
    scheduleFrameRef.current?.();
  },[]);
  const togglePause = useCallback(() => {
    if(!controls.current.ready||controls.current.error||controls.current.phase==='finished')return;
    const next=!controls.current.paused;
    controls.current.paused=next;
    setPaused(next);
    setNotice('');
  },[]);
  const toggleFullscreen=useCallback(()=>{
    const target=popoutKind==='document'?stageEl.current:host.current;
    if(!target)return;
    const doc=target.ownerDocument;
    try{
      const task=doc.fullscreenElement?doc.exitFullscreen():target.requestFullscreen?.();
      if(!task){setNotice('Fullscreen is unavailable in this browser.');return;}
      void task.catch(()=>setNotice('Fullscreen is unavailable in this browser.'));
    }catch{setNotice('Fullscreen is unavailable in this browser.');}
  },[popoutKind]);

  useEffect(()=>{
    const docs=new Set([document,stageEl.current?.ownerDocument??document]);
    const onFullscreen=()=>setFullscreen([...docs].some(doc=>!!doc.fullscreenElement));
    const onKeyDown=(event:KeyboardEvent)=>{
      if(event.defaultPrevented||event.repeat||event.isComposing||event.altKey||event.ctrlKey||event.metaKey)return;
      const target=event.target as HTMLElement|null;
      if(target?.isContentEditable||target?.closest?.('input,textarea,select,[contenteditable="true"],[role="textbox"]'))return;
      const key=event.key.toLowerCase(),state=controls.current;
      if(event.key==='Escape'){setBuyMenuOpen(false);setHudMenuOpen(false);return;}
      if(key==='b'){event.preventDefault();setBuyMenuOpen(value=>{const next=!value;if(next)setHudMenuOpen(false);return next;});return;}
      if(key==='f'){event.preventDefault();toggleFullscreen();return;}
      if(!state.ready||state.error)return;
      if(event.code==='Space'){event.preventDefault();togglePause();return;}
      if(key==='c'){event.preventDefault();setOverviewCam(false);setMode(value=>cameraModes[(cameraModes.indexOf(value)+1)%cameraModes.length]);}
      if(key==='o'){event.preventDefault();setOverviewCam(value=>!value);}
      if(key==='p'){event.preventDefault();setAutoPipEnabled(value=>!value);}
      const slot='1234567890'.indexOf(event.key);
      if(slot>=0&&state.players[slot]?.hp>0){event.preventDefault();observe(state.players[slot]);}
    };
    for(const doc of docs){doc.addEventListener('keydown',onKeyDown);doc.addEventListener('fullscreenchange',onFullscreen);}
    onFullscreen();
    return ()=>{for(const doc of docs){doc.removeEventListener('keydown',onKeyDown);doc.removeEventListener('fullscreenchange',onFullscreen);}};
  },[popoutKind,toggleFullscreen,togglePause,observe]);
  const toggleSound = () => {
    const next=!soundEnabled;
    setSoundEnabled(next);
    audioRef.current?.setEnabled(next);
    if(next)audioRef.current?.activate();
  };
  const downloadDiagnostics = () => {
    const data = { format: 'hexatrick-local-fps-diagnostics-v4', seed: activeSeed, skillProfiles,
      learning:simulation.learningDiagnostics(),snapshot: simulation.snapshot() };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `hexatrick-fps-diagnostics-${activeSeed}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const observed = frame.players.find(p => p.id === followed) ?? frame.players[0];
  const scopeKind = effectiveCamera==='first'&&observed.hp>0&&observed.scopeState==='scoped'
    &&(observed.equipped==='sniper'||observed.equipped==='scout')?observed.equipped:undefined;
  const ctTeam=frame.attackTeam==='red'?'blue':'red',tTeam=frame.attackTeam;
  const forceScore={blue:frame.score[ctTeam],red:frame.score[tTeam]};
  const recent = frame.events.filter(e => e.kind==='kill'&&frame.time-e.time<9).slice(-5);
  const roundOver = frame.phase === 'post' || frame.phase === 'finished';
  const aliveBlue = frame.players.filter(p => !p.attacking && p.hp > 0).length;
  const aliveRed = frame.players.filter(p => p.attacking && p.hp > 0).length;
  const clutchLabel = (aliveBlue === 1 && aliveRed >= 1) ? `1v${aliveRed} CLUTCH` : (aliveRed === 1 && aliveBlue >= 1) ? `1v${aliveBlue} CLUTCH` : `${aliveBlue} v ${aliveRed}`;
  const isBlueDefending = true;
  const isRedDefending = false;
  const blueSideTitle = isBlueDefending ? 'CT FORCE' : 'T FORCE';
  const blueSideRole = isBlueDefending ? 'DEFEND' : 'ATTACK';
  const redSideTitle = isRedDefending ? 'CT FORCE' : 'T FORCE';
  const redSideRole = isRedDefending ? 'DEFEND' : 'ATTACK';

  // Dynamic AI Win Prediction Calculation (producer presentation)
  const blueAlive = frame.players.filter(p => !p.attacking && p.hp > 0);
  const redAlive = frame.players.filter(p => p.attacking && p.hp > 0);
  let bluePower = blueAlive.reduce((sum, p) => sum + p.hp * (p.equipped === 'sniper' ? 1.35 : p.equipped === 'rifle' ? 1.2 : 0.85), 0);
  let redPower = redAlive.reduce((sum, p) => sum + p.hp * (p.equipped === 'sniper' ? 1.35 : p.equipped === 'rifle' ? 1.2 : 0.85), 0);
  if (frame.bomb.status === 'planted') {
    redPower *= 1.75;
  }
  if (roundOver) {
    bluePower = frame.roundWinner === ctTeam ? 100 : 0;
    redPower = frame.roundWinner === tTeam ? 100 : 0;
  }
  const totalPower = bluePower + redPower || 1;
  const bluePct = Math.max(5, Math.min(95, Math.round((bluePower / totalPower) * 100)));
  const redPct = 100 - bluePct;

  const blueReports = (frame.teamReports ?? []).filter(r => r.team === ctTeam && frame.time - r.at < 14).slice(-3).reverse();
  const redReports = (frame.teamReports ?? []).filter(r => r.team === tTeam && frame.time - r.at < 14).slice(-3).reverse();

  const radarStaticLayers = useMemo(() => {
    const vb = mapRuntime.definition.broadcast.radarViewBox;
    const b = mapRuntime.definition.bounds;
    const rx = (x: number) => x - b.minX;
    const ry = (z: number) => b.maxZ - z;
    const rScale = vb.width / 72;
    const siteRadii = { A: mapRuntime.definition.siteRadii?.A ?? 5.5, B: mapRuntime.definition.siteRadii?.B ?? 5.5 };
    return (
      <>
        <rect x={vb.minX} y={vb.minY} width={vb.width} height={vb.height} fill="#08111beb" rx={4 * rScale} />
        {[-36, -24, -12, 0, 12, 24, 36].filter(gx => gx > b.minX && gx < b.maxX).map(gx => (
          <line key={`gx-${gx}`} x1={rx(gx)} y1={vb.minY} x2={rx(gx)} y2={vb.minY + vb.height} stroke="#14283b" strokeWidth={0.28 * rScale} />
        ))}
        {[-36, -18, 0, 18, 36].filter(gz => gz > b.minZ && gz < b.maxZ).map(gz => (
          <line key={`gz-${gz}`} x1={vb.minX} y1={ry(gz)} x2={vb.minX + vb.width} y2={ry(gz)} stroke="#14283b" strokeWidth={0.28 * rScale} />
        ))}
        {activeMapId === 'fontessa' ? (
          <>
            <rect x="0" y="43.2" width="72" height="2.2" fill="#367f90" opacity=".82" />
            <path d="M34.4 45.4h3.2v-4.8h19.2v2.2H37.6v2.6" fill="#83938b" stroke="#adc1ba" strokeWidth=".3" />
            <circle cx={rx(23)} cy={ry(21)} r="2.4" fill="#1b2f3d" stroke="#487894" strokeWidth=".35" />
            <rect x={rx(-30) - 1.5} y={ry(16) - 1.5} width="3" height="4.5" fill="#18232c" stroke="#425769" strokeWidth=".3" />
            <rect x={rx(-4.75) - 1.75} y={ry(-10) - 1.5} width="3.5" height="3" fill="#152432" stroke="#3f6685" strokeWidth=".3" strokeDasharray="1 .8" />
          </>
        ) : (
          <>
            {mapRuntime.terrain.groundPatches.filter(p => p.layer !== 'upper').map((p, pi) => (
              <rect
                key={p.id ?? `patch-${pi}`}
                x={rx(p.minX)}
                y={ry(p.maxZ)}
                width={p.maxX - p.minX}
                height={p.maxZ - p.minZ}
                fill={p.stair ? '#263f54' : p.height >= 4.5 ? '#192b3d' : p.height >= 2 ? '#122130' : '#0d1924'}
                fillOpacity={p.stair ? '.9' : '.72'}
                stroke={p.stair ? '#487496' : '#1f3448'}
                strokeWidth={0.22 * rScale}
              />
            ))}
            <rect x={rx(11)} y={ry(-5)} width={34} height={18} fill="#1f5866" fillOpacity=".78" stroke="#388ea1" strokeWidth={0.25 * rScale} />
            <rect x={rx(13.5)} y={ry(14)} width={6} height={19} fill="#1f5866" fillOpacity=".78" stroke="#388ea1" strokeWidth={0.25 * rScale} />
          </>
        )}
        {(['A', 'B'] as const).map(site => {
          const pos = mapRuntime.definition.sites[site];
          const rad = siteRadii[site];
          return (
            <rect
              key={`zone-${site}`}
              x={rx(pos.x) - rad}
              y={ry(pos.z) - rad}
              width={rad * 2}
              height={rad * 2}
              rx={1.8 * rScale}
              fill="#7a2525"
              fillOpacity=".32"
              stroke="#ef4444"
              strokeWidth={0.45 * rScale}
              strokeDasharray={`${1.6 * rScale} ${1.2 * rScale}`}
            />
          );
        })}
        {mapRuntime.definition.solids.map(w => (
          <rect
            key={w.id}
            x={rx(w.minX)}
            y={ry(w.maxZ)}
            width={w.maxX - w.minX}
            height={w.maxZ - w.minZ}
            fill={w.cutawayGroup ? '#334e66' : '#253b50'}
            fillOpacity={w.cutawayGroup ? (hudOptions.cutawayRoofs ? '.12' : '.36') : '1'}
            stroke={w.cutawayGroup ? '#6084a3' : '#486680'}
            strokeDasharray={w.cutawayGroup ? `${1.1 * rScale} ${0.8 * rScale}` : undefined}
            strokeWidth={0.32 * rScale}
          />
        ))}
        {activeMapId === 'fontessa' ? (
          <g aria-label="Elevated B apartments and staircase">
            {mapRuntime.terrain.terrainSolids.filter(w => !w.baseY && !w.cutawayGroup).map(w => (
              <rect key={w.id} x={rx(w.minX)} y={ry(w.maxZ)} width={w.maxX - w.minX} height={w.maxZ - w.minZ} fill="#426d7d" stroke="#79a4ad" strokeWidth=".18" />
            ))}
            <text x={rx(31.8)} y={ry(14) + .6} textAnchor="middle" fontSize="2" fill="#e5dfbd">↑</text>
          </g>
        ) : (
          <g aria-label="Cantilevered Control Deck upper layer">
            {mapRuntime.terrain.groundPatches.filter(p => p.layer === 'upper').map((p, ui) => (
              <rect
                key={p.id ?? `upper-${ui}`}
                x={rx(p.minX)}
                y={ry(p.maxZ)}
                width={p.maxX - p.minX}
                height={p.maxZ - p.minZ}
                fill="#234857"
                fillOpacity=".68"
                stroke="#38bdf8"
                strokeDasharray={`${1.2 * rScale} ${0.8 * rScale}`}
                strokeWidth={0.35 * rScale}
              />
            ))}
          </g>
        )}
        {activeMapId === 'fontessa' ? (
          <>
            <text x="36" y="42.5" fill="#7da1bd" fillOpacity=".7" fontSize="2.4" fontWeight="800" textAnchor="middle">MID</text>
            <text x="36" y="25.5" fill="#7da1bd" fillOpacity=".68" fontSize="2.1" fontWeight="700" textAnchor="middle">WINDOW</text>
            <text x="15" y="44.9" fill="#9bd7e5" fillOpacity=".72" fontSize="2" fontWeight="700" textAnchor="middle">CANAL</text>
            <text x="58" y="54.5" fill="#7da1bd" fillOpacity=".68" fontSize="2" fontWeight="700" textAnchor="middle">APTS</text>
          </>
        ) : (
          mapRuntime.definition.tactical.callouts.map(c => (
            <text
              key={c.name}
              x={rx(c.x)}
              y={ry(c.z)}
              fill={c.level === 'upper' ? '#7dd3fc' : '#7da1bd'}
              fillOpacity=".7"
              fontSize={2.2 * rScale}
              fontWeight="700"
              textAnchor="middle"
            >
              {c.name.split(' (')[0].toUpperCase()}
            </text>
          ))
        )}
        {(Object.entries(mapRuntime.definition.sites) as ['A' | 'B', { x: number; z: number }][]).map(([site, p]) => {
          const sz = 5.6 * rScale;
          return (
            <g key={site}>
              <rect x={rx(p.x) - sz / 2} y={ry(p.z) - sz / 2} width={sz} height={sz} rx={1.2 * rScale} fill="#dc2626" stroke="#ffffff" strokeWidth={0.4 * rScale} />
              <text x={rx(p.x)} y={ry(p.z) + 1.6 * rScale} fill="#ffffff" fontSize={4.2 * rScale} fontWeight="900" textAnchor="middle">{site}</text>
            </g>
          );
        })}
      </>
    );
  }, [activeMapId, mapRuntime, hudOptions.cutawayRoofs]);

  return (
    <section
      className={`live-fps ${fullscreen ? 'is-fullscreen' : ''}`}
      data-presentation={presentation.layout} data-organizer={presentation.id} style={presentationStyle}
      ref={host}
      aria-label="Hexatrick live 3D exhibition"
      tabIndex={0}
      onPointerDownCapture={() => audioRef.current?.activate()}

    >
      {/* 3D Stage Viewport with producer broadcast HUD (supports reparenting into Document PIP window) */}
      <div className="live-fps__stage-container">
        {popoutKind === 'document' && (
          <div className="live-fps__popout-placeholder" role="status">
            <strong>Broadcast popped out in floating PIP window</strong>
            <span>Main camera continues tracking kills while C4 plant PIP activates on plants.</span>
            <button type="button" onClick={() => void closePopout()}>Return broadcast to tab</button>
          </div>
        )}
        <div ref={stageMount} className="live-fps__stage-mount">
          <div ref={stageEl} className="live-fps__stage" data-presentation={presentation.layout} data-organizer={presentation.id} style={presentationStyle} onPointerDownCapture={() => audioRef.current?.activate()}>
            <div className="live-fps__camera-view">
            <canvas ref={canvas} className="live-fps__canvas" aria-label="Live 3D match." />
            {popoutKind === 'document' && <div className="live-fps__pip-controls">
              <button type="button" className="live-fps__pip-hud-toggle" onClick={() => setPopoutHudVisible(value => !value)} aria-pressed={popoutHudVisible} aria-label={popoutHudVisible ? 'Hide broadcast HUD' : 'Show broadcast HUD'}>{popoutHudVisible ? 'Hide HUD' : 'Show HUD'}</button>
              <button type="button" className="live-fps__pip-hud-toggle" onClick={toggleSound} aria-pressed={soundEnabled} aria-label={soundEnabled ? 'Mute FPS sound' : 'Enable FPS sound'}>{soundEnabled ? 'Sound On' : 'Sound Off'}</button>
            </div>}
            <div className="live-fps__stage-hud" hidden={popoutKind === 'document' && !popoutHudVisible}>

        {/* Top-Left Tournament Pill */}
        <div className="broadcast-series-badge">
          <span className="broadcast-series-brand">{presentation.name}</span>
          <span className="broadcast-series-divider">/</span>
          <span className="broadcast-series-event">EXHIBITION</span>
          <span className="broadcast-series-map">{mapRuntime.definition.broadcast.displayName}</span>
        </div>

        {/* In-Game Top-Right Broadcast Options & Controls */}
        <div className="broadcast-stage-controls" role="toolbar" aria-label="In-game broadcast options">
          <button type="button" className={overviewCam ? 'is-active' : undefined} disabled={!ready||!!error} onClick={()=>setOverviewCam(value=>!value)} title="Toggle Full-Map Overview Camera (O)" aria-pressed={overviewCam}>
            Overview
          </button>
          <button type="button" className={mode==='free' ? 'is-active' : undefined} disabled={!ready||!!error} onClick={()=>{setOverviewCam(false);setMode(value=>value==='free'?'director':'free');}} title="Toggle Free Camera">
            {mode === 'free' ? 'Auto cam' : 'Free cam'}
          </button>
          <button type="button" className={paused ? 'is-paused' : undefined} disabled={!ready || !!error || frame.phase === 'finished'} onClick={togglePause} title="Pause or resume (Space)" aria-pressed={paused}>
            {paused ? '▶ Resume' : '⏸ Pause'}
          </button>
          <button
            type="button"
            className={buyMenuOpen ? 'is-active' : undefined}
            aria-expanded={buyMenuOpen}
            onClick={() => { setBuyMenuOpen(v => !v); setHudMenuOpen(false); }}
            title="Show purchasable weapons & items (B)"
          >
            Buy List <kbd className="broadcast-toolbar-kbd">B</kbd>
          </button>
          <button type="button" className={hudMenuOpen ? 'is-active' : undefined} aria-expanded={hudMenuOpen} onClick={() => { setHudMenuOpen(v => !v); setBuyMenuOpen(false); }} title="Show or hide HUD elements and match options">
            Options
          </button>
          <button type="button" className={fullscreen ? 'is-active' : undefined} onClick={toggleFullscreen} title="Toggle Fullscreen (F)">
            {fullscreen ? 'Exit FS' : 'Full'}
          </button>
          <button type="button" className="broadcast-stage-controls__exit" onClick={onExit} title="Exit match">
            Exit
          </button>
          {hudMenuOpen && (
            <div className="broadcast-hud-menu" role="dialog" aria-label="HUD display and broadcast options">
              <div className="broadcast-hud-menu__header">
                <strong>HUD &amp; Broadcast</strong>
                <button type="button" className="broadcast-hud-menu__close" onClick={() => setHudMenuOpen(false)} aria-label="Close options">×</button>
              </div>
              <div className="broadcast-hud-menu__toggles">
                <label><input type="checkbox" checked={hudOptions.scoreboard} onChange={() => toggleHudOption('scoreboard')} /> Scoreboard &amp; Odds</label>
                <label><input type="checkbox" checked={hudOptions.minimap} onChange={() => toggleHudOption('minimap')} /> Minimap Radar</label>
                <label><input type="checkbox" checked={hudOptions.killfeed} onChange={() => toggleHudOption('killfeed')} /> Killfeed</label>
                <label><input type="checkbox" checked={hudOptions.callouts} onChange={() => toggleHudOption('callouts')} /> Team Callouts (CT / T)</label>
                <label><input type="checkbox" checked={hudOptions.playerDock} onChange={() => toggleHudOption('playerDock')} /> Player Dock &amp; Focus</label>
                <label><input type="checkbox" checked={hudOptions.lineups} onChange={() => toggleHudOption('lineups')} /> Grenade Lineup Lines</label>
                <label><input type="checkbox" checked={hudOptions.cutawayRoofs} onChange={() => toggleHudOption('cutawayRoofs')} /> Cutaway Roofs &amp; Overpasses</label>
                <label><input type="checkbox" checked={hudOptions.debugOverlays} onChange={() => toggleHudOption('debugOverlays')} /> Tactical Nav &amp; Drop Overlays</label>
                <label><input type="checkbox" checked={overviewCam} onChange={() => setOverviewCam(v => !v)} /> Map Overview Cam</label>
                <label><input type="checkbox" checked={autoPipEnabled} onChange={() => setAutoPipEnabled(v => !v)} /> Bomb Plant PIP</label>
                <label><input type="checkbox" checked={soundEnabled} onChange={toggleSound} /> FPS Audio</label>
              </div>
              <div className="broadcast-hud-menu__actions">
                <label className="live-fps__presentation-select">Broadcast theme
                  <select value={presentation.id} onChange={event=>{
                    const id=fpsBroadcastPresentation(event.target.value,organizers,activeMapId).id;setProducer(id);
                    try{window.localStorage.setItem('hexatrick:fps-presentation',id);}catch{}
                  }}>{organizers.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
                </label>
                <div className="broadcast-hud-menu__btn-row">
                  <button type="button" onClick={() => { setAttempt(v => v + 1); setHudMenuOpen(false); }}>New match</button>
                  <button type="button" disabled={!ready || !!error} onClick={() => void togglePopoutPip()}>{popoutKind !== 'none' ? 'Close pop-out' : 'Pop-out video'}</button>
                  <button type="button" onClick={downloadDiagnostics}>Diagnostics</button>
                </div>
                <a className="broadcast-hud-menu__link" href={pediaHref('organizers',presentation.id)}>Organizer in Hexapedia</a>
              </div>
              {frame.learning&&<span className="live-fps__learning-status" role="status">Routes · {frame.learning.rounds}r · {frame.learning.updates} upd</span>}
              <p className="live-fps__shortcut-hint"><kbd>Space</kbd> pause · <kbd>O</kbd> overview · <kbd>B</kbd> buy list · <kbd>F</kbd> full · <kbd>C</kbd> cam · <kbd>1-0</kbd> POV · <kbd>P</kbd> PIP</p>
            </div>
          )}
        </div>

        {(frame.phase==='post'&&frame.remaining>4.5||frame.phase==='finished')&&<div key={`${producer}:${frame.round}:${frame.phase}`} className={`broadcast-stinger broadcast-stinger--${frame.phase}`} role="status">
          <span>{presentation.name} / {presentation.package}</span>
          <strong>{frame.phase==='finished'?'MATCH COMPLETE':frame.phase==='post'?presentation.round:presentation.intro}</strong>
          <small>{roundOver?`${frame.roundWinner===ctTeam?'CT FORCE':'T FORCE'} · ${frame.roundReason}`:`ROUND ${frame.round} · BLUE ${frame.score.blue} — ${frame.score.red} RED`}</small>
        </div>}

        {overviewCam && mode !== 'free' && <div className="broadcast-coverage-label">OVERVIEW · {mapRuntime.definition.broadcast.displayName.toUpperCase()}</div>}
        {!overviewCam && effectiveCamera==='tactical'&&<div className="broadcast-coverage-label">MULTIPLE ENGAGEMENTS</div>}
        {mode==='free'&&<div className="broadcast-coverage-label" style={{pointerEvents:'none'}}>FREE CAM · Click map · WASD move · Q/E down/up · Drag to look · Shift faster · Space pause</div>}
        {paused && ready && !error && frame.phase !== 'finished' && (
          <div className="broadcast-pause-banner" role="status" aria-live="polite">
            <span className="broadcast-pause-banner__dot">⏸</span>
            <strong>BROADCAST PAUSED</strong>
            <span className="broadcast-pause-banner__hint">Press <kbd>Space</kbd> or click to continue</span>
            <button type="button" onClick={togglePause}>Resume</button>
          </div>
        )}
        {/* Top-Center Scoreboard (producer presentation) */}
        {hudOptions.scoreboard && (
          <BroadcastScoreboard
            frame={{...frame,score:forceScore}}
            blueSideTitle={blueSideTitle}
            blueSideRole={blueSideRole}
            isBlueDefending={isBlueDefending}
            redSideTitle={redSideTitle}
            redSideRole={redSideRole}
            isRedDefending={isRedDefending}
            clutchLabel={clutchLabel}
            bluePct={bluePct}
            redPct={redPct}
            paused={paused}
          />
        )}

        {/* Enlarged Tactical Minimap Radar (Top Left below series badge) */}
        {hudOptions.minimap && (() => {
          const vb = mapRuntime.definition.broadcast.radarViewBox;
          const b = mapRuntime.definition.bounds;
          const rx = (x: number) => x - b.minX;
          const ry = (z: number) => b.maxZ - z;
          const rScale = vb.width / 72;
          return (
            <svg className="broadcast-radar" viewBox={`${vb.minX} ${vb.minY} ${vb.width} ${vb.height}`} role="img" aria-label={`${mapRuntime.definition.broadcast.displayName} tactical minimap`}>
              {radarStaticLayers}

              {/* Smokes & Fire */}
              {frame.smokes.map(s => <circle key={s.id} cx={rx(s.x)} cy={ry(s.z)} r={s.radius} fill="#cbd5e1" opacity=".52" />)}
              {frame.fires.map(f => <circle key={f.id} cx={rx(f.x)} cy={ry(f.z)} r={f.radius} fill="#f97316" opacity=".4" />)}

              {/* Released utility only; preparation never reveals a trajectory. */}
              {hudOptions.lineups && frame.grenades.map(g => {
                if (frame.time < g.releaseAt) return null;
                const stroke = g.team === frame.attackTeam ? '#fb7185' : '#60a5fa';
                const gx = rx(g.x);
                const gy = ry(g.z);
                const elapsed = Math.min(0.16, Math.max(0, frame.time - g.releaseAt));
                const tx = rx(g.x - g.vx * elapsed);
                const ty = ry(g.z - g.vz * elapsed);
                const nearDetonation = g.detonateAt - frame.time <= 0.22;
                const forecast = nearDetonation ? predictLiveGrenade(g, frame.time, mapRuntime) : undefined;
                return (
                  <g key={`grenade-line-${g.id}`} opacity=".92">
                    <line x1={tx} y1={ty} x2={gx} y2={gy} stroke={stroke} strokeWidth={0.7 * rScale} strokeDasharray={`${1.6 * rScale} ${0.9 * rScale}`} />
                    {forecast && <circle cx={rx(forecast.x)} cy={ry(forecast.z)} r={1.3 * rScale} fill="none" stroke={stroke} strokeWidth={0.48 * rScale} />}
                    <circle cx={gx} cy={gy} r={0.8 * rScale} fill="#ffffff" stroke={stroke} strokeWidth={0.4 * rScale} />
                  </g>
                );
              })}

              {/* Dropped weapons */}
              {frame.droppedWeapons?.map(w => (
                <g key={w.id}>
                  <circle cx={rx(w.x)} cy={ry(w.z)} r={1.1 * rScale} fill="#eab308" stroke="#ffffff" strokeWidth={0.25 * rScale} />
                  <text x={rx(w.x)} y={ry(w.z) + 0.4 * rScale} fill="#000000" fontSize={1.0 * rScale} fontWeight="bold" textAnchor="middle">W</text>
                </g>
              ))}

              {/* Players with strict eye-level vision cones & slot numbers */}
              {frame.players.map((p, idx) => {
                const px = rx(p.x), pz = ry(p.z);
                if (p.hp <= 0) {
                  return (
                    <text key={p.id} x={px} y={pz + 0.9 * rScale} fill={p.attacking ? '#fca5a5' : '#93c5fd'} fillOpacity=".55" fontSize={2.3 * rScale} fontWeight="900" textAnchor="middle">×</text>
                  );
                }
                const coneLen = 4.6 * rScale;
                const halfFov = 0.82; // 47 degree half-angle
                const leftAngle = p.yaw - halfFov, rightAngle = p.yaw + halfFov;
                const lx = px + Math.sin(leftAngle) * coneLen, lz = pz - Math.cos(leftAngle) * coneLen;
                const rxCone = px + Math.sin(rightAngle) * coneLen, rzCone = pz - Math.cos(rightAngle) * coneLen;
                const teamColor = p.attacking ? '#ef4444' : '#38bdf8';
                const slotNum = String((idx + 1) % 10);
                const isObs = p.id === followed;
                const onUpper = p.level === 'upper';
                return (
                  <g key={p.id}>
                    <polygon points={`${px},${pz} ${lx},${lz} ${rxCone},${rzCone}`} fill={teamColor} fillOpacity={isObs ? '.34' : '.2'} />
                    {onUpper && <circle cx={px} cy={pz} r={2.65 * rScale} fill="none" stroke="#facc15" strokeWidth={0.45 * rScale} strokeDasharray={`${0.9 * rScale} ${0.6 * rScale}`} />}
                    <circle cx={px} cy={pz} r={(isObs ? 2.45 : 1.75) * rScale} fill={teamColor} stroke={isObs ? '#facc15' : '#060c13'} strokeWidth={(isObs ? .75 : .45) * rScale} />
                    <line x1={px} y1={pz} x2={px + Math.sin(p.yaw) * 3.5 * rScale} y2={pz - Math.cos(p.yaw) * 3.5 * rScale} stroke="#ffffff" strokeWidth={0.45 * rScale} />
                    <text x={px} y={pz + 0.8 * rScale} fill="#ffffff" fontSize={2.2 * rScale} fontWeight="900" textAnchor="middle">{slotNum}</text>
                  </g>
                );
              })}

              {/* Bomb indicator */}
              {(frame.bomb.status === 'planted' || frame.bomb.status === 'dropped') && (
                <g>
                  <rect x={rx(frame.bomb.x) - 1.7 * rScale} y={ry(frame.bomb.z) - 1.7 * rScale} width={3.4 * rScale} height={3.4 * rScale} rx={0.7 * rScale} fill="#facc15" stroke="#1e293b" strokeWidth={0.4 * rScale} />
                  <circle cx={rx(frame.bomb.x)} cy={ry(frame.bomb.z)} r={0.8 * rScale} fill="#ef4444" />
                </g>
              )}
            </svg>
          );
        })()}

        {/* In-Game Left Team Callouts (CT / BLUE) */}
        {hudOptions.callouts && (
          <aside className="broadcast-callout-feed broadcast-callout-feed--blue" aria-label="CT Force in-game callouts">
            <div className="broadcast-callout-feed__head">
              <span className="broadcast-callout-feed__team">CT / BLUE COMMS</span>
              <span className="broadcast-callout-feed__plan">{fpsBroadcastText(frame.teams[ctTeam].information, activeMapId)}</span>
            </div>
            <div className="broadcast-callout-feed__list">
              {blueReports.map(r => (
                <div key={r.id} className="broadcast-callout-feed__item broadcast-callout-feed__item--blue">
                  <span className="broadcast-callout-feed__sender">{r.name}</span>
                  <span className="broadcast-callout-feed__msg">{fpsBroadcastText(r.message, activeMapId)}</span>
                  <time className="broadcast-callout-feed__age">{Math.max(0, Math.floor(frame.time - r.at))}s</time>
                </div>
              ))}
            </div>
          </aside>
        )}

        {/* Live killfeed (Top Right below controls) */}
        {hudOptions.killfeed && (
        <div className="broadcast-killfeed" aria-label="Recent frags">
          {recent.map(e => {
            if (e.kind === 'kill') {
              const killer = frame.players.find(p => p.id === e.actorId);
              const victim = frame.players.find(p => p.id === e.targetId);
              if (e.weapon === 'bomb' && victim) {
                return <div key={e.id} className="broadcast-killfeed__item"><span className="broadcast-killfeed__name broadcast-killfeed__name--neutral">C4</span><span className="broadcast-killfeed__weapon"><WeaponSilhouette weapon="bomb" /></span><span className={`broadcast-killfeed__name broadcast-killfeed__name--${victim.attacking?'red':'blue'}`}>{victim.name}</span></div>;
              }
              if (killer && victim) {
                return (
                  <div key={e.id} className="broadcast-killfeed__item">
                    <span className={`broadcast-killfeed__name broadcast-killfeed__name--${killer.attacking?'red':'blue'}`}>{killer.name}</span>
                    <span className="broadcast-killfeed__weapon">
                      <WeaponSilhouette weapon={e.weapon === 'knife' ? 'knife' : e.weapon ?? 'rifle'} />
                    </span>
                    {e.headshot && (
                      <span className="broadcast-killfeed__hs" title="Headshot">
                        <svg viewBox="0 0 16 16" width="14" height="14" fill="#ef4444">
                          <circle cx="8" cy="8" r="6" stroke="#ef4444" strokeWidth="1.5" fill="none" />
                          <line x1="8" y1="0" x2="8" y2="4" stroke="#ef4444" strokeWidth="1.5" />
                          <line x1="8" y1="12" x2="8" y2="16" stroke="#ef4444" strokeWidth="1.5" />
                          <line x1="0" y1="8" x2="4" y2="8" stroke="#ef4444" strokeWidth="1.5" />
                          <line x1="12" y1="8" x2="16" y2="8" stroke="#ef4444" strokeWidth="1.5" />
                          <circle cx="8" cy="8" r="1.5" fill="#ef4444" />
                        </svg>
                      </span>
                    )}
                    {e.wallbang&&<span className="broadcast-killfeed__modifier" title="Wall penetration"><svg viewBox="0 0 24 24" aria-label="Wallbang"><path d="M8 2v20m8-20v20M1 12h21m-5-5 5 5-5 5"/></svg></span>}
                    {e.noScope&&<span className="broadcast-killfeed__modifier" title="Unscoped sniper kill"><svg viewBox="0 0 24 24" aria-label="No scope"><circle cx="12" cy="12" r="7"/><path d="M2 2l20 20M12 1v5m0 12v5M1 12h5m12 0h5"/></svg></span>}
                    <span className={`broadcast-killfeed__name broadcast-killfeed__name--${victim.attacking?'red':'blue'}`}>{victim.name}</span>
                  </div>
                );
              }
            }
            return null;
          })}
        </div>
        )}

        {effectiveCamera==='first'&&observed.hp>0&&<FpsIncomingFire frame={frame} player={observed}/>}
        {/* In-Eye Crosshair & Flashbang Blind */}
        {scopeKind && <div className={`live-fps__scope live-fps__scope--${scopeKind}`} aria-label={`${LIVE_WEAPONS[scopeKind].name} scope`}>
          <span className="live-fps__scope-lens"><span className="live-fps__scope-reticle" /></span>
        </div>}
        {effectiveCamera === 'first' && !scopeKind && !['sniper','scout'].includes(observed.equipped) && <div className="live-fps__crosshair" aria-hidden="true" />}
        {observed.blinded > .2 && effectiveCamera === 'first' && (
          <div className="live-fps__flash" style={{ opacity: Math.min(.85, observed.blinded / 3) }} aria-hidden="true" />
        )}

        {/* Right Bottom Stack: Bomb Plant PIP (when active & not observing planter) + In-Game T Team Callouts */}
        <div className="broadcast-right-bottom-stack">
          {autoPipEnabled && plantPip.active && (
            <aside className={`broadcast-pip ${plantPipHudVisible ? '' : 'broadcast-pip--hud-hidden'}`} aria-label={`Bomb plant Picture-in-Picture at Site ${plantPip.site ?? 'A'}`}>
              {plantPipHudVisible && <header className="broadcast-pip__header">
                <div className="broadcast-pip__title-group">
                  <span className={`broadcast-pip__dot ${plantPip.phase === 'planted' ? 'broadcast-pip__dot--armed' : ''}`} />
                  <span className="broadcast-pip__badge">
                    {plantPip.phase === 'planted' ? `BOMB PLANTED · SITE ${plantPip.site ?? 'A'}` : `PLANTING C4 · SITE ${plantPip.site ?? 'A'}`}
                  </span>
                </div>
                <div className="broadcast-pip__meta">
                  {plantPip.planterName && <span className="broadcast-pip__planter">{plantPip.planterName}</span>}
                  <span className="broadcast-pip__timer">
                    {plantPip.phase === 'planted'
                      ? 'ARMED'
                      : `${Math.min(plantPip.duration, plantPip.progress * plantPip.duration).toFixed(1)}s`}
                  </span>
                  <button type="button" className="broadcast-pip__hud-toggle" onClick={() => setPlantPipHudVisible(false)} aria-label="Hide bomb PIP HUD" title="Hide PIP HUD">Hide HUD</button>
                  <button
                    type="button"
                    className="broadcast-pip__close"
                    onClick={() => setAutoPipEnabled(false)}
                    aria-label="Hide bomb plant PIP"
                    title="Hide Bomb Plant PIP"
                  >
                    ×
                  </button>
                </div>
              </header>}
              <div ref={pipViewportEl} className="broadcast-pip__viewport">
                {plantPipHudVisible ? <span className="broadcast-pip__cam-label">PLANT CAM · SITE {plantPip.site ?? 'A'}</span> : <button type="button" className="broadcast-pip__hud-reveal" onClick={() => setPlantPipHudVisible(true)} aria-label="Show bomb PIP HUD">Show HUD</button>}
              </div>
              {plantPipHudVisible && <footer className="broadcast-pip__footer">
                <div className="broadcast-pip__progress-track">
                  <div
                    className={`broadcast-pip__progress-fill ${plantPip.phase === 'planted' ? 'broadcast-pip__progress-fill--armed' : ''}`}
                    style={{ width: `${Math.round(plantPip.progress * 100)}%` }}
                  />
                </div>
              </footer>}
            </aside>
          )}

          {hudOptions.callouts && (
            <aside className="broadcast-callout-feed broadcast-callout-feed--red" aria-label="T Force in-game callouts">
              <div className="broadcast-callout-feed__head">
                <span className="broadcast-callout-feed__team">T / RED COMMS</span>
                <span className="broadcast-callout-feed__plan">{fpsBroadcastText(frame.teams[tTeam].information, activeMapId)}</span>
              </div>
              <div className="broadcast-callout-feed__list">
                {redReports.map(r => (
                  <div key={r.id} className="broadcast-callout-feed__item broadcast-callout-feed__item--red">
                    <time className="broadcast-callout-feed__age">{Math.max(0, Math.floor(frame.time - r.at))}s</time>
                    <span className="broadcast-callout-feed__msg">{fpsBroadcastText(r.message, activeMapId)}</span>
                    <span className="broadcast-callout-feed__sender">{r.name}</span>
                  </div>
                ))}
              </div>
            </aside>
          )}
        </div>

        {buyMenuOpen && observed && (
          <BroadcastArmoryModal
            observed={observed}
            sideFilter={buySideFilter}
            onSideFilterChange={setBuySideFilter}
            onClose={() => setBuyMenuOpen(false)}
          />
        )}

        {frame.phase==='finished'&&<button type="button" className="broadcast-finish-exit" onClick={onExit}>Back to match setup</button>}

        {/* Loading / Error Display */}
        {(!ready || error) && (
          <div className="live-fps__loading" role={error ? 'alert' : 'status'}>
            <h2>{error ? 'Broadcast unavailable' : 'Opening the 3D broadcast'}</h2>
            <p>{error || `Preparing ${mapRuntime.definition.broadcast.displayName}…`}</p>
            {error && <button type="button" onClick={() => setAttempt(v => v + 1)}>Restart exhibition</button>}
          </div>
        )}
            </div>
            </div>
        {/* Broadcast Bottom 10-Player Dock */}
        <div className="broadcast-bottom-dock" hidden={!hudOptions.playerDock || (popoutKind==='document'&&!popoutHudVisible)} aria-label="CT and T player dock">
          {/* Left 5: Blue Team */}
          <div className="broadcast-roster-group broadcast-roster-group--blue">
            {frame.players.filter(p => !p.attacking).map(p => (
              <BroadcastPlayerCard key={p.id} p={p} slotLabel={String((frame.players.indexOf(p) + 1) % 10)} followed={followed} onSelect={observe} />
            ))}
          </div>

          {/* Center: Spectator Cam & Active Player Detail */}
          {observed && (
            <BroadcastCenterFocusCard
              observed={observed}
              mode={mode}
              mapId={activeMapId}
              onSelectCamera={cm => { setOverviewCam(false); setMode(cm); }}
            />
          )}

          {/* Right 5: Red Team */}
          <div className="broadcast-roster-group broadcast-roster-group--red">
            {frame.players.filter(p => p.attacking).map(p => (
              <BroadcastPlayerCard key={p.id} p={p} slotLabel={String((frame.players.indexOf(p) + 1) % 10)} followed={followed} onSelect={observe} />
            ))}
          </div>
        </div>

          </div>
        </div>
      </div>

      {/* Offscreen video stream carrier for fallback browser Picture-in-Picture */}
      <video
        ref={pipVideo}
        muted
        playsInline
        aria-hidden="true"
        className="live-fps__pip-video"
      />

      {/* Deep Match Impact Summary Table */}
      <details className="live-fps__impact">
        <summary>Player impact beyond kills</summary>
        <p>Measured actions from this exhibition. Compare players in their assigned roles and round context; these figures are not an overall player rating.</p>
        <div className="live-fps__impact-scroll">
          <table>
            <thead>
              <tr>
                <th>Player / role</th>
                <th>Damage</th>
                <th>Headshots</th>
                <th>Opening wins / attempts</th>
                <th>Trades</th>
                <th>Deaths traded</th>
                <th>Flash assists</th>
                <th>First-shot hits</th>
                <th>Time to damage</th>
                <th>Unused utility on death</th>
                <th>Survival</th>
                <th>Plants / defuses</th>
              </tr>
            </thead>
            <tbody>
              {frame.players.map(p => {
                const m = p.impact;
                return (
                  <tr key={p.id}>
                    <th>
                      <span className={`live-fps__${p.attacking?'red':'blue'}`}>{p.name}</span>
                      <small title={p.naturalIdentity}>{p.position?FPS_POSITION_LABELS[p.position]:p.role}</small>
                    </th>
                    <td>{Math.round(m.damage)}</td>
                    <td><b>{m.headshots}</b> <small>({liveImpactRate(m.headshots, m.hits)} HS)</small></td>
                    <td>{m.openingKills} / {m.openingAttempts}</td>
                    <td>{m.tradeKills}</td>
                    <td>{liveImpactRate(m.tradedDeaths, p.deaths)} <small>({m.tradedDeaths}/{p.deaths})</small></td>
                    <td>{m.flashAssists}</td>
                    <td>{liveImpactRate(m.firstShotHits, m.firstShots)} <small>({m.firstShotHits}/{m.firstShots})</small></td>
                    <td>{m.timeToDamageSamples ? `${Math.round(m.timeToDamageMs / m.timeToDamageSamples)} ms` : '—'}<small>{m.timeToDamageSamples} samples</small></td>
                    <td>{m.unusedUtilityOnDeath}</td>
                    <td>{liveImpactRate(m.roundsSurvived, m.roundsCompleted)}<small>{m.roundsCompleted} completed rounds</small></td>
                    <td>{m.plants} / {m.defuses}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p>Opening attempts count players firing before the first elimination. Headshots show total direct headshot impacts and headshot-to-hit ratio. First-shot samples start on target acquisition; damage time starts at detection. Trades use a 1.5-second window. Flash assists require an ally's active blind. Utility counts cover flashes, smokes, fire and HE grenades. Survival uses completed rounds.</p>
      </details>

      <footer className="live-fps__footer">
        <span>{presentation.name} presentation · {mapRuntime.definition.broadcast.displayName} · {mapRuntime.definition.broadcast.subtitle} · Local exhibition</span>
        <span>Click any player card to observe · Space: pause · O: overview · B: buy list · C: camera · P: plant PIP · 1–0: players</span>
      </footer>
      {notice && <p className="live-fps__notice" role="status">{notice}</p>}
    </section>
  );
}
