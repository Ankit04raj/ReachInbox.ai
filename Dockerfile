FROM node:18-alpine

WORKDIR /app

# Copy backend only (Railway builds from root)
COPY apps/backend/package*.json ./
RUN npm install -g ts-node-dev

# Copy backend code
COPY apps/backend/ ./
RUN npm install

# Build
EXPOSE ${PORT:-4000}

CMD ["npx", "ts-node-dev", "--respawn", "--transpile-only", "src/server.ts"]