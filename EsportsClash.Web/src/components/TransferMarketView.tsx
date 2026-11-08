// src/components/TransferMarketView.tsx
// Chess.com × Hattrick Transfer Market & Scouting System
// Live Bidding Auctions, Scouting Network (1-10 Scout Attributes), My Bids & Listed Players, Club Treasury & Fair-Play Grants

import React, { useState } from 'react';
import type {
  AvatarRole,
  MarketListing,
  PlayerCard,
  ScoutCard,
  ScoutReportDossier,
  SeriesDivisionTier
} from '../types';
import { PlayerProfileCard } from './PlayerProfileCard';
import { ChibiAvatar } from './ChibiAvatar';
import { sound } from '../audio';
import {
  toScale10,
  getHattrickDescriptor,
  canBecomeCoach,
  mapToMacroRegion,
  DEFAULT_SCOUTS,
  generateMarketBatch,
  evaluateProspectWithScout,
  placeBid,
  instantBuyout,
  simulateAIBiddingStep
} from '../marketBatchEngine';
import {
  Gavel,
  Search,
  Users,
  Compass,
  Coins,
  CheckCircle2,
  AlertTriangle,
  GraduationCap,
  Sparkles,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';

interface TransferMarketViewProps {
  teamFunds: number;
  onUpdateFunds: (newFunds: number) => void;
  roster: PlayerCard[];
  onSignPlayer: (player: PlayerCard) => void;
  divisionTier?: SeriesDivisionTier;
  currentRound?: number;
}

export const TransferMarketView: React.FC<TransferMarketViewProps> = ({
  teamFunds,
  onUpdateFunds,
  roster,
  onSignPlayer,
  divisionTier = 'Series IV',
  currentRound = 1
}) => {
  const [activeMarketTab, setActiveMarketTab] = useState<'auctions' | 'my_bids' | 'scouts' | 'treasury'>('auctions');

  // Market Listings State initialized from deterministic batch
  const [listings, setListings] = useState<MarketListing[]>(() => {
    const { publicListings } = generateMarketBatch(101, 24);
    return publicListings;
  });

  // Committed Escrow State (Coins locked in active winning bids)
  const [committedEscrow, setCommittedEscrow] = useState<number>(0);

  // Player Listed for Sale
  const [myListedPlayers, setMyListedPlayers] = useState<MarketListing[]>([]);

  // Scouts & Scout Dossiers State
  const [scouts, setScouts] = useState<ScoutCard[]>(DEFAULT_SCOUTS);
  const [scoutDossiers, setScoutDossiers] = useState<ScoutReportDossier[]>(() => {
    const { regionalYouthPool } = generateMarketBatch(101, 24);
    const initialDossiers: ScoutReportDossier[] = [];
    DEFAULT_SCOUTS.forEach((scout) => {
      const candidates = regionalYouthPool[scout.specialtyRegion] || [];
      if (candidates.length > 0) {
        initialDossiers.push(evaluateProspectWithScout(candidates[0], scout, currentRound));
      }
    });
    return initialDossiers;
  });

  // Filter States for Live Auctions
  const [filterRole, setFilterRole] = useState<AvatarRole | 'all'>('all');
  const [filterAge, setFilterAge] = useState<'all' | 'youth' | 'prime' | 'vet'>('all');
  const [filterMinRating, setFilterMinRating] = useState<number>(1);
  const [filterCoachOnly, setFilterCoachOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Active Bidding Modal
  const [biddingTarget, setBiddingTarget] = useState<MarketListing | null>(null);
  const [bidAmountInput, setBidAmountInput] = useState<number>(0);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Split-Capped Capital Grants (max 2 per split)
  const [grantsRemaining, setGrantsRemaining] = useState<number>(2);

  // Division Financial Fair Play (FFP) Cap
  const divisionPrestigeCaps: Record<SeriesDivisionTier, number> = {
    'Series IV': 8,
    'Series III': 9,
    'Series II': 10,
    'Series I': 10
  };
  const currentPrestigeCap = divisionPrestigeCaps[divisionTier] || 8;

  // Filtered Listings
  const filteredListings = listings.filter((l) => {
    const p = l.player;
    const role = p.preferredRole || p.role;
    if (filterRole !== 'all' && role !== filterRole) return false;

    const age = p.age ?? 21;
    if (filterAge === 'youth' && (age < 16 || age > 18)) return false;
    if (filterAge === 'prime' && (age < 19 || age > 22)) return false;
    if (filterAge === 'vet' && age < 23) return false;

    const ovr10 = toScale10(p.ovr);
    if (ovr10 < filterMinRating) return false;

    if (filterCoachOnly && !canBecomeCoach(p).eligible) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !l.sellerClubName.toLowerCase().includes(q)) {
        return false;
      }
    }

    return true;
  });

  // Handle Opening Bid Dialog
  const handleOpenBidModal = (listing: MarketListing) => {
    sound.playClick();
    const minBid = listing.currentBid ? Math.round(listing.currentBid * 1.05) : listing.askingPrice;
    setBiddingTarget(listing);
    setBidAmountInput(minBid);
  };

  // Submit Bid
  const handleSubmitBid = () => {
    if (!biddingTarget) return;

    const ovr10 = toScale10(biddingTarget.player.ovr);
    if (ovr10 > currentPrestigeCap) {
      alert(
        `Financial Fair Play Restriction: ${divisionTier} has a maximum signing prestige cap of ${currentPrestigeCap}/10. To field ${ovr10}/10 superstars, scout and develop high-potential youth prospects in your training center!`
      );
      return;
    }

    const result = placeBid(biddingTarget, bidAmountInput, teamFunds, 'my_club', 'Your Club');

    if ('error' in result) {
      alert(result.error);
      return;
    }

    sound.playCoin();
    setListings((current) =>
      current.map((item) => (item.id === biddingTarget.id ? result.updatedListing : item))
    );
    onUpdateFunds(teamFunds - result.escrowChange);
    setCommittedEscrow((prev) => prev + result.escrowChange);
    setBiddingTarget(null);
    setActionNotice(
      `Bid placed: 🪙 ${bidAmountInput.toLocaleString()} Coins on ${biddingTarget.player.name} (Held in Escrow).`
    );
    setTimeout(() => setActionNotice(null), 4500);
  };

  // Instant Buyout
  const handleExecuteBuyout = (listing: MarketListing) => {
    sound.playClick();
    const ovr10 = toScale10(listing.player.ovr);
    if (ovr10 > currentPrestigeCap) {
      alert(
        `Financial Fair Play Restriction: ${divisionTier} has a maximum signing prestige cap of ${currentPrestigeCap}/10. High-tier players must be scouted and trained!`
      );
      return;
    }

    if (teamFunds < listing.buyoutPrice) {
      alert(`Insufficient funds for buyout clause of 🪙 ${listing.buyoutPrice.toLocaleString()} Coins.`);
      return;
    }

    if (window.confirm(`Execute release clause buyout of 🪙 ${listing.buyoutPrice.toLocaleString()} Coins for ${listing.player.name}?`)) {
      const res = instantBuyout(listing, teamFunds);
      if ('error' in res) {
        alert(res.error);
        return;
      }

      sound.playWalkoutFanfare();
      onUpdateFunds(teamFunds - res.cost);
      onSignPlayer(listing.player);
      setListings((current) => current.filter((l) => l.id !== listing.id));
      setActionNotice(`🎉 CONTRACT SIGNED: ${listing.player.name} joined your Club Reserves!`);
      setTimeout(() => setActionNotice(null), 4500);
    }
  };

  // Sign Scouted Prospect
  const handleSignScoutedProspect = (dossier: ScoutReportDossier) => {
    sound.playClick();
    if (teamFunds < dossier.signingFee) {
      alert(`Insufficient funds for signing fee of 🪙 ${dossier.signingFee.toLocaleString()} Coins.`);
      return;
    }

    if (window.confirm(`Sign youth prospect ${dossier.prospect.name} for 🪙 ${dossier.signingFee.toLocaleString()} Coins?`)) {
      sound.playWalkoutFanfare();
      onUpdateFunds(teamFunds - dossier.signingFee);
      onSignPlayer({
        ...dossier.prospect,
        wage: dossier.weeklyWage
      });
      setScoutDossiers((current) => current.filter((d) => d.id !== dossier.id));
      setActionNotice(`🌟 YOUTH SIGNED: ${dossier.prospect.name} joined your Club Reserves!`);
      setTimeout(() => setActionNotice(null), 4500);
    }
  };

  // Run New Intake Batch
  const handleGenerateFreshBatch = () => {
    sound.playClick();
    const seed = Date.now() % 100000;
    const { publicListings, regionalYouthPool } = generateMarketBatch(seed, 24);
    setListings(publicListings);

    const freshDossiers: ScoutReportDossier[] = [];
    scouts.forEach((scout) => {
      const candidates = regionalYouthPool[scout.specialtyRegion] || [];
      if (candidates.length > 0) {
        freshDossiers.push(evaluateProspectWithScout(candidates[0], scout, currentRound));
      }
    });
    setScoutDossiers(freshDossiers);
    setActionNotice('🔄 New batch intake dispatched: Fresh market auction list and regional scout reports generated!');
    setTimeout(() => setActionNotice(null), 4500);
  };

  // Claim Capital Grant (Anti-Pay-to-Win Capped Option)
  const handleClaimCapitalGrant = (tier: 1 | 2) => {
    if (grantsRemaining <= 0) {
      alert('Split Grant Limit Reached: Financial Fair Play caps grants at 2 per 14-round Season Split.');
      return;
    }
    sound.playCoin();
    const amount = tier === 1 ? 2500 : 5000;
    onUpdateFunds(teamFunds + amount);
    setGrantsRemaining((r) => r - 1);
    setActionNotice(`🏛️ Board Capital Injection Approved: +🪙 ${amount.toLocaleString()} Coins transferred to treasury.`);
    setTimeout(() => setActionNotice(null), 4500);
  };

  // Simulate rival bids
  const handleSimulateRivalActivity = () => {
    sound.playClick();
    const { updatedListings, outbidListingIds } = simulateAIBiddingStep(listings, 'my_club');
    setListings(updatedListings);
    if (outbidListingIds.length > 0) {
      sound.playClick();
      setActionNotice(`⚠️ OUTBID ALERT: You were outbid on ${outbidListingIds.length} target(s). Funds refunded to cash!`);
      setTimeout(() => setActionNotice(null), 5000);
    } else {
      setActionNotice('Simulated rival club bids: Market prices active.');
      setTimeout(() => setActionNotice(null), 3000);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & Treasury Status */}
      <div className="cm-panel">
        <div className="cm-panel-header">
          <span className="flex items-center gap-2">
            <Gavel className="w-4 h-4 text-[#81b64c]" />
            <span>Transfer Market &amp; Scouting Network · Real-World Contract Auctions</span>
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <span className="cm-badge cm-badge-gold font-mono font-bold">
              🪙 {teamFunds.toLocaleString()} Available
            </span>
            {committedEscrow > 0 && (
              <span className="cm-badge cm-badge-blue font-mono font-bold">
                🔒 🪙 {committedEscrow.toLocaleString()} in Escrow
              </span>
            )}
            <span className="cm-badge cm-badge-navy">
              FFP Cap: Max {currentPrestigeCap}/10 ({divisionTier})
            </span>
          </div>
        </div>

        <div className="cm-panel-body flex flex-wrap justify-between items-center gap-4">
          <div>
            <h2 className="text-base font-black text-[#1b2018]">
              Open Player Market &amp; Talent Scouting (Zero Gacha · 1–10 Scale)
            </h2>
            <p className="text-xs text-[#4e5746] mt-0.5">
              Live auctions with escrow bidding, scout reports with uncertainty fog-of-war, and coaching talent evaluation.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSimulateRivalActivity}
              className="cm-btn text-xs py-1.5 px-3"
              title="Simulate rival AI bids across active market listings"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Simulate Rival Bids</span>
            </button>

            <button
              type="button"
              onClick={handleGenerateFreshBatch}
              className="cm-btn cm-btn-primary text-xs py-1.5 px-3"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Run New Intake Batch ▸</span>
            </button>
          </div>
        </div>
      </div>

      {actionNotice && (
        <div className="bg-[#dcfce7] border border-[#16a34a] p-3 text-xs font-bold text-[#15803d] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Sub-Tabs Navigation */}
      <div className="cm-tabs mb-0 border-b-0">
        <button
          type="button"
          onClick={() => {
            sound.playClick();
            setActiveMarketTab('auctions');
          }}
          className={`cm-tab ${activeMarketTab === 'auctions' ? 'active' : ''}`}
        >
          <Gavel className="w-3.5 h-3.5 inline mr-1.5" />
          Live Auctions ({filteredListings.length})
        </button>

        <button
          type="button"
          onClick={() => {
            sound.playClick();
            setActiveMarketTab('my_bids');
          }}
          className={`cm-tab ${activeMarketTab === 'my_bids' ? 'active' : ''}`}
        >
          <TrendingUp className="w-3.5 h-3.5 inline mr-1.5" />
          My Bids &amp; Listed Players
        </button>

        <button
          type="button"
          onClick={() => {
            sound.playClick();
            setActiveMarketTab('scouts');
          }}
          className={`cm-tab ${activeMarketTab === 'scouts' ? 'active' : ''}`}
        >
          <Compass className="w-3.5 h-3.5 inline mr-1.5" />
          Scouting Network ({scoutDossiers.length} Reports)
        </button>

        <button
          type="button"
          onClick={() => {
            sound.playClick();
            setActiveMarketTab('treasury');
          }}
          className={`cm-tab ${activeMarketTab === 'treasury' ? 'active' : ''}`}
        >
          <Coins className="w-3.5 h-3.5 inline mr-1.5" />
          Club Treasury &amp; FFP Grants
        </button>
      </div>

      {/* =========================================================
          TAB 1: LIVE AUCTIONS
         ========================================================= */}
      {activeMarketTab === 'auctions' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="cm-panel">
            <div className="cm-panel-body py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1 font-bold text-[#4e5746]">
                  Role:
                  <select
                    className="cm-select py-1 px-2 text-xs"
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value as AvatarRole | 'all')}
                  >
                    <option value="all">All Roles</option>
                    <option value="Tank">Tank</option>
                    <option value="Fighter">Fighter</option>
                    <option value="Assassin">Assassin</option>
                    <option value="Mage">Mage</option>
                    <option value="Marksman">Marksman</option>
                    <option value="Support">Support</option>
                  </select>
                </label>

                <label className="flex items-center gap-1 font-bold text-[#4e5746]">
                  Age:
                  <select
                    className="cm-select py-1 px-2 text-xs"
                    value={filterAge}
                    onChange={(e) => setFilterAge(e.target.value as any)}
                  >
                    <option value="all">All Ages</option>
                    <option value="youth">Youth (16–18 yo)</option>
                    <option value="prime">Prime (19–22 yo)</option>
                    <option value="vet">Veteran (23+ yo)</option>
                  </select>
                </label>

                <label className="flex items-center gap-1 font-bold text-[#4e5746]">
                  Min Rating:
                  <select
                    className="cm-select py-1 px-2 text-xs font-mono font-bold"
                    value={filterMinRating}
                    onChange={(e) => setFilterMinRating(Number(e.target.value))}
                  >
                    <option value={1}>1 / 10</option>
                    <option value={5}>5 / 10 (Passable+)</option>
                    <option value={7}>7 / 10 (Excellent+)</option>
                    <option value={8}>8 / 10 (Formidable+)</option>
                    <option value={9}>9 / 10 (World Class)</option>
                  </select>
                </label>

                <label className="flex items-center gap-1.5 p-1 px-2 bg-[#f0f4ea] border border-[#8a967f] cursor-pointer rounded">
                  <input
                    type="checkbox"
                    checked={filterCoachOnly}
                    onChange={(e) => setFilterCoachOnly(e.target.checked)}
                    className="w-3.5 h-3.5"
                  />
                  <span className="font-bold text-[#1b2018] flex items-center gap-1">
                    <GraduationCap className="w-3.5 h-3.5 text-[#15803d]" /> Coach Eligible Only (IQ≥7 &amp; LDR≥6)
                  </span>
                </label>
              </div>

              <div className="relative w-56">
                <Search className="w-3.5 h-3.5 text-[#4e5746] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search player or selling club..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="cm-input w-full pl-8 py-1 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Hattrick Player Profile Auction Listings */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {filteredListings.map((listing, idx) => {
              const p = listing.player;
              const ovr10 = toScale10(p.ovr);
              const isOverCap = ovr10 > currentPrestigeCap;
              const isWinning = listing.highestBidderId === 'my_club';
              const coachCheck = canBecomeCoach(p);

              return (
                <div key={listing.id} className="flex flex-col">
                  <PlayerProfileCard
                    card={p}
                    shirtNumber={idx + 1}
                    actionSlot={
                      <div className="space-y-2 w-full">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="text-[#374151]">
                            Selling Club: <strong className="text-[#111827]">{listing.sellerClubName}</strong>
                          </span>
                          {coachCheck.eligible && (
                            <span className="px-2 py-0.5 rounded bg-[#dcfce7] border border-[#16a34a] text-[#15803d] font-bold flex items-center gap-1 text-[11px]">
                              <GraduationCap className="w-3.5 h-3.5" />
                              <span>Future Coach (IQ {toScale10(p.stats.iq)}/10 · LDR {toScale10(p.stats.ldr ?? 55)}/10)</span>
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-2 bg-[#f8faf7] border border-[#d1d5db] rounded p-2 text-xs">
                          <div>
                            <div className="text-[10px] text-[#6b7280] uppercase font-bold">Asking Price</div>
                            <div className="font-mono font-bold text-[#111827]">🪙 {listing.askingPrice.toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-[#6b7280] uppercase font-bold">Current Bid</div>
                            <div className="font-mono font-bold text-[#15803d]">
                              {listing.currentBid ? `🪙 ${listing.currentBid.toLocaleString()}` : 'No bids yet'}
                            </div>
                            {listing.highestBidderName && (
                              <div className="text-[10px] text-[#4b5563] truncate">
                                Leader: <strong>{listing.highestBidderName}</strong>
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="text-[10px] text-[#6b7280] uppercase font-bold">Release Clause</div>
                            <div className="font-mono font-bold text-[#b45309]">🪙 {listing.buyoutPrice.toLocaleString()}</div>
                          </div>
                        </div>

                        {isOverCap && (
                          <div className="bg-[#fee2e2] border border-[#b91c1c] p-1.5 rounded text-[11px] text-[#b91c1c] font-bold flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>FFP Cap: Exceeds {divisionTier} direct signing cap ({currentPrestigeCap}/10).</span>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            disabled={isOverCap || isWinning}
                            onClick={() => handleOpenBidModal(listing)}
                            className={`cm-btn py-1.5 text-xs ${isWinning ? 'bg-[#dcfce7] border-[#16a34a] text-[#15803d]' : 'cm-btn-primary'}`}
                          >
                            <Gavel className="w-3.5 h-3.5" />
                            <span>{isWinning ? 'Winning Bid ✓' : 'Place Bid ▸'}</span>
                          </button>

                          <button
                            type="button"
                            disabled={isOverCap}
                            onClick={() => handleExecuteBuyout(listing)}
                            className="cm-btn text-xs py-1.5"
                            title="Bypass auction and instantly sign player"
                          >
                            <span>Buyout (🪙 {listing.buyoutPrice.toLocaleString()})</span>
                          </button>
                        </div>
                      </div>
                    }
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================
          TAB 2: MY BIDS & LISTED PLAYERS
         ========================================================= */}
      {activeMarketTab === 'my_bids' && (
        <div className="space-y-4">
          <div className="cm-panel">
            <div className="cm-panel-header">
              <span>Active Club Bids &amp; Escrow Tracking</span>
              <span className="cm-badge cm-badge-gold">🪙 {committedEscrow.toLocaleString()} in Escrow</span>
            </div>
            <div className="cm-panel-body space-y-3">
              {listings.filter((l) => l.highestBidderId === 'my_club').length === 0 ? (
                <p className="text-xs text-[#4e5746] py-4 text-center">
                  You currently hold no active bids. Explore <strong>Live Auctions</strong> to bid on targets!
                </p>
              ) : (
                <div className="cm-table-wrap">
                  <table className="cm-table">
                    <thead>
                      <tr>
                        <th>Player</th>
                        <th>Role</th>
                        <th>Rating</th>
                        <th>Seller</th>
                        <th>Your Highest Bid</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listings
                        .filter((l) => l.highestBidderId === 'my_club')
                        .map((l) => (
                          <tr key={l.id}>
                            <td className="font-bold text-[#1b2018]">{l.player.name}</td>
                            <td>{l.player.preferredRole || l.player.role}</td>
                            <td className="font-mono font-bold">{toScale10(l.player.ovr)}/10</td>
                            <td>{l.sellerClubName}</td>
                            <td className="font-mono font-bold text-[#15803d]">🪙 {l.currentBid?.toLocaleString()}</td>
                            <td>
                              <span className="cm-badge cm-badge-green">Winning</span>
                            </td>
                            <td>
                              <button
                                type="button"
                                onClick={() => handleExecuteBuyout(l)}
                                className="cm-btn text-xs py-0.5 px-2"
                              >
                                Instant Buyout
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          TAB 3: SCOUTING NETWORK & YOUTH INTAKE
         ========================================================= */}
      {activeMarketTab === 'scouts' && (
        <div className="space-y-4">
          {/* Scout Staff Cards */}
          <div className="cm-panel">
            <div className="cm-panel-header">
              <span>Club Scouting Staff &amp; Regional Assignments (1–10 Attributes)</span>
              <span className="text-[11px] font-normal text-white/80">{scouts.length} Active Scouts</span>
            </div>
            <div className="cm-panel-body grid grid-cols-1 md:grid-cols-3 gap-3">
              {scouts.map((scout) => (
                <div key={scout.id} className="bg-white border border-[#bcc4b3] p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ChibiAvatar avatarType={scout.avatarSvg || scout.name} size={36} />
                      <strong className="text-sm text-[#1b2018]">{scout.name}</strong>
                    </div>
                    <span className="cm-badge cm-badge-navy">{mapToMacroRegion(scout.specialtyRegion)} Specialist</span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 text-[11px] py-1 border-y border-[#e4e7df]">
                    <div>Ability Judgment: <strong className="font-mono text-[#15803d]">{scout.judgingAbility}/10</strong></div>
                    <div>Potential Eye: <strong className="font-mono text-[#ca8a04]">{scout.judgingPotential}/10</strong></div>
                    <div>Regional Know: <strong className="font-mono">{scout.regionalKnowledge}/10</strong></div>
                    <div>Negotiation: <strong className="font-mono">{scout.negotiation}/10</strong></div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[#4e5746]">Salary: 🪙 {scout.weeklySalary}/wk</span>
                    <span className="cm-badge cm-badge-green">Mission Active</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Scout Dossiers Reports */}
          <div className="cm-panel">
            <div className="cm-panel-header">
              <span>Regional Youth Scouting Dossiers (ASIA · EUROPE · AFRICA · AMERICAS)</span>
              <span className="cm-badge cm-badge-gold">{scoutDossiers.length} Candidates Available</span>
            </div>
            <div className="cm-panel-body space-y-3">
              <p className="text-xs text-[#4e5746]">
                Scouts evaluate promising youth prodigies in their target regions. Stats are revealed as estimated ranges based on your scout's <strong>Judging Ability</strong>.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {scoutDossiers.map((dossier) => (
                  <div key={dossier.id} className="bg-white border border-[#bcc4b3] p-3 space-y-2 text-xs flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-1 gap-2">
                        <div className="flex items-center gap-2">
                          <ChibiAvatar avatarType={dossier.prospect.avatarSvg || dossier.prospect.name} size={36} />
                          <div>
                            <strong className="text-sm text-[#1b2018] block">{dossier.prospect.name}</strong>
                            <span className="text-[10px] text-[#4e5746]">
                              {dossier.prospect.age ?? 17}yo · {dossier.prospect.preferredRole || dossier.prospect.role}
                            </span>
                          </div>
                        </div>
                        <span className="cm-badge cm-badge-blue">{mapToMacroRegion(dossier.region)}</span>
                      </div>
                      <div className="text-[11px] text-[#4e5746]">
                        Scout: <strong>{dossier.scoutName}</strong>
                      </div>

                      <div className="bg-[#f8f9f5] border border-[#bcc4b3] p-2 my-2 space-y-1">
                        <div className="flex justify-between">
                          <span className="text-[#4e5746]">Est. Ability:</span>
                          <strong className="font-mono text-[#15803d]">
                            {dossier.estimatedOvrRange[0]}–{dossier.estimatedOvrRange[1]} / 10
                          </strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#4e5746]">Potential Ceiling:</span>
                          <strong className="font-mono text-[#ca8a04]">
                            {dossier.revealedPotentialRange[0]}–{dossier.revealedPotentialRange[1]} / 10
                          </strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#4e5746]">Signing Fee:</span>
                          <strong className="font-mono">🪙 {dossier.signingFee.toLocaleString()}</strong>
                        </div>
                      </div>

                      <p className="text-[11px] text-[#4e5746] italic">"{dossier.scoutNotes}"</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSignScoutedProspect(dossier)}
                      className="cm-btn cm-btn-primary w-full py-1.5 text-xs mt-2"
                    >
                      <span>Sign to Squad (🪙 {dossier.signingFee.toLocaleString()})</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          TAB 4: CLUB TREASURY & FFP GRANTS
         ========================================================= */}
      {activeMarketTab === 'treasury' && (
        <div className="space-y-4 max-w-4xl">
          <div className="cm-panel">
            <div className="cm-panel-header">
              <span>Club Treasury &amp; Weekly Matchday Budget</span>
              <span className="cm-badge cm-badge-gold">🪙 {teamFunds.toLocaleString()} Current Balance</span>
            </div>
            <div className="cm-panel-body space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white border border-[#bcc4b3] p-3 text-center">
                  <div className="text-[#4e5746] uppercase font-bold text-[10px]">Weekly Sponsor Revenue</div>
                  <div className="text-lg font-black font-mono text-[#15803d] mt-1">+🪙 1,250</div>
                </div>

                <div className="bg-white border border-[#bcc4b3] p-3 text-center">
                  <div className="text-[#4e5746] uppercase font-bold text-[10px]">Weekly Player Wage Bill</div>
                  <div className="text-lg font-black font-mono text-[#b91c1c] mt-1">
                    -🪙 {roster.reduce((acc, p) => acc + (p.wage ?? 35), 0).toLocaleString()}
                  </div>
                </div>

                <div className="bg-white border border-[#bcc4b3] p-3 text-center">
                  <div className="text-[#4e5746] uppercase font-bold text-[10px]">Net Matchday Cashflow</div>
                  <div className="text-lg font-black font-mono text-[#1b2018] mt-1">
                    +🪙 {Math.max(0, 1250 - roster.reduce((acc, p) => acc + (p.wage ?? 35), 0)).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Financial Fair Play Rules Panel */}
              <div className="bg-white border border-[#bcc4b3] p-3.5 space-y-2">
                <h3 className="font-bold text-[#1b2018] flex items-center gap-1.5 text-sm">
                  <ShieldCheck className="w-4 h-4 text-[#15803d]" />
                  <span>Financial Fair Play &amp; Anti-Pay-to-Win Safeguards</span>
                </h3>
                <p className="text-[#4e5746] leading-relaxed">
                  To keep club competition authentic, managers cannot buy instant super-teams. Your current division (
                  <strong>{divisionTier}</strong>) enforces a signing ceiling of <strong>{currentPrestigeCap}/10</strong>.
                  To field Divine (10/10) superstars, clubs must <strong>invest in training</strong> and{' '}
                  <strong>develop youth prospects</strong> through matchday regimens!
                </p>
              </div>

              {/* Split-Capped Board Capital Grants */}
              <div className="bg-white border border-[#bcc4b3] p-3.5 space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-[#1b2018] text-sm">Board Capital Grants (Capped at 2 per Season Split)</h3>
                  <span className="cm-badge cm-badge-gold">{grantsRemaining}/2 Grants Available</span>
                </div>
                <p className="text-[#4e5746]">
                  Optional board capital injections provide treasury funding for facility upgrades and bidding wars without enabling infinite whale spending.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="p-3 border border-[#bcc4b3] bg-[#f8f9f5] flex justify-between items-center">
                    <div>
                      <strong className="block text-[#1b2018]">Board Grant · Tier 1</strong>
                      <span className="text-[#15803d] font-mono font-bold">+🪙 2,500 Club Coins</span>
                    </div>
                    <button
                      type="button"
                      disabled={grantsRemaining <= 0}
                      onClick={() => handleClaimCapitalGrant(1)}
                      className="cm-btn cm-btn-primary py-1.5 px-3 text-xs"
                    >
                      Claim Grant
                    </button>
                  </div>

                  <div className="p-3 border border-[#bcc4b3] bg-[#f8f9f5] flex justify-between items-center">
                    <div>
                      <strong className="block text-[#1b2018]">Board Grant · Tier 2</strong>
                      <span className="text-[#15803d] font-mono font-bold">+🪙 5,000 Club Coins</span>
                    </div>
                    <button
                      type="button"
                      disabled={grantsRemaining <= 0}
                      onClick={() => handleClaimCapitalGrant(2)}
                      className="cm-btn cm-btn-primary py-1.5 px-3 text-xs"
                    >
                      Claim Grant
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BIDDING POPUP MODAL */}
      {biddingTarget && (
        <div className="cm-modal-backdrop">
          <div className="cm-modal max-w-md w-full">
            <div className="cm-panel-header">
              <span>Place Live Auction Bid</span>
              <button
                type="button"
                onClick={() => setBiddingTarget(null)}
                className="text-white hover:text-[#ca8a04]"
              >
                ✕
              </button>
            </div>
            <div className="cm-panel-body space-y-4 text-xs">
              <div>
                <h3 className="text-base font-black text-[#1b2018]">{biddingTarget.player.name}</h3>
                <p className="text-[#4e5746]">
                  {biddingTarget.player.preferredRole || biddingTarget.player.role} · {toScale10(biddingTarget.player.ovr)}/10 OVR · Selling Club:{' '}
                  <strong>{biddingTarget.sellerClubName}</strong>
                </p>
              </div>

              <div className="bg-white border border-[#bcc4b3] p-3 space-y-2">
                <div className="flex justify-between">
                  <span className="text-[#4e5746]">Current Highest Bid:</span>
                  <strong className="font-mono text-[#15803d]">
                    {biddingTarget.currentBid ? `🪙 ${biddingTarget.currentBid.toLocaleString()}` : `🪙 ${biddingTarget.askingPrice.toLocaleString()} (Asking)`}
                  </strong>
                </div>

                <div className="flex justify-between">
                  <span className="text-[#4e5746]">Available Club Funds:</span>
                  <strong className="font-mono">🪙 {teamFunds.toLocaleString()}</strong>
                </div>

                <div className="pt-2 border-t border-[#e4e7df]">
                  <label className="block font-bold text-[#1b2018] mb-1">
                    Your Bid Amount (🪙 Coins):
                  </label>
                  <input
                    type="number"
                    step={50}
                    value={bidAmountInput}
                    onChange={(e) => setBidAmountInput(Number(e.target.value))}
                    className="cm-input w-full font-mono font-bold text-sm"
                  />
                  <span className="text-[11px] text-[#4e5746] mt-1 block">
                    Minimum increment is +5% above current bid. Funds are reserved in Escrow until outbid.
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setBiddingTarget(null)} className="cm-btn text-xs">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmitBid}
                  className="cm-btn cm-btn-primary text-xs py-2 px-4"
                >
                  Confirm Escrow Bid ▸
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
