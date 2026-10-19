"""Return an actual exported GLB through ComfyUI's history API. No primitives."""
from pathlib import Path
import hashlib
import struct
import uuid
import folder_paths


class EsportsTrellisExport:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"mesh": ("TRIMESH",), "job_id": ("STRING", {})}}

    RETURN_TYPES = ()
    OUTPUT_NODE = True
    FUNCTION = "save"
    CATEGORY = "Esports Clash"

    def save(self, mesh, job_id):
        if str(uuid.UUID(job_id)) != job_id:
            raise ValueError("Invalid generation identifier")
        if len(mesh.vertices) < 3 or len(mesh.faces) < 1:
            raise ValueError("Generation produced no geometry")
        import numpy as np
        if not np.isfinite(mesh.vertices).all():
            raise ValueError("Generation produced non-finite vertices")
        payload = mesh.export(file_type="glb")
        if not isinstance(payload, bytes) or len(payload) > 32 * 1024 * 1024:
            raise ValueError("Generated GLB exceeds 32 MiB")
        if payload[:4] != b"glTF" or struct.unpack_from("<II", payload, 4) != (2, len(payload)):
            raise ValueError("Generation did not export a valid GLB container")
        target = Path(folder_paths.get_output_directory()) / (job_id + ".glb")
        digest = hashlib.sha256(payload).hexdigest()
        if target.exists():
            if hashlib.sha256(target.read_bytes()).hexdigest() != digest:
                raise ValueError("Immutable generation output already exists with different bytes")
        else:
            with target.open("xb") as stream:
                stream.write(payload)
        return {"ui": {"generated_glbs": [{"filename": target.name, "subfolder": "", "type": "output", "sha256": digest}]}}


NODE_CLASS_MAPPINGS = {"EsportsTrellisExport": EsportsTrellisExport}
