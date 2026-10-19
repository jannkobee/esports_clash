"""Owner-invoked, one-source texture experiment. No Laravel history restoration."""
import asyncio,fcntl,hashlib,json,os,time,uuid,sys
from pathlib import Path
from aiohttp import ClientSession,ClientTimeout
import service

async def main():
    source_id=service.identifier(sys.argv[1]);pilot_id=service.identifier(sys.argv[2])
    source=service.ROOT/'output'/(source_id+'.glb');reference=service.ROOT/'input'/(source_id+'.png')
    original=json.loads((service.ROOT/'jobs'/source_id/'state.json').read_text())
    if source.is_symlink() or reference.is_symlink() or service.sha(source.read_bytes())!=original['artifact']['sha256']:
        raise RuntimeError('Preserved source identity mismatch')
    folder=service.ROOT/'diagnostics'/pilot_id;folder.mkdir(parents=True,exist_ok=False)
    plan={'kind':'manual-texture-only-diagnostic','source_id':source_id,'source_sha256':service.sha(source.read_bytes()),'reference_sha256':service.sha(reference.read_bytes()),'seed':25001,'resolution':512,'texture_steps':12,'texture_size':1024,'image_id':os.environ.get('TRELLIS_IMAGE_ID'),'script_sha256':service.sha(Path(__file__).read_bytes()),'engine':service.engine_manifest(),'publication_eligible':False}
    (folder/'plan.json').write_text(json.dumps(plan,indent=2))
    workflow={
      '1':{'class_type':'Trellis2LoadImageWithTransparency_GGUF','inputs':{'image':source_id+'.png'}},
      '2':{'class_type':'Trellis2PreProcessImage_GGUF','inputs':{'image':['1',2],'padding':16,'remove_background':False}},
      '3':{'class_type':'Trellis2LoadModel_GGUF','inputs':{'modelname':'TRELLIS.2-4B','model_format':'GGUF Q4_K_M','backend':'sdpa','device':'cuda','low_vram':True,'keep_models_loaded':False}},
      '4':{'class_type':'Trellis2LoadMesh_GGUF','inputs':{'glb_path':str(source)}},
      '5':{'class_type':'Trellis2MeshTexturing_GGUF','inputs':{'pipeline':['3',0],'image':['2',0],'trimesh':['4',0],'seed':25001,'texture_steps':12,'texture_guidance_strength':1.0,'texture_guidance_rescale':0.0,'texture_rescale_t':3.0,'resolution':'512','texture_size':1024,'texture_alpha_mode':'OPAQUE','double_side_material':True,'texture_guidance_interval_start':.6,'texture_guidance_interval_end':.9,'max_views':1,'bake_on_vertices':False,'use_custom_normals':False,'uv_unwrap_method':'Xatlas','mesh_cluster_threshold_cone_half_angle_rad':60.0,'use_tiled_encoder':True,'encoder_tile_size':128,'encoder_overlap':16,'use_tiled_decoder_for_texture':False,'decoder_tile_size':120,'decoder_overlap':48,'sampler':'euler'}},
      '6':{'class_type':'EsportsTrellisExport','inputs':{'mesh':['5',0],'job_id':pilot_id}}}
    (folder/'workflow.json').write_text(json.dumps(workflow,indent=2))
    lock=open('/gpu-lease/inference.lock','a+');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
    initial=await service.resources()
    if initial['vm_available_mib']<5376 or initial['gpu_free_mib']<8500:raise RuntimeError('Texture pilot resource admission deferred')
    started=time.monotonic();last=None
    try:
      await service.start_comfy()
      async with ClientSession(timeout=ClientTimeout(total=15)) as client:
        async with client.post('http://127.0.0.1:8188/prompt',json={'prompt':workflow,'prompt_id':pilot_id}) as response:
          receipt=await response.json()
          if response.status!=200:raise RuntimeError('Texture workflow rejected: '+json.dumps(receipt)[:1500])
        while True:
          sample=await service.resources();(folder/'resources.json').write_text(json.dumps(sample))
          if sample['vm_available_mib']<768 or sample['gpu_used_mib']>11000 or sample['worker_anonymous_mib']>4608 or time.monotonic()-started>1800:raise RuntimeError('Texture resource/deadline guard stopped the pilot')
          async with client.get('http://127.0.0.1:8188/history/'+pilot_id) as response:history=(await response.json()).get(pilot_id)
          if history:
            (folder/'history.json').write_text(json.dumps(history,indent=2))
            if history.get('status',{}).get('status_str')=='error':raise RuntimeError('Texture inference failed; preserved private history')
            if history.get('status',{}).get('completed'):
              artifact=service.validate_output(service.ROOT/'output'/(pilot_id+'.glb'))
              (folder/'result.json').write_text(json.dumps({'artifact':artifact,'seconds':time.monotonic()-started,'publication_eligible':False},indent=2));print(json.dumps({'complete':True,'id':pilot_id,'artifact':artifact}),flush=True);break
          if int(time.monotonic()-started)//20!=last:last=int(time.monotonic()-started)//20;print(json.dumps({'elapsed_seconds':int(time.monotonic()-started),'resources':sample}),flush=True)
          await asyncio.sleep(3)
    finally:
      await service.stop_comfy();lock.close()
if __name__=='__main__':asyncio.run(main())
