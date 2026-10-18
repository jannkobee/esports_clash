FROM node:24-bookworm-slim AS avatar-tools
RUN apt-get update && apt-get install -y --no-install-recommends chromium python3 curl xz-utils ca-certificates libx11-6 libxi6 libxxf86vm1 libxfixes3 libxrender1 libgl1 libegl1 libsm6 libice6 libgomp1 \
    && rm -rf /var/lib/apt/lists/*
# Same Blender release as the existing editable source workflow. Official release
# checksum, distributed by Blender's RWTH mirror; do not run downloaded scripts.
RUN curl --fail --location --retry 3 https://ftp.halifax.rwth-aachen.de/blender/release/Blender4.5/blender-4.5.3-linux-x64.tar.xz -o /tmp/blender.tar.xz \
    && echo '975c58fcb244273838534bba771e64ad87739216b0f9b39a888531a49a72d845  /tmp/blender.tar.xz' | sha256sum -c - \
    && tar -xJf /tmp/blender.tar.xz -C /opt && rm /tmp/blender.tar.xz \
    && ln -s /opt/blender-4.5.3-linux-x64/blender /usr/local/bin/blender
FROM avatar-tools AS worker
WORKDIR /workspace/EsportsClash.Web
COPY EsportsClash.Web/package.json EsportsClash.Web/package-lock.json ./
RUN npm ci
COPY EsportsClash.Web/src/ ./src/
COPY EsportsClash.Web/avatar-review.html EsportsClash.Web/vite.avatar.config.ts ./
RUN node node_modules/vite/bin/vite.js build --config vite.avatar.config.ts
COPY EsportsClash.Web/public/models/avatars-v9/ ./public/models/avatars-v9/
COPY EsportsClash.Web/public/models/imports/arsenaldo-claude.glb ./public/models/imports/arsenaldo-claude.glb
COPY EsportsClash.Api/resources/avatars/catalog.json /workspace/catalog.json
COPY infrastructure/avatar-evolution/ /workspace/infrastructure/avatar-evolution/
ENV AVATAR_DATA=/avatar-data NODE_ENV=production OMP_NUM_THREADS=1
CMD ["node","/workspace/infrastructure/avatar-evolution/server.mjs"]
