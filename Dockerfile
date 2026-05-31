FROM node:22-alpine

# better-sqlite3 requires native compilation
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy everything
COPY . .

# Build frontend and install all dependencies
RUN npm ci && npm run build && cd server && npm ci

EXPOSE 3001

CMD ["node", "server/index.js"]
