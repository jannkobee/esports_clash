FROM teamfight-avatar-tools:local AS blender-runtime
FROM python:3.11-slim-bookworm AS dependencies
ENV PIP_DISABLE_PIP_VERSION_CHECK=1 PIP_DEFAULT_TIMEOUT=180 OMP_NUM_THREADS=2 OPENBLAS_NUM_THREADS=2
RUN apt-get update && apt-get install -y --no-install-recommends git curl ca-certificates build-essential libgl1 libegl1 libopengl0 libgomp1 libx11-6 libxi6 libxxf86vm1 libxfixes3 libxrender1 libsm6 libice6 \
    && rm -rf /var/lib/apt/lists/*
RUN --mount=type=cache,target=/root/.cache/pip pip install torch==2.5.1 torchvision==0.20.1 --index-url https://download.pytorch.org/whl/cu124
COPY infrastructure/unirig/requirements.txt /tmp/unirig-requirements.txt
RUN --mount=type=cache,target=/root/.cache/pip pip install -r /tmp/unirig-requirements.txt
RUN --mount=type=cache,target=/root/.cache/pip pip install torch-scatter==2.1.2 torch-cluster==1.6.3 -f https://data.pyg.org/whl/torch-2.5.1+cu124.html
RUN --mount=type=cache,target=/root/.cache/pip pip install --no-deps 'https://github.com/Dao-AILab/flash-attention/releases/download/v2.7.4.post1/flash_attn-2.7.4.post1%2Bcu12torch2.5cxx11abiFALSE-cp311-cp311-linux_x86_64.whl'
RUN git init /opt/UniRig && git -C /opt/UniRig fetch --depth 1 https://github.com/VAST-AI-Research/UniRig.git 6793c6640ff01c8fb389f3993434124bb43d2933 \
    && GIT_LFS_SKIP_SMUDGE=1 git -C /opt/UniRig checkout --detach FETCH_HEAD
RUN pip freeze > /opt/unirig-packages.txt
FROM dependencies AS worker
COPY --from=blender-runtime /opt/blender-4.5.3-linux-x64/ /opt/blender-4.5.3-linux-x64/
RUN apt-get update && apt-get install -y --no-install-recommends libxkbcommon0 libxcursor1 libxinerama1 libdbus-1-3 \
    && rm -rf /var/lib/apt/lists/*
# Keep the bootstrap layer cached; use the final 4.2 LTS maintenance wheel.
# 4.2.0 segfaulted after GLB extraction on the first actual Dawnna job.
RUN --mount=type=cache,target=/root/.cache/pip pip install --no-deps bpy==4.2.22 \
    && pip freeze > /opt/unirig-packages.txt
COPY infrastructure/unirig/ /opt/unirig-service/
COPY infrastructure/trellis2/catalog.json /opt/unirig-service/catalog.json
RUN python /opt/unirig-service/install.py
ENV UNIRIG_DATA=/unirig-data HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 WANDB_MODE=disabled \
    NVIDIA_DRIVER_CAPABILITIES=compute,utility PYTHONUNBUFFERED=1 PYOPENGL_PLATFORM=egl \
    MALLOC_ARENA_MAX=2
WORKDIR /opt/UniRig
CMD ["python", "/opt/unirig-service/service.py"]
