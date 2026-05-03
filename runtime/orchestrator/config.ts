import "dotenv/config";

export const config = {
  redisUrl: process.env.REDIS_URL || "redis://127.0.0.1:6379",
};

export default config;