import { Queue } from "bullmq";

const url = new URL(
  process.env.REDIS_URL || "redis://localhost:6379"
);

export const messageQueue = new Queue("wbpro-messages", {
  connection: {
    host: url.hostname,
    port: Number(url.port || 6379)
  }
});
