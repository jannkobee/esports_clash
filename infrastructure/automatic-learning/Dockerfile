FROM node:24-bookworm-slim
WORKDIR /app
COPY EsportsClash.Web/src/ EsportsClash.Web/src/
COPY EsportsClash.Api/AutomaticLearning/ EsportsClash.Api/AutomaticLearning/
COPY infrastructure/automatic-learning/ infrastructure/automatic-learning/
USER node
CMD ["node", "infrastructure/automatic-learning/coordinator.mjs"]
