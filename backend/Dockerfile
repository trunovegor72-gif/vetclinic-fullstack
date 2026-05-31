FROM node:20-slim

# better-sqlite3 требует инструментов сборки нативного модуля
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

COPY src ./src

# каталог для файла SQLite
RUN mkdir -p /data

EXPOSE 4000
CMD ["npm", "start"]
