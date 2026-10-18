import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { INITIAL_PLAYERS, CHAMPIONS, INITIAL_COACHES } from '../../EsportsClash.Web/src/mockData.ts';
const sha = data => createHash('sha256').update(data).digest('hex');
const root = resolve('EsportsClash.Web');
const files = (await readdir(`${root}/src`, { recursive: true })).filter(file => /\.(tsx?|css)$/.test(file)).sort();
const sources = await Promise.all(files.map(async file => [file.replaceAll('\\', '/'), sha(await readFile(`${root}/src/${file}`))]));
const chosen = new Set();
const starter = ['Fighter', 'Assassin', 'Mage', 'Marksman', 'Support'].map(role => {
  const player = INITIAL_PLAYERS.find(card => !chosen.has(card.id) && (card.preferredRole ?? card.role) === role);
  if (!player) throw Error(`No starter card for ${role}`);
  chosen.add(player.id);
  const eligible = CHAMPIONS.filter(avatar => avatar.primaryRole === role);
  const champion = eligible.find(avatar => player.signatureChampions.includes(avatar.name)) ?? eligible[0];
  return { card_id: player.id, avatar_id: champion.id };
});
const catalog = { schema: 1, cards: INITIAL_PLAYERS, avatars: CHAMPIONS, coaches: INITIAL_COACHES, starter };
const bytes = JSON.stringify(catalog, null, 2) + '\n';
const manifest = { schema: 1, catalog_version: sha(bytes), rules_version: sha(JSON.stringify(sources)),
  policy_version: 'rule-baseline-empty-adaptive-v2', observation_version: 'live-spectator-v1', sources };
await mkdir('EsportsClash.Api/resources/game', { recursive: true });
await writeFile('EsportsClash.Api/resources/game/catalog.json', bytes);
await writeFile('EsportsClash.Api/resources/game/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ cards: catalog.cards.length, avatars: catalog.avatars.length, starter, catalog_version: manifest.catalog_version, rules_version: manifest.rules_version }));
