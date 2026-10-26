# Single-container deploy (Railway, Fly.io, any VPS). Serves API + WebSockets + built client.
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm install --include=dev
COPY . .
RUN npm run build
ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000
CMD ["npm", "start"]
