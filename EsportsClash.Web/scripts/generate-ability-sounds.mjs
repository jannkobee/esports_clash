import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectDir = resolve(scriptDir, '..');
const promptPath = resolve(projectDir, '..', 'docs', 'ai-ability-sound-generation-prompt.md');
const outputDir = resolve(projectDir, 'public', 'audio', 'abilities');
const manifestPath = resolve(outputDir, 'manifest.csv');
const targetZipDir = resolve(projectDir, '..', 'artifacts');
const manifestColumns = [
  'avatar', 'slot', 'ability', 'filename', 'duration_seconds',
  'sample_rate', 'bit_depth', 'channels', 'peak_dbfs',
];

export function parseAbilitySoundCatalog(markdown) {
  const entries = [];
  let avatar;
  let avatarNumber;

  for (const line of markdown.split(/\r?\n/)) {
    const avatarMatch = line.match(/^(\d+)\.\s+([^/]+?)\s*\/\s*.+$/);
    if (avatarMatch) {
      avatarNumber = Number(avatarMatch[1]);
      avatar = avatarMatch[2].trim();
      continue;
    }
    const abilityMatch = line.match(/^\s*-\s+(Skill 1|Skill 2|Ultimate)\s+—\s+(.+?)\s+—\s+(.+?)\s+Filename:\s+([a-z0-9_]+\.wav)$/);
    if (!abilityMatch) continue;
    if (!avatar || !avatarNumber) throw new Error(`Ability is missing an avatar heading: ${line}`);
    entries.push({
      avatar,
      avatarNumber,
      batch: Math.ceil(avatarNumber / 15),
      slot: abilityMatch[1],
      ability: abilityMatch[2].trim(),
      description: abilityMatch[3].trim(),
      filename: abilityMatch[4],
    });
  }

  if (entries.length !== 135) throw new Error(`Expected 135 ability cues in ${basename(promptPath)}, found ${entries.length}.`);
  const filenames = entries.map(entry => entry.filename);
  if (new Set(filenames).size !== entries.length) throw new Error('The ability sound prompt contains duplicate filenames.');
  for (const batch of [1, 2, 3]) {
    const batchEntries = entries.filter(entry => entry.batch === batch);
    if (batchEntries.length !== 45) throw new Error(`Batch ${batch} must contain 45 files; found ${batchEntries.length}.`);
  }
  return entries;
}

export function buildGenerationPrompt(entry) {
  const scope = entry.slot === 'Ultimate'
    ? 'heavy ultimate activation'
    : entry.slot === 'Skill 2'
      ? 'movement, defense, control, or setup activation'
      : 'quick basic ability activation';
  return [
    'Original dry one-shot for a fantasy arena.',
    `${entry.ability}: ${entry.description}`,
    `${scope}; crisp onset, distinct material, fill the requested duration, clean short tail.`,
    'No voice, music, loops, UI, or recognizable existing-game sounds.',
  ].join(' ');
}

export function targetDurationSeconds(slot) {
  if (slot === 'Skill 1') return 0.88;
  if (slot === 'Skill 2') return 1.08;
  return 2.15;
}

function parseArgs(args) {
  let batch = 1;
  let all = false;
  let force = false;
  let dryRun = false;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--all') all = true;
    else if (arg === '--force') force = true;
    else if (arg === '--dry-run') dryRun = true;
    else if (arg === '--batch') batch = Number(args[++index]);
    else if (arg.startsWith('--batch=')) batch = Number(arg.slice('--batch='.length));
    else throw new Error(`Unknown option: ${arg}`);
  }
  if (!all && ![1, 2, 3].includes(batch)) throw new Error('Choose --batch 1, --batch 2, --batch 3, or --all.');
  return { batches: all ? [1, 2, 3] : [batch], force, dryRun };
}

function csvCell(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export { outputDir, manifestPath };

export function parseCsvLine(line) {
  const cells = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < line.length; index++) {
    const character = line[index];
    if (character === '"' && quoted && line[index + 1] === '"') {
      cell += '"';
      index++;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      cells.push(cell);
      cell = '';
    } else {
      cell += character;
    }
  }
  cells.push(cell);
  return cells;
}

export function readManifest(customPath = manifestPath) {
  if (!existsSync(customPath)) return new Map();
  const [header, ...lines] = readFileSync(customPath, 'utf8').trim().split(/\r?\n/);
  if (!header) return new Map();
  const columns = parseCsvLine(header);
  return new Map(lines.filter(Boolean).map(line => {
    const cells = parseCsvLine(line);
    return [cells[columns.indexOf('filename')], Object.fromEntries(columns.map((column, index) => [column, cells[index]]))];
  }));
}

function writeManifest(rows) {
  writeManifestAt(manifestPath, rows);
}

function runFfmpeg(args) {
  const result = spawnSync('ffmpeg', args, { encoding: 'utf8', windowsHide: true });
  if (result.error) throw new Error(`FFmpeg is required to process generated audio: ${result.error.message}`);
  if (result.status !== 0) {
    const details = `${result.stderr || result.stdout || ''}`.trim();
    throw new Error(`FFmpeg failed (${result.status}): ${details.slice(-1800)}`);
  }
}

export function inspectWavBytes(bytes, path = '<buffer>') {
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`${path} is not a valid WAV file.`);
  }
  let format;
  let channels;
  let sampleRate;
  let bits;
  let blockAlign;
  let dataOffset = -1;
  let dataSize = 0;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const chunkId = bytes.toString('ascii', offset, offset + 4);
    const chunkSize = bytes.readUInt32LE(offset + 4);
    const chunkData = offset + 8;
    const chunkEnd = chunkData + chunkSize;
    if (chunkEnd > bytes.length) throw new Error(`${path} has a truncated ${chunkId} chunk.`);
    if (chunkId === 'fmt ') {
      if (chunkSize < 16) throw new Error(`${path} has an incomplete WAV format chunk.`);
      format = bytes.readUInt16LE(chunkData);
      channels = bytes.readUInt16LE(chunkData + 2);
      sampleRate = bytes.readUInt32LE(chunkData + 4);
      blockAlign = bytes.readUInt16LE(chunkData + 12);
      bits = bytes.readUInt16LE(chunkData + 14);
      if (format === 0xfffe) {
        const pcmSubformat = Buffer.from([1, 0, 0, 0, 0, 0, 16, 0, 128, 0, 0, 170, 0, 56, 155, 113]);
        if (chunkSize < 40 || bytes.readUInt16LE(chunkData + 16) < 22
          || bytes.readUInt16LE(chunkData + 18) !== bits
          || !bytes.subarray(chunkData + 24, chunkData + 40).equals(pcmSubformat)) {
          throw new Error(`${path} uses an unsupported extensible WAV format.`);
        }
        format = 1;
      }
    } else if (chunkId === 'data' && dataOffset < 0) {
      dataOffset = chunkData;
      dataSize = chunkSize;
    }
    offset = chunkEnd + (chunkSize & 1);
  }
  if (format !== 1 || channels !== 1 || sampleRate !== 48000 || bits !== 24
    || blockAlign !== 3 || dataSize <= 0 || dataSize % blockAlign !== 0
    || dataOffset < 0 || dataOffset + dataSize > bytes.length) {
    throw new Error(`${path} must be non-empty mono 48 kHz 24-bit PCM (found format=${format}, channels=${channels}, sampleRate=${sampleRate}, bits=${bits}).`);
  }
  let peak = 0;
  for (let offset = dataOffset; offset + 2 < dataOffset + dataSize; offset += blockAlign) {
    let sample = bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
    if (sample & 0x800000) sample |= 0xff000000;
    peak = Math.max(peak, Math.abs(sample / 0x800000));
  }
  if (peak >= 1) throw new Error(`${path} contains clipped samples.`);
  const peakDbfs = peak === 0 ? '-Infinity' : (20 * Math.log10(peak)).toFixed(2);
  return {
    duration_seconds: ((dataSize / blockAlign) / sampleRate).toFixed(3),
    sample_rate: sampleRate,
    bit_depth: bits,
    channels,
    peak_dbfs: peakDbfs,
  };
}

function inspectWav(path) {
  return inspectWavBytes(readFileSync(path), path);
}

export function validateDuration(entry, audioInfo) {
  const duration = Number(audioInfo.duration_seconds);
  const bounds = entry.slot === 'Skill 1' ? [0.45, 0.9]
    : entry.slot === 'Skill 2' ? [0.55, 1.1] : [1.2, 2.2];
  const maximumWithComplexTail = bounds[1] + 0.35;
  if (duration < bounds[0] || duration > maximumWithComplexTail) {
    throw new Error(`${entry.filename} duration ${duration}s is outside its ${bounds[0]}–${bounds[1]}s ${entry.slot} range (up to ${maximumWithComplexTail}s for complex cues).`);
  }
}

export function getTempoFactorForMinimum(durationSeconds, minimumSeconds) {
  const factor = durationSeconds / (minimumSeconds + 0.025);
  if (!Number.isFinite(factor) || factor < 0.5 || factor >= 1) {
    throw new Error(`Cannot safely time-stretch ${durationSeconds}s audio to at least ${minimumSeconds}s.`);
  }
  return factor;
}

async function requestSound(entry, apiKey, durationSeconds = targetDurationSeconds(entry.slot)) {
  const endpoint = new URL('https://api.elevenlabs.io/v1/sound-generation');
  endpoint.searchParams.set('output_format', 'mp3_44100_128');
  const payload = {
    text: buildGenerationPrompt(entry),
    duration_seconds: durationSeconds,
    prompt_influence: 0.45,
    model_id: 'eleven_text_to_sound_v2',
  };
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      const audio = Buffer.from(await response.arrayBuffer());
      if (audio.length < 512 || audio.toString('ascii', 0, 3) !== 'ID3' && audio[0] !== 0xff) {
        throw new Error(`The API response for ${entry.filename} was not a recognizable MP3.`);
      }
      return audio;
    }
    const errorText = (await response.text()).slice(0, 1000);
    if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 3) {
      throw new Error(`ElevenLabs failed for ${entry.filename} (${response.status}): ${errorText}`);
    }
    const retryAfter = Number(response.headers.get('retry-after'));
    const delay = Number.isFinite(retryAfter) && retryAfter > 0
      ? Math.min(retryAfter * 1000, 30000)
      : 1200 * (attempt + 1);
    await new Promise(resolveDelay => setTimeout(resolveDelay, delay));
  }
  throw new Error(`Audio generation did not complete for ${entry.filename}.`);
}

function convertAudio(sourcePath, targetPath) {
  runFfmpeg([
    '-y', '-hide_banner', '-loglevel', 'error', '-i', sourcePath,
    '-af', 'silenceremove=start_periods=1:start_duration=0:start_threshold=-50dB:start_silence=0.01:stop_periods=1:stop_duration=0.05:stop_threshold=-50dB,aresample=48000,loudnorm=I=-22:TP=-3:LRA=7',
    '-ac', '1', '-ar', '48000', '-c:a', 'pcm_s24le', targetPath,
  ]);
}

function stretchWavToMinimum(sourcePath, targetPath, durationSeconds, minimumSeconds) {
  const tempoFactor = getTempoFactorForMinimum(durationSeconds, minimumSeconds);
  runFfmpeg([
    '-y', '-hide_banner', '-loglevel', 'error', '-i', sourcePath,
    '-af', `atempo=${tempoFactor.toFixed(6)},loudnorm=I=-22:TP=-3:LRA=7`,
    '-ac', '1', '-ar', '48000', '-c:a', 'pcm_s24le', targetPath,
  ]);
}

function zipBatch(batch, entries) {
  mkdirSync(targetZipDir, { recursive: true });
  const zipPath = resolve(targetZipDir, `ability-sounds-batch-${batch}.zip`);
  const batchManifestPath = resolve(tmpdir(), `esports-clash-batch-${batch}-${randomUUID()}.csv`);
  const paths = [...entries.map(entry => resolve(outputDir, entry.filename)), batchManifestPath];
  const rows = readManifest();
  const batchRows = new Map(entries.map(entry => [entry.filename, rows.get(entry.filename)]).filter(([, row]) => row));
  writeManifestAt(batchManifestPath, batchRows);
  const command = '$files = ConvertFrom-Json -InputObject $env:ABILITY_SOUND_ZIP_FILES; Compress-Archive -LiteralPath $files -DestinationPath $env:ABILITY_SOUND_ZIP_OUT -Force';
  try {
    const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
      encoding: 'utf8',
      windowsHide: true,
      env: {
        ...process.env,
        ABILITY_SOUND_ZIP_FILES: JSON.stringify(paths),
        ABILITY_SOUND_ZIP_OUT: zipPath,
      },
    });
    if (result.error || result.status !== 0) {
      throw new Error(`Could not package batch ${batch}: ${result.error?.message ?? result.stderr ?? 'Compress-Archive failed.'}`);
    }
  } finally {
    if (existsSync(batchManifestPath)) unlinkSync(batchManifestPath);
  }
  return zipPath;
}

function writeManifestAt(path, rows) {
  const ordered = [...rows.values()].sort((left, right) => left.filename.localeCompare(right.filename));
  const lines = [manifestColumns.join(',')];
  for (const row of ordered) lines.push(manifestColumns.map(column => csvCell(row[column] ?? '')).join(','));
  writeFileSync(path, `${lines.join('\n')}\n`, 'utf8');
}

export async function generateAbilitySoundBatches({ batches, force = false, dryRun = false }) {
  const catalog = parseAbilitySoundCatalog(readFileSync(promptPath, 'utf8'));
  const work = catalog.filter(entry => batches.includes(entry.batch));
  if (dryRun) return { catalog, work };

  const envPath = resolve(projectDir, '.env');
  if (existsSync(envPath)) process.loadEnvFile(envPath);
  const toGenerate = work.filter(entry => force || !existsSync(resolve(outputDir, entry.filename)));
  const apiKey = process.env.ELEVENLABS_API_KEY ?? '';
  if (toGenerate.length && !apiKey) {
    throw new Error('Set ELEVENLABS_API_KEY in your local shell before generating. Do not commit it or paste it into chat.');
  }
  if (toGenerate.length) {
    const ffmpegCheck = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8', windowsHide: true });
    if (ffmpegCheck.error || ffmpegCheck.status !== 0) {
      throw new Error('FFmpeg is required but was not found on PATH. Install FFmpeg locally, then rerun; no API calls were made.');
    }
  }

  mkdirSync(outputDir, { recursive: true });
  const rows = readManifest();
  const completed = [];

  for (const entry of work) {
    const targetPath = resolve(outputDir, entry.filename);
    if (existsSync(targetPath) && !force) {
      const audioInfo = inspectWav(targetPath);
      validateDuration(entry, audioInfo);
      rows.set(entry.filename, {
        avatar: entry.avatar,
        slot: entry.slot,
        ability: entry.ability,
        filename: entry.filename,
        ...audioInfo,
      });
      completed.push(entry);
      continue;
    }

    let acceptedAudioInfo;
    const bounds = entry.slot === 'Skill 1' ? [0.45, 0.9]
      : entry.slot === 'Skill 2' ? [0.55, 1.1] : [1.2, 2.2];
    const requestDurations = [...new Set([
      targetDurationSeconds(entry.slot),
      bounds[1] + 0.35,
    ])];
    for (const [attempt, durationSeconds] of requestDurations.entries()) {
      const requestId = randomUUID();
      const rawPath = resolve(tmpdir(), `esports-clash-${requestId}.mp3`);
      const processedPath = resolve(tmpdir(), `esports-clash-${requestId}.wav`);
      const stretchedPath = resolve(tmpdir(), `esports-clash-${requestId}-stretched.wav`);
      try {
        const audio = await requestSound(entry, apiKey, durationSeconds);
        writeFileSync(rawPath, audio);
        convertAudio(rawPath, processedPath);
        const audioInfo = inspectWav(processedPath);
        if (Number(audioInfo.duration_seconds) < bounds[0]) {
          if (attempt < requestDurations.length - 1) {
            console.warn(`${entry.filename} rendered too short (${audioInfo.duration_seconds}s); retrying once at ${durationSeconds}s.`);
            continue;
          }
          stretchWavToMinimum(processedPath, stretchedPath, Number(audioInfo.duration_seconds), bounds[0]);
          const stretchedInfo = inspectWav(stretchedPath);
          validateDuration(entry, stretchedInfo);
          writeFileSync(targetPath, readFileSync(stretchedPath));
          acceptedAudioInfo = stretchedInfo;
          console.warn(`${entry.filename} was time-stretched slightly to meet the minimum duration.`);
          break;
        }
        validateDuration(entry, audioInfo);
        writeFileSync(targetPath, readFileSync(processedPath));
        acceptedAudioInfo = audioInfo;
        break;
      } finally {
        for (const path of [rawPath, processedPath, stretchedPath]) {
          if (existsSync(path)) unlinkSync(path);
        }
      }
    }
    if (!acceptedAudioInfo) throw new Error(`No valid audio was generated for ${entry.filename}.`);
    rows.set(entry.filename, {
      avatar: entry.avatar,
      slot: entry.slot,
      ability: entry.ability,
      filename: entry.filename,
      ...acceptedAudioInfo,
    });
    writeManifest(rows);
    completed.push(entry);
    console.log(`Generated ${entry.filename} (${acceptedAudioInfo.duration_seconds}s, ${acceptedAudioInfo.peak_dbfs} dBFS sample peak).`);
    await new Promise(resolveDelay => setTimeout(resolveDelay, 350));
  }

  writeManifest(rows);
  const zipPaths = batches.map(batch => {
    const batchEntries = completed.filter(entry => entry.batch === batch);
    return batchEntries.length ? zipBatch(batch, batchEntries) : null;
  }).filter(Boolean);
  return { catalog, work: completed, zipPaths };
}

async function main(args) {
  const options = parseArgs(args);
  const result = await generateAbilitySoundBatches(options);
  if (options.dryRun) {
    console.log(`Validated ${result.catalog.length} unique cues: ${[1, 2, 3].map(batch =>
      `Batch ${batch}: ${result.catalog.filter(entry => entry.batch === batch).length}`).join(', ')}.`);
    for (const batch of options.batches) {
      const entries = result.work.filter(entry => entry.batch === batch);
      console.log(`Batch ${batch}: ${entries.length} cues; first: ${entries[0]?.filename ?? 'none'}, last: ${entries.at(-1)?.filename ?? 'none'}.`);
    }
    return;
  }
  console.log(`Packaged ${result.work.length} files: ${result.zipPaths.join(', ')}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
