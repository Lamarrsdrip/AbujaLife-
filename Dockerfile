ARG NODE_IMAGE=node:24-bookworm-slim
ARG MONGO_IMAGE=mongo:8.0
FROM ${MONGO_IMAGE} AS mongo-tools
FROM ${NODE_IMAGE} AS base
ENV NODE_ENV=production PORT=3000
WORKDIR /opt/abujalife
COPY --chown=node:node package.json package-lock.json ./
RUN --mount=type=secret,id=build-ca,required=false \
    if [ -f /run/secrets/build-ca ]; then \
      NODE_EXTRA_CA_CERTS=/run/secrets/build-ca npm ci --omit=dev --ignore-scripts --no-audit --no-fund; \
    else npm ci --omit=dev --ignore-scripts --no-audit --no-fund; fi
COPY --chown=node:node app ./app
COPY --chown=node:node src ./src
COPY --chown=node:node deploy ./deploy
RUN node -e 'if (Number(process.versions.node.split(".")[0]) < 24) process.exit(1)'
FROM base AS runtime
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e 'fetch("http://127.0.0.1:"+(process.env.PORT||3000)+"/api/health").then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))'
# Read private mounted secrets, then drop privileges before importing the API.
ENTRYPOINT ["node", "deploy/api-entrypoint.mjs"]
# Keep the tools on their supported Mongo image, including Kerberos/system
# libraries, and add the tested Node runtime rather than copying bare tools.
FROM mongo-tools AS ops
ENV NODE_ENV=production
WORKDIR /opt/abujalife
COPY --from=base /usr/local/bin/node /usr/local/bin/node
COPY --from=base /opt/abujalife /opt/abujalife
CMD ["node", "deploy/backup.mjs"]
