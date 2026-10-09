import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_LADDER_PROFILE,
  CHESS_RANK_TIERS,
  getChessRank,
  getNextChessRank,
  getRankProgressPercent,
  calculateEloDelta,
  getLadderLeaderboard,
  findLadderOpponent
} from './ladderRating.ts';

test('ladder profile begins at 300 rating with 0 matches', () => {
  assert.equal(DEFAULT_LADDER_PROFILE.rating, 300);
  assert.equal(DEFAULT_LADDER_PROFILE.peakRating, 300);
  assert.equal(DEFAULT_LADDER_PROFILE.wins, 0);
  assert.equal(DEFAULT_LADDER_PROFILE.losses, 0);
  assert.equal(DEFAULT_LADDER_PROFILE.matchesPlayed, 0);
});

test('Chess rank tiers follow genuine Chess hierarchy starting at 300 Pawn without Bronze/Silver/Gold or LP', () => {
  assert.equal(CHESS_RANK_TIERS[0].id, 'pawn');
  assert.equal(CHESS_RANK_TIERS[0].minRating, 300);
  assert.equal(CHESS_RANK_TIERS[0].icon, '♟️');

  assert.equal(CHESS_RANK_TIERS[1].id, 'knight');
  assert.equal(CHESS_RANK_TIERS[1].minRating, 600);
  assert.equal(CHESS_RANK_TIERS[1].icon, '♞');

  assert.equal(CHESS_RANK_TIERS[2].id, 'bishop');
  assert.equal(CHESS_RANK_TIERS[2].minRating, 900);
  assert.equal(CHESS_RANK_TIERS[2].icon, '♝');

  assert.equal(CHESS_RANK_TIERS[3].id, 'rook');
  assert.equal(CHESS_RANK_TIERS[3].minRating, 1200);
  assert.equal(CHESS_RANK_TIERS[3].icon, '♜');

  assert.equal(CHESS_RANK_TIERS[4].id, 'queen');
  assert.equal(CHESS_RANK_TIERS[4].minRating, 1500);
  assert.equal(CHESS_RANK_TIERS[4].icon, '♛');

  assert.equal(CHESS_RANK_TIERS[5].id, 'candidate_master');
  assert.equal(CHESS_RANK_TIERS[5].minRating, 1800);

  assert.equal(CHESS_RANK_TIERS[6].id, 'master');
  assert.equal(CHESS_RANK_TIERS[6].minRating, 2100);

  assert.equal(CHESS_RANK_TIERS[7].id, 'international_master');
  assert.equal(CHESS_RANK_TIERS[7].minRating, 2400);

  assert.equal(CHESS_RANK_TIERS[8].id, 'grandmaster');
  assert.equal(CHESS_RANK_TIERS[8].minRating, 2700);

  // Anti-regression: ensure NO Bronze, Silver, Gold or LP in tiers
  for (const tier of CHESS_RANK_TIERS) {
    const raw = JSON.stringify(tier).toLowerCase();
    assert.equal(raw.includes('bronze'), false, 'Tiers must not contain Bronze');
    assert.equal(raw.includes('silver'), false, 'Tiers must not contain Silver');
    assert.equal(raw.includes('gold'), false, 'Tiers must not contain Gold');
    assert.equal(raw.includes('league point'), false, 'Tiers must not contain League Points');
    assert.equal(raw.includes(' lp '), false, 'Tiers must not contain LP');
  }
});

test('getChessRank correctly identifies rank from rating', () => {
  assert.equal(getChessRank(300).id, 'pawn');
  assert.equal(getChessRank(450).id, 'pawn');
  assert.equal(getChessRank(599).id, 'pawn');
  assert.equal(getChessRank(600).id, 'knight');
  assert.equal(getChessRank(899).id, 'knight');
  assert.equal(getChessRank(900).id, 'bishop');
  assert.equal(getChessRank(1200).id, 'rook');
  assert.equal(getChessRank(1500).id, 'queen');
  assert.equal(getChessRank(1800).id, 'candidate_master');
  assert.equal(getChessRank(2100).id, 'master');
  assert.equal(getChessRank(2400).id, 'international_master');
  assert.equal(getChessRank(2700).id, 'grandmaster');
  assert.equal(getChessRank(3100).id, 'grandmaster');
});

test('getRankProgressPercent computes valid progress to next rank', () => {
  // Pawn is 300 to 599. At 450, halfway -> 50%
  const pct = getRankProgressPercent(450);
  assert.equal(pct, 50);

  // At 300, 0%
  assert.equal(getRankProgressPercent(300), 0);

  // At Grandmaster (2700+), 100%
  assert.equal(getRankProgressPercent(2800), 100);
});

test('calculateEloDelta grants rating on win and protects 300 floor on loss', () => {
  // Win at 300 vs 320 opponent
  const winResult = calculateEloDelta(300, 320, true, 0);
  assert.ok(winResult.delta >= 18, `Win delta should be >= 18, was ${winResult.delta}`);
  assert.equal(winResult.newRating, 300 + winResult.delta);

  // Loss at 300 rating cannot drop below 300 floor
  const floorLoss = calculateEloDelta(300, 310, false, 0);
  assert.equal(floorLoss.newRating, 300, 'Rating at 300 cannot drop below 300 on loss');
  assert.equal(floorLoss.delta, 0);

  // Loss at 400 rating does decrease rating but stays above 300
  const midLoss = calculateEloDelta(400, 400, false, 0);
  assert.ok(midLoss.delta < 0, `Mid loss delta should be negative, was ${midLoss.delta}`);
  assert.ok(midLoss.newRating < 400);
  assert.ok(midLoss.newRating >= 300);
});

test('calculateEloDelta rewards win streaks and flags promotions', () => {
  // Win with streak 4 gets bonus rating
  const normalWin = calculateEloDelta(500, 500, true, 0);
  const streakWin = calculateEloDelta(500, 500, true, 4);
  assert.ok(streakWin.streakBonus > 0);
  assert.ok(streakWin.delta > normalWin.delta);

  // Crossing from 580 to 600+ triggers promotion to Knight
  const promo = calculateEloDelta(585, 620, true, 2);
  assert.equal(promo.promoted, true);
  assert.equal(promo.oldTier.id, 'pawn');
  assert.equal(promo.newTier.id, 'knight');
});

test('getLadderLeaderboard positions player correctly and findLadderOpponent finds nearby rival', () => {
  const profile = { ...DEFAULT_LADDER_PROFILE, rating: 300 };
  const board = getLadderLeaderboard(profile, 'T-Chibi Squad');

  assert.ok(board.length >= 20);
  const playerEntry = board.find(e => e.isPlayer);
  assert.ok(playerEntry, 'Player must be present on the ladder');
  assert.equal(playerEntry.rating, 300);
  assert.equal(playerEntry.tier.id, 'pawn');

  // Verify leaderboard is strictly descending by rating
  for (let i = 1; i < board.length; i++) {
    assert.ok(board[i - 1].rating >= board[i].rating, 'Board must be sorted by rating descending');
    assert.equal(board[i].rank, i + 1);
  }

  // Find opponent for 300 rating player
  const opp = findLadderOpponent(300, board);
  assert.ok(opp, 'Opponent must be found');
  assert.notEqual(opp.isPlayer, true);
  assert.ok(Math.abs(opp.rating - 300) <= 250, 'Matched opponent should be in beginner range');
});

