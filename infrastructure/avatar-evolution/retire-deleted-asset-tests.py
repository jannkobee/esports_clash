"""Retain historical tests with explicit skips only for deleted binary fixtures."""
from pathlib import Path
root=Path('EsportsClash.Web/src')
all_files=['avatarAuthoredAssets.test.mjs','avatarContactAssets.test.mjs','avatarImportedArsenaldo.test.mjs','avatarModelAssets.test.mjs','avatarVisibility.test.mjs','submittedArsenaldo.test.mjs']
partial={'avatarNaturalMotion.test.mjs':['real GLB transitions retain'],
    'avatarMeshProfiles.test.mjs':['v8 Blender scenes','every v8 GLB'],
    'avatarStance.test.mjs':['historical stance and current combat assets'],
    'avatarWeaponPolish.test.mjs':['v9 shipped GLBs and Blender sources']}
for name in all_files+list(partial):
    path=root/name;text=path.read_text(encoding='utf-8')
    if name in all_files:
        text=text.replace("import test from 'node:test';","import {retiredAvatarAssetTest as test} from './testFixtures/retiredAvatarAssets.mjs';")
        if name=='avatarModelAssets.test.mjs':
            text=text.replace("const manifest=JSON.parse(await readFile(new URL('manifest.json',folder),'utf8'));","const manifest=JSON.parse(await readFile(new URL('manifest.json',folder),'utf8'));")
    else:
        text="import {retiredAvatarAssetTest} from './testFixtures/retiredAvatarAssets.mjs';\n"+text
        for prefix in partial[name]:text=text.replace("test('"+prefix,"retiredAvatarAssetTest('"+prefix)
    path.write_text(text,encoding='utf-8')
