import {withBrowser} from './backoffice-browser.mjs';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const preparation=process.argv[2];
assert.match(preparation??'',/^[a-f0-9-]{36}$/,'Pass the prepared execution ID');
await withBrowser(async({navigate,evaluate,until,screenshot,viewport,errors,reviewRoot})=>{
 const results={preparation,pages:[],layouts:[]};
 for(const path of [`/evolution/avatars/preparation/${preparation}/preview`,'/evolution/avatars/trellis/avatar/c_solana']){
  await navigate(path);await until('window.__trellisPreview?.ready',60000);
  const metrics=await evaluate('window.__trellisPreview');
  assert.equal(metrics.meshes,3);assert.equal(metrics.skinned_meshes,3);assert.equal(metrics.animation_clips,10);
  assert.deepEqual(metrics.equipment_slots,['primary','secondary']);
  assert.equal(await evaluate('document.querySelector("#generation-stage").dataset.animation'),'Idle');
  assert.equal(await evaluate('document.querySelector("#generation-stage").dataset.playing'),'true');
  for(const side of ['L','R'])assert.ok(metrics.initial_pose['UpperArm'+side][1]-metrics.initial_pose['Hand'+side][1]>.1,'Default display must lower the hands');
  await evaluate('document.querySelector("#generation-stage").scrollIntoView({block:"center"})');
  await screenshot('equipped-dawnna-'+(path.endsWith('preview')?'prepared':'studio')+'.png');
  const options=await evaluate('[...document.querySelector("#generation-animation").options].filter(option=>option.value!=="").map(option=>({name:option.text,value:option.value}))');
  for(const clip of options){
   await evaluate(`document.querySelector('#generation-animation').value=${JSON.stringify(clip.value)};document.querySelector('#generation-animation').dispatchEvent(new Event('change'));`);
   assert.equal(await evaluate('document.querySelector("#generation-stage").dataset.animation'),clip.name);
  }
  await evaluate('document.querySelector("#generation-play").click()');assert.equal(await evaluate('document.querySelector("#generation-stage").dataset.playing'),'false');
  await evaluate('document.querySelector("#generation-animation").value="";document.querySelector("#generation-animation").dispatchEvent(new Event("change"))');
  assert.equal(await evaluate('document.querySelector("#generation-stage").dataset.animation'),'rest');
  assert.equal(await evaluate('document.querySelector("#generation-play").disabled'),true);
  for(const width of [768,390,320]){
   await viewport(width,844);const size=await evaluate('({width:innerWidth,content:document.documentElement.scrollWidth})');
   assert.ok(size.content<=size.width+1,`Overflow at ${path} / ${width}`);results.layouts.push({path,...size});
  }
  await viewport(1440);results.pages.push({path,metrics,clips:options.map(clip=>clip.name)});
 }
 await navigate('/evolution/avatars/preparation');
 assert.equal(await evaluate('[...document.querySelectorAll(".preparation-job")].filter(row=>row.dataset.name==="Dawnna").length'),1);
 assert.deepEqual(errors,[]);results.errors=errors;
 await writeFile(reviewRoot+'/equipped-dawnna-ui-verification.json',JSON.stringify(results,null,2));
 console.log(JSON.stringify({preparation,pages:results.pages.map(page=>({path:page.path,meshes:page.metrics.meshes,equipment:page.metrics.equipment_slots})),layouts:results.layouts,errors}));
});
