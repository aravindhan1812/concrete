# Build context is the repository root (see docker-compose.yml) so the image
# carries database/ for the migration runner.
FROM node:22-alpine AS build
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY database /database
EXPOSE 3000
# Apply pending migrations, then start the API.
CMD ["sh", "-c", "node dist/database/migrate.js && node dist/main.js"]
