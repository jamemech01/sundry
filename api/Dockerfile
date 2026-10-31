FROM node:24-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npx prisma generate

EXPOSE 3000 3001 3002 3003

CMD ["npm", "run", "dev:gateway"]
