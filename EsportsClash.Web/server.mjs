import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { CHAMPIONS } from './src/mockData.ts';

const root = dirname(fileURLToPath(import.meta.url));
const rooms = new Map();
const championIds = new Set(CHAMPIONS.map(champion => champion.id));
const turns = [
  ['blue', 'ban'], ['red', 'ban'], ['blue', 'pick'], ['red', 'pick'], ['red', 'pick'],
  ['blue', 'pick'], ['blue', 'pick'], ['red', 'pick'], ['red', 'pick'],
  ['blue', 'pick'], ['blue', 'pick'], ['red', 'pick']
];
const roomLifetimeMs = 2 * 60 * 60 * 1000;

function json(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
}

function safeRoster(roster) {
  if (!Array.isArray(roster) || roster.length !== 5 || new Set(roster.map(player => player?.id)).size !== 5
    || !roster.every(player => typeof player?.id === 'string' && typeof player?.name === 'string'
      && player.stats && Number.isFinite(player.ovr) && Array.isArray(player.signatureChampions))) return null;
  return structuredClone(roster);
}

function safeCoach(coach) {
  return coach && typeof coach.id === 'string' && typeof coach.name === 'string'
    && typeof coach.style === 'string' && Number.isFinite(coach.playbookBonus) ? structuredClone(coach) : null;
}

async function body(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 65536) throw new Error('Request too large');
  }
  try { return JSON.parse(raw || '{}'); } catch { throw new Error('Invalid JSON'); }
}

function publicRoom(room) {
  const { tokens, touched, ...state } = room;
  return { 
    ...state, 
    matchType: room.matchType || 'ranked',
    blueRating: room.blueRating || 300,
    redRating: room.redRating || 300,
    ready: !!room.redCoach 
  };
}

export function createRoom(roster, coach, matchType = 'ranked', rating = 300) {
  const blueRoster = safeRoster(roster);
  const blueCoach = safeCoach(coach);
  if (!blueRoster || !blueCoach) throw new Error('Select a valid five player roster and coach.');
  let code;
  do { code = randomBytes(4).toString('hex').slice(0, 6).toUpperCase(); } while (rooms.has(code));
  const token = randomBytes(32).toString('hex');
  const room = { 
    roomCode: code, 
    matchType: matchType === 'normal' ? 'normal' : 'ranked',
    blueRating: Number.isFinite(rating) ? Math.round(rating) : 300,
    redRating: 300,
    turnIndex: 0, 
    bans: {}, 
    picks: { blue: [], red: [] },
    blueRoster, 
    redRoster: [], 
    blueCoach, 
    redCoach: null,
    seed: randomBytes(4).readUInt32BE(0), 
    revision: 0,
    tokens: { blue: token, red: null }, 
    touched: Date.now() 
  };
  rooms.set(code, room);
  return { token, side: 'blue', room: publicRoom(room) };
}

export function joinRoom(code, roster, coach, rating = 300) {
  const room = rooms.get(code?.toUpperCase());
  if (!room) throw new Error('Room not found or expired.');
  if (room.tokens.red) throw new Error('This room already has two players.');
  const redRoster = safeRoster(roster);
  const redCoach = safeCoach(coach);
  if (!redRoster || !redCoach) throw new Error('Select a valid five player roster and coach.');
  const token = randomBytes(32).toString('hex');
  room.redRoster = redRoster;
  room.redCoach = redCoach;
  room.redRating = Number.isFinite(rating) ? Math.round(rating) : 300;
  room.tokens.red = token;
  room.revision++;
  room.touched = Date.now();
  return { token, side: 'red', room: publicRoom(room) };
}

export function getRoom(code, token) {
  const room = rooms.get(code?.toUpperCase());
  if (!room || !Object.values(room.tokens).includes(token)) throw new Error('Room not found or access denied.');
  room.touched = Date.now();
  return publicRoom(room);
}

export function submitDraftTurn(code, token, championId, slot, expectedRevision) {
  const room = rooms.get(code?.toUpperCase());
  if (!room || !Object.values(room.tokens).includes(token)) throw new Error('Room not found or access denied.');
  if (!room.redCoach) throw new Error('Wait for the second player.');
  if (room.revision !== expectedRevision) throw new Error('Draft changed. Refresh and try again.');
  const [side, action] = turns[room.turnIndex] ?? [];
  if (!side) throw new Error('Draft is already complete.');
  if (room.tokens[side] !== token) throw new Error('Wait for your draft turn.');
  if (!championIds.has(championId)) throw new Error('Unknown avatar.');
  if (Object.values(room.bans).includes(championId)
    || [...room.picks.blue, ...room.picks.red].some(pick => pick.championId === championId))
    throw new Error('This avatar is already banned or picked.');
  if (action === 'ban') room.bans[side] = championId;
  else {
    const roster = side === 'blue' ? room.blueRoster : room.redRoster;
    if (!Number.isInteger(slot) || slot < 0 || slot >= roster.length
      || room.picks[side].some(pick => pick.slot === slot)) throw new Error('Choose an empty player slot.');
    room.picks[side].push({ slot, championId });
  }
  room.turnIndex++;
  room.revision++;
  room.touched = Date.now();
  return publicRoom(room);
}

async function serveStatic(req, res, pathname) {
  const dist = resolve(root, 'dist');
  const requested = resolve(dist, `.${pathname}`);
  if (requested !== dist && !requested.startsWith(dist + sep)) return json(res, 403, { error: 'Forbidden' });
  let file = requested;
  try {
    if (!(await stat(file)).isFile()) file = join(dist, 'index.html');
  } catch { file = join(dist, 'index.html'); }
  try {
    const data = await readFile(file);
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
      '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' }[extname(file)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  } catch { json(res, 404, { error: 'Build the site before starting the production server.' }); }
}

export function makeServer() {
  return createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url, 'http://localhost').pathname;
      if (!pathname.startsWith('/api/')) return serveStatic(req, res, pathname);
      for (const [code, room] of rooms) if (Date.now() - room.touched > roomLifetimeMs) rooms.delete(code);
      const segments = pathname.split('/').filter(Boolean);
      if (req.method === 'POST' && pathname === '/api/rooms') {
        const data = await body(req);
        return json(res, 201, createRoom(data.roster, data.coach, data.matchType, data.rating));
      }
      const code = segments[2];
      if (!/^[A-F0-9]{6}$/i.test(code || '')) return json(res, 404, { error: 'Room not found.' });
      if (req.method === 'POST' && segments[3] === 'join') {
        const data = await body(req);
        return json(res, 200, joinRoom(code, data.roster, data.coach, data.rating));
      }
      const token = req.headers.authorization?.replace(/^Bearer /, '');
      if (req.method === 'GET' && segments.length === 3) return json(res, 200, getRoom(code, token));
      if (req.method === 'POST' && segments[3] === 'draft') {
        const data = await body(req);
        return json(res, 200, submitDraftTurn(code, token, data.championId, data.slot, data.revision));
      }
      return json(res, 404, { error: 'Unknown route.' });
    } catch (error) {
      json(res, 400, { error: error instanceof Error ? error.message : 'Request failed.' });
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4174);
  makeServer().listen(port, '0.0.0.0', () => console.log(`Esports Clash rooms on port ${port}`));
}
