import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL || "redis://redis:6379", {
  retryStrategy: (times) => Math.min(times * 500, 5000),
});

redis.on("connect", () => console.log("[redis] подключён"));
redis.on("error", (e) => console.log("[redis] ошибка:", e.message));

export const stats = { hits: 0, misses: 0 };

const TTL_SECONDS = 15;

export async function getSchedule(key) {
  const val = await redis.get(key);
  if (val) {
    stats.hits++;
    return JSON.parse(val);
  }
  stats.misses++;
  return null;
}

export async function setSchedule(key, value) {
  await redis.set(key, JSON.stringify(value), "EX", TTL_SECONDS);
}

export async function invalidate(key) {
  await redis.del(key);
}

export async function ttlLeft(key) {
  const t = await redis.ttl(key);
  return t > 0 ? t : 0;
}
