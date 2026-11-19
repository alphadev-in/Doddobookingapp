# Production image: builds the Astro app and runs the Node server (standalone adapter).
FROM node:22-alpine AS build
WORKDIR /app
ARG PUBLIC_SITE_URL=https://doddo.co.uk
ENV PUBLIC_SITE_URL=$PUBLIC_SITE_URL
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx astro build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
EXPOSE 8080
CMD ["node", "./dist/server/entry.mjs"]
