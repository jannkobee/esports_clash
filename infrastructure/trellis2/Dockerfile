FROM python:3.12-slim-bookworm AS dependencies
ARG COMFY_REV=30c259cac8c08ff8d015f9aff3151cb525c9b702
ARG NODES_REV=b3b9e951874c5fb5c936566c93b908299be08b2c
ARG UTILS_REV=35a17ba705d921c7a559ec6067c8eaa5c03ddb37
ENV PYTHONUNBUFFERED=1 PIP_DISABLE_PIP_VERSION_CHECK=1 \
    HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 HF_HUB_DISABLE_TELEMETRY=1 \
    PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True \
    NVIDIA_DRIVER_CAPABILITIES=compute,utility \
    TRELLIS_DATA=/trellis-data
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates libgl1 libglib2.0-0 libgomp1 libegl1 build-essential \
    && rm -rf /var/lib/apt/lists/*
RUN git init /opt/ComfyUI \
    && git -C /opt/ComfyUI fetch --depth 1 https://github.com/comfyanonymous/ComfyUI.git ${COMFY_REV} \
    && git -C /opt/ComfyUI checkout --detach FETCH_HEAD \
    && git init /opt/ComfyUI/custom_nodes/ComfyUI-Trellis2-GGUF \
    && git -C /opt/ComfyUI/custom_nodes/ComfyUI-Trellis2-GGUF fetch --depth 1 https://github.com/Aero-Ex/ComfyUI-Trellis2-GGUF.git ${NODES_REV} \
    && git -C /opt/ComfyUI/custom_nodes/ComfyUI-Trellis2-GGUF checkout --detach FETCH_HEAD \
    && git init /opt/utils3d \
    && git -C /opt/utils3d fetch --depth 1 https://github.com/EasternJournalist/utils3d.git ${UTILS_REV} \
    && git -C /opt/utils3d checkout --detach FETCH_HEAD
# Do not execute the community installer: it resolves mutable wheel URLs,
# installs optional models, and patches arbitrary installed packages.
RUN pip install --no-cache-dir torch==2.9.1 torchvision==0.24.1 torchaudio==2.9.1 --index-url https://download.pytorch.org/whl/cu128
COPY infrastructure/trellis2/requirements.txt /opt/trellis/requirements.txt
RUN pip install --no-cache-dir -r /opt/trellis/requirements.txt \
    && pip install --no-cache-dir --no-deps /opt/utils3d \
    && pip install --no-cache-dir --no-deps /opt/ComfyUI/custom_nodes/ComfyUI-Trellis2-GGUF/wheels/Linux/Torch291/*.whl \
    && pip freeze > /opt/trellis/installed-packages.txt

# The bundled rasterizer omits Ampere sm_86. Compile the pinned upstream
# rasterizer for the actual RTX 3060 instead of shipping an unusable binary.
FROM nvidia/cuda:12.8.1-devel-ubuntu24.04 AS rasterizer
COPY --from=dependencies /usr/local /usr/local
RUN apt-get update && apt-get install -y --no-install-recommends git build-essential libpython3.12-dev ca-certificates libgl1 libglib2.0-0 libgomp1 \
    && rm -rf /var/lib/apt/lists/*
RUN git init /opt/nvdiffrast \
    && git -C /opt/nvdiffrast fetch --depth 1 https://github.com/NVlabs/nvdiffrast.git 253ac4fcea7de5f396371124af597e6cc957bfae \
    && git -C /opt/nvdiffrast checkout --detach FETCH_HEAD \
    && TORCH_CUDA_ARCH_LIST="8.6+PTX" MAX_JOBS=1 CUDA_HOME=/usr/local/cuda pip install --no-build-isolation --no-deps /opt/nvdiffrast

FROM rasterizer AS sparse-kernels
RUN git init /opt/FlexGEMM \
    && git -C /opt/FlexGEMM fetch --depth 1 https://github.com/JeffreyXiang/FlexGEMM.git 6dd94a859c26ee8246888502eada3dd8ad85532e \
    && git -C /opt/FlexGEMM checkout --detach FETCH_HEAD
RUN TORCH_CUDA_ARCH_LIST="8.6+PTX" MAX_JOBS=1 CUDA_HOME=/usr/local/cuda pip install --no-build-isolation --no-deps /opt/FlexGEMM
RUN mkdir -p /opt/trellis && pip freeze > /opt/trellis/installed-packages.txt

FROM sparse-kernels AS voxel-kernels
RUN git init /opt/TrellisNative \
    && git -C /opt/TrellisNative fetch --depth 1 https://github.com/visualbruno/TRELLIS.2.git 65d1e13b4a92296036044df0633242bb9e95abf6 \
    && git -C /opt/TrellisNative checkout --detach FETCH_HEAD \
    && git -C /opt/TrellisNative submodule update --init --depth 1 o-voxel/third_party/eigen
RUN TORCH_CUDA_ARCH_LIST="8.6+PTX" MAX_JOBS=1 CUDA_HOME=/usr/local/cuda pip install --no-build-isolation --no-deps /opt/TrellisNative/o-voxel
RUN pip freeze > /opt/trellis/installed-packages.txt

# Community CuMesh wheels require GLIBCXX_3.4.31 (GCC 13+).
# Trixie's newer glibc/libstdc++ can load the pinned manylinux wheels built in
# the cached dependency stage; do not graft a newer libc into Bookworm.
FROM python:3.12-slim-trixie AS worker
ENV PYTHONUNBUFFERED=1 PIP_DISABLE_PIP_VERSION_CHECK=1 \
    HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 HF_HUB_DISABLE_TELEMETRY=1 \
    PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True \
    NVIDIA_DRIVER_CAPABILITIES=compute,utility TRELLIS_DATA=/trellis-data \
    MALLOC_ARENA_MAX=2 MALLOC_TRIM_THRESHOLD_=131072
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates libgl1 libglib2.0-0 libgomp1 libegl1 libopengl0 build-essential \
    && rm -rf /var/lib/apt/lists/*
COPY --from=dependencies /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
RUN pip uninstall -y nvdiffrast flex_gemm o_voxel
COPY --from=rasterizer /usr/local/lib/python3.12/site-packages/nvdiffrast /usr/local/lib/python3.12/site-packages/nvdiffrast
COPY --from=rasterizer /usr/local/lib/python3.12/site-packages/_nvdiffrast_c.cpython-312-x86_64-linux-gnu.so /usr/local/lib/python3.12/site-packages/_nvdiffrast_c.cpython-312-x86_64-linux-gnu.so
COPY --from=rasterizer /usr/local/lib/python3.12/site-packages/nvdiffrast-0.4.0.dist-info /usr/local/lib/python3.12/site-packages/nvdiffrast-0.4.0.dist-info
COPY --from=sparse-kernels /usr/local/lib/python3.12/site-packages/flex_gemm /usr/local/lib/python3.12/site-packages/flex_gemm
COPY --from=sparse-kernels /usr/local/lib/python3.12/site-packages/flex_gemm-1.0.0.dist-info /usr/local/lib/python3.12/site-packages/flex_gemm-1.0.0.dist-info
COPY --from=voxel-kernels /usr/local/lib/python3.12/site-packages/o_voxel /usr/local/lib/python3.12/site-packages/o_voxel
COPY --from=voxel-kernels /usr/local/lib/python3.12/site-packages/o_voxel-0.0.1.dist-info /usr/local/lib/python3.12/site-packages/o_voxel-0.0.1.dist-info
COPY --from=sparse-kernels /root/.flex_gemm /root/.flex_gemm
COPY --from=dependencies /opt/ComfyUI /opt/ComfyUI
COPY --from=dependencies /opt/utils3d /opt/utils3d
COPY --from=dependencies /opt/trellis /opt/trellis
COPY --from=voxel-kernels /opt/trellis/installed-packages.txt /opt/trellis/installed-packages.txt
RUN git init /opt/ComfyUI/custom_nodes/ComfyUI-GGUF \
    && git -C /opt/ComfyUI/custom_nodes/ComfyUI-GGUF fetch --depth 1 https://github.com/city96/ComfyUI-GGUF.git 6ea2651e7df66d7585f6ffee804b20e92fb38b8a \
    && git -C /opt/ComfyUI/custom_nodes/ComfyUI-GGUF checkout --detach FETCH_HEAD
COPY infrastructure/trellis2 /opt/trellis
RUN python /opt/trellis/patch_nodes.py
COPY infrastructure/trellis2/export_node.py /opt/ComfyUI/custom_nodes/esports_trellis_export/__init__.py
RUN mkdir -p /trellis-data /opt/ComfyUI/input /opt/ComfyUI/output \
    && rm -rf /opt/ComfyUI/models \
    && ln -s /trellis-data/models /opt/ComfyUI/models
WORKDIR /opt/trellis
ENV TRITON_CACHE_DIR=/trellis-data/cache/triton
EXPOSE 8096
CMD ["python", "control.py"]
