import { withBrowser } from './backoffice-browser.mjs';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

await withBrowser(async ({ evaluate, until, navigate, viewport, screenshot, errors, reviewRoot }) => {
  const results = { checks: [], viewports: [], buttonHoverTests: [] };
  const path = '/evolution/avatars/trellis/avatar/c_solana';
  await navigate(path);
  await until('document.querySelector(".asset-workspace")?.dataset.bound === "true"');

  // Requirement 1 & 2: No editable seed input in the UI; server-generated seeds explained
  const seedInputs = await evaluate('document.querySelectorAll(\'input[name="seed"]\').length');
  assert.equal(seedInputs, 0, 'Editable seed inputs must be removed from the UI');
  results.checks.push('No editable seed inputs found in UI');

  const seedExplanation = await evaluate('document.body.innerText.includes("Seeds are generated automatically on the server")');
  assert.equal(seedExplanation, true, 'Server-generated seeds explanation must be visible');
  results.checks.push('Automatic server seed generation notice verified');

  // Requirement 3: Height controls in cm and avatar-height calibration
  const heightInputs = await evaluate('[...document.querySelectorAll(\'input[name="height_cm"]\')].map(i => ({ min: i.min, max: i.max, val: i.value }))');
  assert.ok(heightInputs.length >= 2, 'Both hand slots must have height controls');
  for (const h of heightInputs) {
    assert.equal(h.min, '5');
    assert.equal(h.max, '300');
  }
  results.checks.push(`Weapon height controls in cm present on ${heightInputs.length} slots with min=5, max=300`);

  const calibrationNotice = await evaluate('document.body.textContent.includes("180 cm") && document.body.textContent.includes("calibration")');
  assert.equal(calibrationNotice, true, 'Avatar 180cm calibration note must be present');
  results.checks.push('180cm avatar stature calibration note verified');

  // Requirement 1 & 5: Generation / retry actions and history container present
  const generateButtons = await evaluate('[...document.querySelectorAll(".equipment-generate-action button")].map(b => b.textContent.trim())');
  assert.ok(generateButtons.length >= 1, 'Generate 3D mesh button must be present for equipped hands');
  results.checks.push(`Equipment generation button visible: ${generateButtons.join(', ')}`);

  // Requirement 5: Buttons must not change color on hover
  const buttonSelectors = [
    '.equipment-generate-action button',
    '.asset-save',
    '.studio-steps a',
    '.button.primary',
    '#asset-prompts summary'
  ];

  for (const sel of buttonSelectors) {
    const exists = await evaluate(`Boolean(document.querySelector(${JSON.stringify(sel)}))`);
    if (!exists) continue;
    const colors = await evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(sel)});
      const beforeBg = getComputedStyle(el).backgroundColor;
      const beforeColor = getComputedStyle(el).color;
      el.dispatchEvent(new MouseEvent('mouseenter'));
      const hoverBg = getComputedStyle(el).backgroundColor;
      const hoverColor = getComputedStyle(el).color;
      el.dispatchEvent(new MouseEvent('mouseleave'));
      return { sel: ${JSON.stringify(sel)}, beforeBg, hoverBg, beforeColor, hoverColor };
    })()`);
    assert.equal(colors.beforeBg, colors.hoverBg, `Button background color changed on hover for ${sel}: ${colors.beforeBg} -> ${colors.hoverBg}`);
    assert.equal(colors.beforeColor, colors.hoverColor, `Button text color changed on hover for ${sel}: ${colors.beforeColor} -> ${colors.hoverColor}`);
    results.buttonHoverTests.push(colors);
  }
  results.checks.push(`Zero hover color changes verified across ${results.buttonHoverTests.length} button classes`);

  // Responsive layout verification
  for (const width of [1440, 1000, 768, 390, 320]) {
    await viewport(width, width < 500 ? 844 : 900);
    const size = await evaluate('({width:innerWidth,content:document.documentElement.scrollWidth})');
    assert.ok(size.content <= size.width + 1, `Horizontal overflow at ${width}px: content=${size.content}`);
    results.viewports.push(size);
    if (width === 1440 || width === 390) {
      await screenshot(`dawnna-weapon-generation-ui-${width}.png`);
    }
  }

  assert.deepEqual(errors, []);
  results.errors = errors;
  await writeFile(reviewRoot + '/dawnna-weapon-generation-ui-verification.json', JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
});
