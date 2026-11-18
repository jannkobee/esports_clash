ARG EVOLUTION_BASE=teamfight-evolution-runner:local
FROM ${EVOLUTION_BASE}
RUN pip install --no-cache-dir websockets==15.0.1
WORKDIR /workspace/EsportsClash.Web
COPY EsportsClash.Web/package.json EsportsClash.Web/package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY EsportsClash.Web/src/ ./src/
COPY EsportsClash.Web/scripts/build-worker-engine.mjs ./scripts/build-worker-engine.mjs
# One prebuilt engine module: a match process starts in under a second instead of type-stripping every source.
RUN node scripts/build-worker-engine.mjs /online/engine/fps-engine.mjs
COPY infrastructure/online/ /online/
COPY EsportsClash.Api/resources/game/catalog.json /online/catalog.json
COPY EsportsClash.Api/resources/game/manifest.json /online/manifest.json
ENV PYTHONUNBUFFERED=1
CMD ["python", "/online/server.py"]
