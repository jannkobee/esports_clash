// Builds the shared tendency formula table (src/fps/fps-tendency-formulas-v4.json) from the weights
// written in deriveFpsTendencies (src/fps/fpsPlayerTendencies.ts). Used by fpsPlayerTendencies.test.mjs,
// which regenerates the table with FPS_WRITE_TENDENCY_FIXTURE=1 and otherwise asserts it is current.
import {readFileSync} from 'node:fs';

const INPUTS = new Set(['init', 'coord', 'delib', 'reass', 'press', 'inst', 'indiv']);

function splitTop(text) {
  const parts = [];let depth = 0, start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') depth--;
    else if (text[i] === '+' && depth === 0) { parts.push(text.slice(start, i)); start = i + 1; }
  }
  return [...parts, text.slice(start)];
}

function checkInput(input, key) {
  if (!INPUTS.has(input) && !/^d\.[a-zA-Z]+$/.test(input)) throw Error(`Unknown tendency input for ${key}: ${input}`);
  return input;
}

// A term is [weight, input, inverted] (weight * input, or weight * (100 - input)), or
// [weight, [[w, input, 0], ...], 0] for a weighted group such as 0.25 * (press * 0.4 + d.riskTolerance * 0.6).
function parseTerm(text, key) {
  const t = text.trim();
  let match = /^(\d*\.?\d+)\s*\*\s*\(\s*100\s*-\s*([\w.]+)\s*\)$/.exec(t);
  if (match) return [Number(match[1]), checkInput(match[2], key), 1];
  match = /^(\d*\.?\d+)\s*\*\s*([\w.]+)$/.exec(t);
  if (match) return [Number(match[1]), checkInput(match[2], key), 0];
  match = /^(\d*\.?\d+)\s*\*\s*\((.+)\)$/.exec(t);
  if (match) return [Number(match[1]), splitTop(match[2]).map(inner => {
    const product = /^\s*([\w.]+)\s*\*\s*(\d*\.?\d+)\s*$/.exec(inner);
    if (!product) throw Error(`Unparseable tendency group for ${key}: ${inner}`);
    return [Number(product[2]), checkInput(product[1], key), 0];
  }), 0];
  throw Error(`Unparseable tendency term for ${key}: ${text}`);
}

function parseBlock(source, opener) {
  const start = source.indexOf(opener);
  if (start < 0) throw Error(`Missing ${opener}`);
  const end = source.indexOf('\n  };', start);
  const out = {};
  for (const line of source.slice(start + opener.length, end).split('\n')) {
    const text = line.replace(/\/\/.*$/, '').trim();
    if (!text) continue;
    const match = /^(\w+):\s*(.+?),?$/.exec(text);
    if (!match) throw Error(`Unparseable tendency line: ${line}`);
    out[match[1]] = splitTop(match[2]).map(term => parseTerm(term, match[1]));
  }
  return out;
}

export function buildFpsTendencyFormulaTable(allKeys) {
  const source = readFileSync(new URL('../src/fps/fpsPlayerTendencies.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const derive = source.slice(source.indexOf('export function deriveFpsTendencies'));
  const span = /jitter\(key,\s*(\d+)\)/.exec(derive);
  if (!span) throw Error('Missing tendency jitter span');
  const base = parseBlock(derive, 'const base: Record<string, number> = {');
  const individual = parseBlock(derive, 'const individualWeights: Record<string, number> = {');
  const formulas = {};
  // deriveFpsTendencies reads base first, then the individual weights.
  for (const key of allKeys) {
    const terms = base[key] ?? individual[key];
    if (terms) formulas[key] = terms;
  }
  const diagnosticsStart = source.indexOf('export function describeIglLeadershipIdentity');
  const diagnosticsEnd = source.indexOf('\n}\n', source.indexOf('export function analyzeTeamDynamics'));
  const used = new Set();
  for (const match of source.slice(diagnosticsStart, diagnosticsEnd).matchAll(/(?:tendencies|iglTendencies|\bt)\.(\w+)/g)) {
    if (allKeys.includes(match[1])) used.add(match[1]);
  }
  return {version: 1, jitterSpan: Number(span[1]), formulas, diagnosticKeys: allKeys.filter(key => used.has(key))};
}
