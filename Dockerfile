FROM node:22-alpine as builder

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install --only=production

COPY . .

FROM node:22-alpine

WORKDIR /usr/src/app

COPY --from=builder /usr/src/app .

USER node

CMD ["node", "monitor.js"]
