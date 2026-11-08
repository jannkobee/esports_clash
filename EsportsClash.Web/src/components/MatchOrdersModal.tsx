import React, { useState } from 'react';
import {
  AvatarRole,
  IndividualOrder,
  MatchAttitude,
  MatchOrders,
  PlayerCard,
  ScheduledFixture,
  TacticalDoctrine
} from '../types';
import { getHattrickDescriptor, toScale10 } from '../marketBatchEngine';
import { sound } from '../audio';
import { CheckCircle2, ClipboardList, Flame, Shield, Sparkles, Swords, Users } from 'lucide-react';

interface MatchOrdersModalProps {
  fixture: ScheduledFixture;
  startingFive: PlayerCard[];
  bench: PlayerCard[];
  existingOrders?: MatchOrders;
  onSaveOrders: (orders: MatchOrders) => void;
  onSaveAndSimulateNow?: (orders: MatchOrders) => void;
  onSwapStarter?: (slotIdx: number, benchPlayerId: string) => void;
  onClose: () => void;
}

const ALL_ROLES: AvatarRole[] = ['Tank', 'Fighter', 'Assassin', 'Mage', 'Marksman', 'Support'];

const INDIVIDUAL_ORDER_LABELS: Record<IndividualOrder, { label: string; effect: string }> = {
  normal: { label: 'Normal Role Duty', effect: 'Balanced positioning & cooldown discipline' },
  offensive: { label: 'Offensive / Press', effect: '+12% forward trade aggression & dive priority' },
  defensive: { label: 'Defensive / Hold', effect: '+15% survival caution & turret perimeter safety' },
  objective_focus: { label: 'Objective Macro', effect: '+15% Dragon/Golem & structure siege rotation' },
  peel_carry: { label: 'Peel & Protect Carry', effect: 'Prioritizes shielding & body-blocking for Marksman/Mage' }
};

const ATTITUDE_OPTIONS: {
  id: MatchAttitude;
  title: string;
  short: string;
  desc: string;
  badgeColor: string;
}[] = [
  {
    id: 'pic',
    title: 'Play It Cool (PIC)',
    short: 'PIC',
    desc: 'Conserves player stamina (+15% energy saved) and builds team spirit for future international fixtures. (-8% match rating)',
    badgeColor: 'border-sky-500/40 bg-sky-500/10 text-sky-300'
  },
  {
    id: 'normal',
    title: 'Normal Attitude',
    short: 'NORMAL',
    desc: 'Standard competitive focus (100% tactical rating, normal stamina expenditure and morale balance).',
    badgeColor: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
  },
  {
    id: 'mots',
    title: 'Match of the Season (MOTS)',
    short: 'MOTS',
    desc: 'All-out effort (+12% teamfight & clutch rating) for critical playoffs or finals. High stamina drain after the series.',
    badgeColor: 'border-amber-500/40 bg-amber-500/10 text-amber-300'
  }
];

const DOCTRINE_OPTIONS: { id: TacticalDoctrine; title: string; desc: string }[] = [
  {
    id: 'balanced',
    title: 'Standard Balanced',
    desc: 'Adaptable front-to-back formation with balanced laning and objective setup.'
  },
  {
    id: 'teamfight_ball',
    title: '5v5 Teamfight Ball',
    desc: 'Group early around river objectives; prioritize wombo-combo engage (+10% Teamfight synergy).'
  },
  {
    id: 'objective_macro',
    title: 'Objective Macro & Siege',
    desc: 'Prioritize outer/inner turret plates, wave control, and clean baron/dragon setups (+10% IQ & Laning).'
  },
  {
    id: 'pick_burst',
    title: 'Pick & Burst Ambush',
    desc: 'Control vision pockets to isolate enemy carries before 5v5 fights start (+12% Assassin/Mage burst).'
  },
  {
    id: 'protect_carry',
    title: 'Protect the Marksman',
    desc: 'Funnel resources and peel cooldowns into your highest-rated DPS carry (+12% Marksman/Support link).'
  }
];

export const MatchOrdersModal: React.FC<MatchOrdersModalProps> = ({
  fixture,
  startingFive,
  bench,
  existingOrders,
  onSaveOrders,
  onSaveAndSimulateNow,
  onSwapStarter,
  onClose
}) => {
  const defaultRoleAssignments: Record<string, AvatarRole> = {};
  const defaultIndividualOrders: Record<string, IndividualOrder> = {};
  startingFive.forEach((p) => {
    defaultRoleAssignments[p.id] = existingOrders?.roleAssignments[p.id] || p.preferredRole || p.role || 'Fighter';
    defaultIndividualOrders[p.id] = existingOrders?.individualOrders[p.id] || 'normal';
  });

  const [roleAssignments, setRoleAssignments] = useState<Record<string, AvatarRole>>(defaultRoleAssignments);
  const [individualOrders, setIndividualOrders] = useState<Record<string, IndividualOrder>>(defaultIndividualOrders);
  const [attitude, setAttitude] = useState<MatchAttitude>(existingOrders?.attitude || 'normal');
  const [doctrine, setDoctrine] = useState<TacticalDoctrine>(existingOrders?.doctrine || 'balanced');
  const [game2IfTrailing, setGame2IfTrailing] = useState<'keep' | 'switch_aggressive' | 'switch_macro'>(
    existingOrders?.seriesPlan.game2IfTrailing || 'switch_macro'
  );
  const [game3DeciderAttitude, setGame3DeciderAttitude] = useState<MatchAttitude>(
    existingOrders?.seriesPlan.game3DeciderAttitude || 'mots'
  );
  const [autoSubStaminaThreshold, setAutoSubStaminaThreshold] = useState<number>(
    existingOrders?.seriesPlan.autoSubStaminaThreshold ?? 5
  );

  const buildOrdersPayload = (): MatchOrders => ({
    fixtureId: fixture.id,
    opponentName: fixture.opponentName,
    competitionName: fixture.competitionName,
    seriesFormat: fixture.seriesFormat,
    startingIds: startingFive.map((p) => p.id),
    roleAssignments,
    individualOrders,
    attitude,
    doctrine,
    seriesPlan: {
      game2IfTrailing,
      game3DeciderAttitude,
      autoSubStaminaThreshold
    },
    submittedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  });

  const handleSave = () => {
    sound.playClick();
    onSaveOrders(buildOrdersPayload());
    onClose();
  };

  const handleSaveAndPlay = () => {
    if (!onSaveAndSimulateNow) return;
    sound.playClick();
    const payload = buildOrdersPayload();
    onSaveOrders(payload);
    onSaveAndSimulateNow(payload);
  };

  // Compute tactical readiness preview
  const avgStarterScale10 = toScale10(
    Math.round(startingFive.reduce((sum, p) => sum + p.ovr, 0) / Math.max(1, startingFive.length))
  );
  const roleFitCount = startingFive.filter((p) => {
    const assigned = roleAssignments[p.id] || p.preferredRole || p.role;
    const nat = p.preferredRole || p.role;
    return assigned === nat || (p.playableRoles && p.playableRoles.includes(assigned));
  }).length;

  return (
    <div
      className="cm-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Match Orders for ${fixture.opponentName}`}
        className="cm-modal max-w-4xl w-full max-h-[92dvh] overflow-y-auto"
      >
        <div className="cm-panel-header">
          <span className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-emerald-400" />
            <span>
              Hattrick Match Orders Sheet · {fixture.competitionName} ({fixture.seriesFormat})
            </span>
          </span>
          <button type="button" onClick={onClose} className="cm-btn py-0.5 px-2.5 text-xs">
            ✕ Close
          </button>
        </div>

        <div className="cm-panel-body space-y-4">
          {/* Scheduled Match Banner */}
          <div className="bg-[#0f172a] border border-white/10 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                <span>📅 Scheduled Kickoff: {fixture.scheduledTimeLabel}</span>
                <span>·</span>
                <span className="text-amber-300">⏳ {fixture.countdownLabel}</span>
              </div>
              <div className="text-base font-black text-white mt-0.5">
                vs {fixture.opponentName}{' '}
                <span className="text-xs font-bold text-slate-400">
                  ({fixture.opponentRegion} · {fixture.opponentRating10}/10 {getHattrickDescriptor(fixture.opponentRating10)})
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {fixture.roundLabel} · Format: <strong className="text-white">{fixture.seriesFormat} Series</strong> · Prize Pool:{' '}
                <strong className="text-amber-300">{fixture.prizeCoins.toLocaleString()} Coins</strong>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="px-3 py-1.5 rounded-lg bg-[#1e293b] border border-white/10 text-right">
                <div className="text-[10px] uppercase font-bold text-slate-400">Lineup Role Fit</div>
                <div className="text-sm font-black text-emerald-400">
                  {roleFitCount}/5 Natural Roles · {avgStarterScale10}/10 Squad
                </div>
              </div>
            </div>
          </div>

          {/* 1. Starting 5 Role Positions & Individual Instructions */}
          <div className="bg-[#0f172a]/90 border border-white/10 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="text-xs font-extrabold uppercase tracking-wider text-white flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                <span>1. Starting Five · Role as Position &amp; Individual Match Orders</span>
              </div>
              <span className="text-[11px] text-slate-400">
                Assign each player’s Role Position (no Top/Jgl/Mid/Bot/Sup lanes)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="cm-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Starter (Swap if needed)</th>
                    <th>Natural Role</th>
                    <th>Rating (1–10)</th>
                    <th>Assigned Match Role Position</th>
                    <th>Individual Tactical Order</th>
                  </tr>
                </thead>
                <tbody>
                  {startingFive.map((player, idx) => {
                    const naturalRole = (player.preferredRole || player.role || 'Fighter') as AvatarRole;
                    const assignedRole = roleAssignments[player.id] || naturalRole;
                    const indOrder = individualOrders[player.id] || 'normal';
                    const isNatural =
                      assignedRole === naturalRole ||
                      (player.playableRoles && player.playableRoles.includes(assignedRole));
                    const scale10 = toScale10(player.ovr);

                    return (
                      <tr key={player.id}>
                        <td className="font-mono font-bold text-slate-400">#{idx + 1}</td>
                        <td>
                          <div className="flex flex-col gap-1">
                            <span className="font-bold text-white">{player.name}</span>
                            {onSwapStarter && bench.length > 0 && (
                              <select
                                aria-label={`Substitute starter ${player.name}`}
                                value=""
                                onChange={(e) => {
                                  if (e.target.value) {
                                    onSwapStarter(idx, e.target.value);
                                  }
                                }}
                                className="cm-select py-0.5 px-1.5 text-[10px]"
                              >
                                <option value="">⇄ Sub from reserves...</option>
                                {bench.slice(0, 12).map((b) => (
                                  <option key={b.id} value={b.id}>
                                    {b.name} ({b.preferredRole || b.role} · {toScale10(b.ovr)}/10)
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className="cm-badge cm-badge-green text-[10px]">{naturalRole}</span>
                        </td>
                        <td className="font-mono font-bold text-emerald-400">
                          {scale10}/10 <span className="text-[10px] text-slate-400">({getHattrickDescriptor(scale10)})</span>
                        </td>
                        <td>
                          <div className="flex items-center gap-1.5">
                            <select
                              aria-label={`Role position for ${player.name}`}
                              value={assignedRole}
                              onChange={(e) =>
                                setRoleAssignments((prev) => ({
                                  ...prev,
                                  [player.id]: e.target.value as AvatarRole
                                }))
                              }
                              className="cm-select py-1 px-2 text-xs font-bold"
                            >
                              {ALL_ROLES.map((r) => (
                                <option key={r} value={r}>
                                  {r} Position
                                </option>
                              ))}
                            </select>
                            {!isNatural && (
                              <span
                                className="text-[10px] font-bold text-amber-400"
                                title="Off-role assignment (-10% tactical efficiency)"
                              >
                                ⚠️ Off-Role
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <select
                            aria-label={`Individual order for ${player.name}`}
                            value={indOrder}
                            onChange={(e) =>
                              setIndividualOrders((prev) => ({
                                ...prev,
                                [player.id]: e.target.value as IndividualOrder
                              }))
                            }
                            className="cm-select py-1 px-2 text-xs"
                          >
                            {(Object.keys(INDIVIDUAL_ORDER_LABELS) as IndividualOrder[]).map((ord) => (
                              <option key={ord} value={ord}>
                                {INDIVIDUAL_ORDER_LABELS[ord].label}
                              </option>
                            ))}
                          </select>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {INDIVIDUAL_ORDER_LABELS[indOrder].effect}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. Team Attitude & 3. Tactical Doctrine */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
            {/* Team Attitude */}
            <div className="bg-[#0f172a]/90 border border-white/10 rounded-xl p-3.5 space-y-2.5">
              <div className="text-xs font-extrabold uppercase tracking-wider text-white flex items-center gap-1.5 border-b border-white/10 pb-2">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>2. Team Attitude (Hattrick Effort Level)</span>
              </div>
              <div className="space-y-2">
                {ATTITUDE_OPTIONS.map((opt) => {
                  const active = attitude === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        setAttitude(opt.id);
                      }}
                      className={`w-full text-left p-2.5 rounded-lg border transition flex items-start justify-between gap-2 ${
                        active
                          ? 'bg-emerald-500/15 border-emerald-400 text-white'
                          : 'bg-[#1e293b]/60 border-white/10 text-slate-300 hover:border-white/25'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-black flex items-center gap-2">
                          <span>{opt.title}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${opt.badgeColor}`}>
                            {opt.short}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{opt.desc}</div>
                      </div>
                      <span className="text-xs font-bold text-emerald-400">{active ? '✓ Selected' : ''}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tactical Doctrine */}
            <div className="bg-[#0f172a]/90 border border-white/10 rounded-xl p-3.5 space-y-2.5">
              <div className="text-xs font-extrabold uppercase tracking-wider text-white flex items-center gap-1.5 border-b border-white/10 pb-2">
                <Swords className="w-3.5 h-3.5 text-sky-400" />
                <span>3. Team Tactical Doctrine</span>
              </div>
              <div className="space-y-1.5">
                {DOCTRINE_OPTIONS.map((doc) => {
                  const active = doctrine === doc.id;
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        setDoctrine(doc.id);
                      }}
                      className={`w-full text-left p-2 rounded-lg border transition flex items-center justify-between gap-2 ${
                        active
                          ? 'bg-sky-500/15 border-sky-400 text-white'
                          : 'bg-[#1e293b]/60 border-white/10 text-slate-300 hover:border-white/25'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold">{doc.title}</div>
                        <div className="text-[11px] text-slate-400">{doc.desc}</div>
                      </div>
                      <span className="text-xs font-bold text-sky-400">{active ? '✓' : ''}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 4. Conditional Series Orders (Bo3 / Bo5 Adaptations) */}
          <div className="bg-[#0f172a]/90 border border-white/10 rounded-xl p-3.5 space-y-2.5">
            <div className="text-xs font-extrabold uppercase tracking-wider text-white flex items-center gap-1.5 border-b border-white/10 pb-2">
              <Shield className="w-3.5 h-3.5 text-purple-400" />
              <span>4. Conditional Series Orders ({fixture.seriesFormat} Between-Game Adjustments)</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  If Trailing Series 0–1 Entering Game 2:
                </label>
                <select
                  value={game2IfTrailing}
                  onChange={(e) =>
                    setGame2IfTrailing(e.target.value as 'keep' | 'switch_aggressive' | 'switch_macro')
                  }
                  className="cm-select w-full py-1.5 px-2 text-xs"
                >
                  <option value="keep">Keep Game 1 Doctrine</option>
                  <option value="switch_aggressive">Switch to Pick &amp; Burst Ambush (+Aggression)</option>
                  <option value="switch_macro">Switch to Objective Macro &amp; Siege (+Control)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Decider Game (Final Game of Series) Attitude:
                </label>
                <select
                  value={game3DeciderAttitude}
                  onChange={(e) => setGame3DeciderAttitude(e.target.value as MatchAttitude)}
                  className="cm-select w-full py-1.5 px-2 text-xs"
                >
                  <option value="normal">Maintain Normal Attitude</option>
                  <option value="mots">Escalate to Match of the Season (MOTS)</option>
                  <option value="pic">Play It Cool (PIC)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Auto-Substitute Reserve if Starter Stamina Drops Below:
                </label>
                <select
                  value={autoSubStaminaThreshold}
                  onChange={(e) => setAutoSubStaminaThreshold(Number(e.target.value))}
                  className="cm-select w-full py-1.5 px-2 text-xs"
                >
                  <option value={4}>4/10 (weak stamina)</option>
                  <option value={5}>5/10 (inadequate stamina)</option>
                  <option value={6}>6/10 (passable stamina)</option>
                  <option value={0}>Never Auto-Sub</option>
                </select>
              </div>
            </div>
          </div>

          {/* Modal Action Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10">
            <div className="text-xs text-slate-400">
              {existingOrders ? (
                <span className="text-emerald-400 font-bold">
                  ✓ Match Orders previously saved at {existingOrders.submittedAt}
                </span>
              ) : (
                <span>Submit your Match Orders before the scheduled kickoff time.</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={onClose} className="cm-btn py-1.5 px-3 text-xs">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="cm-btn cm-btn-primary py-1.5 px-4 text-xs font-black flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Save &amp; Submit Match Orders ✓</span>
              </button>
              {onSaveAndSimulateNow && (
                <button
                  type="button"
                  onClick={handleSaveAndPlay}
                  className="cm-btn cm-btn-gold py-1.5 px-4 text-xs font-black flex items-center gap-1.5"
                  title="Save these Match Orders and advance to the scheduled kickoff immediately"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Save Orders &amp; Kickoff Scheduled Match ▸</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
