/** Add an editable closed-finger shape to licensed hands without changing their bind data. */
export function addGripMorph(json,binary,profile){
 const chunks=[binary];let length=binary.length;
 function floats(accessor){
  const a=json.accessors[accessor],view=json.bufferViews[a.bufferView];
  if(a.componentType!==5126||a.type!=='VEC3')throw Error('Expected float hand vectors');
  return Array.from({length:a.count},(_,i)=>Array.from({length:3},(_,c)=>binary.readFloatLE((view.byteOffset??0)+(a.byteOffset??0)+i*(view.byteStride??12)+c*4)));
 }
 function append(values){
  const padding=Buffer.alloc((4-length%4)%4);chunks.push(padding);length+=padding.length;
  const bytes=Buffer.alloc(values.length*12);values.forEach((row,i)=>row.forEach((v,c)=>bytes.writeFloatLE(v,i*12+c*4)));
  const view=json.bufferViews.push({buffer:0,byteOffset:length,byteLength:bytes.length})-1;chunks.push(bytes);length+=bytes.length;
  return json.accessors.push({bufferView:view,componentType:5126,type:'VEC3',count:values.length,
   min:[0,1,2].map(c=>Math.min(...values.map(v=>v[c]))),max:[0,1,2].map(c=>Math.max(...values.map(v=>v[c])))})-1;
 }
 for(const node of json.nodes){
  const hand=node.extras?.anatomyTarget;if(!['HandL','HandR'].includes(hand))continue;
  const mesh=json.meshes[node.mesh],amount=(hand==='HandL'?profile.closeLeft:profile.closeRight)??0;
  mesh.extras={...mesh.extras,targetNames:['Grip']};mesh.weights=[amount];
  for(const p of mesh.primitives){
   const positions=floats(p.attributes.POSITION),normals=floats(p.attributes.NORMAL),deltas=[],normalDeltas=[];
   positions.forEach(([x,y,z],i)=>{
    const distance=Math.max(0,-y-2.1),theta=Math.min(distance/1.2,Math.PI*.85),r=1.2;
    const position=distance?[0,-2.1-r*Math.sin(theta)-y,r*(1-Math.cos(theta))]:[0,0,0];
    const [nx,ny,nz]=normals[i];deltas.push(position);
    normalDeltas.push(distance?[0,ny*Math.cos(theta)+nz*Math.sin(theta)-ny,-ny*Math.sin(theta)+nz*Math.cos(theta)-nz]:[0,0,0]);
   });
   p.targets=[{POSITION:append(deltas),NORMAL:append(normalDeltas)}];
  }
 }
 return Buffer.concat(chunks);
}
