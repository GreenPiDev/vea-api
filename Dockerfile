FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
# npm ci: installs exactly the lockfile's versions (npm install could resolve
# newer ones on the server than were tested locally).
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
# Run as the image's unprivileged "node" user instead of root.
RUN chown -R node:node /app
USER node

EXPOSE 3000
# `exec` makes node PID 1, so docker stop's SIGTERM reaches it (sh would
# swallow it) and enableShutdownHooks can close things cleanly.
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/src/main.js"]
