FROM node:18-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:18-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/assets ./assets
COPY --from=build /app/dist ./dist
COPY --from=build /app/game.js ./game.js
COPY --from=build /app/index.html ./index.html
COPY --from=build /app/server.js ./server.js
COPY --from=build /app/stellar_conquest.html ./stellar_conquest.html

RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "server.js"]
