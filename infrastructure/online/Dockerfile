FROM teamfight-evolution-runner:local
RUN pip install --no-cache-dir websockets==15.0.1
WORKDIR /workspace/EsportsClash.Web
COPY EsportsClash.Web/src/ ./src/
COPY infrastructure/online/ /online/
COPY EsportsClash.Api/resources/game/catalog.json /online/catalog.json
COPY EsportsClash.Api/resources/game/manifest.json /online/manifest.json
ENV PYTHONUNBUFFERED=1
CMD ["python", "/online/server.py"]
