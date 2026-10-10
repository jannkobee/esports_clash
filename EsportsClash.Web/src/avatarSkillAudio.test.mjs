import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { AVATAR_ANIMATION_MOTIFS } from './avatarSkillAnimation.ts';
import { AVATAR_SOUND_ASSETS, getAvatarSkillSoundCue } from './avatarSkillAudio.ts';
import {
  buildGenerationPrompt,
  getTempoFactorForMinimum,
  inspectWavBytes,
  outputDir,
  parseAbilitySoundCatalog,
  readManifest,
  targetDurationSeconds,
  validateDuration,
} from '../scripts/generate-ability-sounds.mjs';

test('all playable avatars have three distinct recorded skill cues', () => {
  assert.equal(Object.keys(AVATAR_ANIMATION_MOTIFS).length, 45);
  for (const avatarName of Object.keys(AVATAR_ANIMATION_MOTIFS)) {
    const cues = ['skill1', 'skill2', 'ultimate'].map(slot => getAvatarSkillSoundCue(avatarName, slot));
    assert.ok(cues.every(Boolean), `${avatarName} has all skill cues`);
    assert.equal(new Set(cues.map(cue => cue.sample)).size, 3, `${avatarName} has distinct primary recordings`);
    assert.equal(new Set(cues.map(cue => cue.generatedFilename)).size, 3);
    assert.ok(cues.every(cue => /^[a-z0-9_]+\.wav$/.test(cue.generatedFilename)));
    assert.equal(new Set(cues.map(cue => `${cue.sample}:${cue.accent}:${cue.rate}`)).size, 3);
    for (const cue of cues) {
      assert.ok(['arcane', 'fire', 'steel', 'organic', 'void', 'wind', 'impact'].includes(cue.character));
      assert.ok(cue.lowpassHz >= 2000 && cue.lowpassHz <= 8000);
      assert.ok(cue.reverb >= 0 && cue.reverb <= 0.3);
      assert.ok(cue.accentGain > 0 && cue.accentGain < cue.gain);
    }
    assert.ok(cues[2].accentGain > cues[0].accentGain, `${avatarName} ultimate has a stronger accent layer`);
    assert.ok(cues[2].reverb >= cues[0].reverb, `${avatarName} ultimate has a wider ambience tail`);
  }
  assert.equal(getAvatarSkillSoundCue('Unknown', 'skill1'), null);
});

test('all cue recordings are shipped with the game', () => {
  for (const asset of AVATAR_SOUND_ASSETS) {
    const path = fileURLToPath(new URL(`../public/audio/kenney/${asset}.ogg`, import.meta.url));
    assert.ok(existsSync(path), `${asset} is present`);
    assert.equal(readFileSync(path).subarray(0, 4).toString(), 'OggS', `${asset} is an Ogg recording`);
  }
});

test('the generation catalog has exact filenames for every playable avatar skill', () => {
  const prompt = readFileSync(fileURLToPath(new URL('../../docs/ai-ability-sound-generation-prompt.md', import.meta.url)), 'utf8');
  const catalog = parseAbilitySoundCatalog(prompt);
  assert.equal(catalog.length, 135);
  for (const batch of [1, 2, 3]) {
    assert.equal(catalog.filter(entry => entry.batch === batch).length, 45);
  }
  for (const entry of catalog) {
    const slot = entry.slot === 'Skill 1' ? 'skill1' : entry.slot === 'Skill 2' ? 'skill2' : 'ultimate';
    const cue = getAvatarSkillSoundCue(entry.avatar, slot);
    assert.ok(cue, `${entry.avatar} has a cue for ${entry.slot}`);
    assert.equal(cue.generatedFilename, entry.filename);
    const generationPrompt = buildGenerationPrompt(entry);
    assert.match(generationPrompt, new RegExp(entry.ability.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.ok(generationPrompt.length <= 450, `${entry.filename} prompt fits the ElevenLabs text limit`);
  }
  assert.ok(targetDurationSeconds('Skill 1') >= 0.5);
  assert.ok(targetDurationSeconds('Skill 2') >= 0.5);
  assert.ok(targetDurationSeconds('Ultimate') >= 1.2);
  assert.throws(() => validateDuration({ filename: 'short.wav', slot: 'Skill 2' }, { duration_seconds: '0.331' }), /outside its/);
  assert.doesNotThrow(() => validateDuration({ filename: 'complex.wav', slot: 'Skill 2' }, { duration_seconds: '1.45' }));
  assert.throws(() => validateDuration({ filename: 'long.wav', slot: 'Skill 2' }, { duration_seconds: '1.451' }), /outside its/);
  assert.ok(getTempoFactorForMinimum(0.816, 1.2) < 1);
  assert.throws(() => getTempoFactorForMinimum(0.2, 1.2), /Cannot safely time-stretch/);
});

test('WAV validation accepts standard and extensible PCM chunk layouts', () => {
  const makeWav = extensible => {
    const format = Buffer.alloc(extensible ? 40 : 16);
    format.writeUInt16LE(extensible ? 0xfffe : 1, 0);
    format.writeUInt16LE(1, 2);
    format.writeUInt32LE(48000, 4);
    format.writeUInt32LE(144000, 8);
    format.writeUInt16LE(3, 12);
    format.writeUInt16LE(24, 14);
    if (extensible) {
      format.writeUInt16LE(22, 16);
      format.writeUInt16LE(24, 18);
      format.writeUInt32LE(4, 20);
      Buffer.from([1, 0, 0, 0, 0, 0, 16, 0, 128, 0, 0, 170, 0, 56, 155, 113]).copy(format, 24);
    }
    const formatChunk = Buffer.alloc(8 + format.length);
    formatChunk.write('fmt ');
    formatChunk.writeUInt32LE(format.length, 4);
    format.copy(formatChunk, 8);
    const listChunk = Buffer.from('LIST\x02\x00\x00\x00\x00\x00');
    const audioData = Buffer.from([0, 0, 64, 0, 0, 64]);
    const dataChunk = Buffer.alloc(8 + audioData.length);
    dataChunk.write('data');
    dataChunk.writeUInt32LE(audioData.length, 4);
    audioData.copy(dataChunk, 8);
    const chunks = Buffer.concat([formatChunk, listChunk, dataChunk]);
    const wav = Buffer.alloc(12 + chunks.length);
    wav.write('RIFF');
    wav.writeUInt32LE(wav.length - 8, 4);
    wav.write('WAVE', 8);
    chunks.copy(wav, 12);
    return wav;
  };

  for (const extensible of [false, true]) {
    const info = inspectWavBytes(makeWav(extensible));
    assert.equal(info.channels, 1);
    assert.equal(info.sample_rate, 48000);
    assert.equal(info.bit_depth, 24);
    assert.equal(info.duration_seconds, '0.000');
    assert.ok(Number(info.peak_dbfs) < 0);
  }
});

test('all 135 generated ability WAVs are present, match manifest.csv, and are valid unclipped mono 48kHz 24-bit PCM', () => {
  const prompt = readFileSync(fileURLToPath(new URL('../../docs/ai-ability-sound-generation-prompt.md', import.meta.url)), 'utf8');
  const catalog = parseAbilitySoundCatalog(prompt);
  assert.equal(catalog.length, 135);

  const manifest = readManifest();
  assert.equal(manifest.size, 135, 'manifest.csv must contain exactly 135 recorded cues');

  const diskFiles = readdirSync(outputDir).filter(name => name.endsWith('.wav'));
  assert.equal(diskFiles.length, 135, 'public/audio/abilities must contain exactly 135 WAV files');

  const catalogByFilename = new Map(catalog.map(entry => [entry.filename, entry]));

  // Verify that every disk file is listed in the manifest and catalog
  for (const filename of diskFiles) {
    assert.ok(manifest.has(filename), `${filename} must be recorded in manifest.csv`);
    assert.ok(catalogByFilename.has(filename), `${filename} must belong to ability sound catalog`);
  }

  // Verify every catalog entry maps to an existing, valid, unclipped WAV matching manifest stats
  for (const entry of catalog) {
    const slot = entry.slot === 'Skill 1' ? 'skill1' : entry.slot === 'Skill 2' ? 'skill2' : 'ultimate';
    const cue = getAvatarSkillSoundCue(entry.avatar, slot);
    assert.ok(cue, `${entry.avatar} has a defined skill sound cue for ${entry.slot}`);
    assert.equal(cue.generatedFilename, entry.filename);

    const filePath = fileURLToPath(new URL(`../public/audio/abilities/${entry.filename}`, import.meta.url));
    assert.ok(existsSync(filePath), `Generated ability audio must exist: ${entry.filename}`);

    const bytes = readFileSync(filePath);
    const audioInfo = inspectWavBytes(bytes, entry.filename);

    assert.equal(audioInfo.sample_rate, 48000, `${entry.filename} must be 48 kHz`);
    assert.equal(audioInfo.bit_depth, 24, `${entry.filename} must be 24-bit`);
    assert.equal(audioInfo.channels, 1, `${entry.filename} must be mono`);
    assert.ok(Number(audioInfo.peak_dbfs) <= -2.90, `${entry.filename} peak must not clip (${audioInfo.peak_dbfs} dBFS)`);
    validateDuration(entry, audioInfo);

    const manifestRow = manifest.get(entry.filename);
    assert.ok(manifestRow, `${entry.filename} must have a corresponding manifest row`);
    assert.equal(manifestRow.avatar, entry.avatar);
    assert.equal(manifestRow.slot, entry.slot);
    assert.equal(manifestRow.ability, entry.ability);
    assert.equal(manifestRow.sample_rate, '48000');
    assert.equal(manifestRow.bit_depth, '24');
    assert.equal(manifestRow.channels, '1');
    assert.equal(manifestRow.duration_seconds, audioInfo.duration_seconds);
    assert.equal(manifestRow.peak_dbfs, audioInfo.peak_dbfs);
  }
});

