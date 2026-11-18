import test from 'node:test';
import assert from 'node:assert/strict';
import {ICONS, NAV_SETS, FPS_SECTION_ICONS} from './components/ui/icons.ts';
import {FPS_REFERENCE_SECTIONS} from './fps/fpsReference.ts';
import {PEDIA_KINDS} from './hexapedia.ts';

// Each navigation set must be readable at a glance: no two destinations in a set share an icon.
for (const [name, keys] of Object.entries(NAV_SETS)) {
  test(`navigation set "${name}" has a distinct registered icon per destination`, () => {
    const seen = new Map();
    for (const key of keys) {
      assert.ok(ICONS[key], `${name}: "${key}" is not in the icon registry`);
      const other = seen.get(ICONS[key]);
      assert.equal(other, undefined, `${name}: "${key}" reuses the icon of "${other}"`);
      seen.set(ICONS[key], key);
    }
  });
}

test('every Hexapedia FPS reference section has an icon, and the reference nav set covers them all', () => {
  for (const section of Object.keys(FPS_REFERENCE_SECTIONS)) {
    assert.ok(FPS_SECTION_ICONS[section], `no icon for FPS reference section "${section}"`);
    assert.ok(NAV_SETS.pediaReference.includes(FPS_SECTION_ICONS[section]), `"${section}" icon missing from the pediaReference set`);
  }
  assert.equal(Object.keys(FPS_REFERENCE_SECTIONS).length, NAV_SETS.pediaReference.length);
});

test('every Hexapedia record kind has its own registered icon', () => {
  const icons = PEDIA_KINDS.map(kind => ICONS[kind]);
  assert.ok(icons.every(Boolean), 'a record kind has no icon');
  assert.equal(new Set(icons).size, PEDIA_KINDS.length, 'two record kinds share an icon');
});
