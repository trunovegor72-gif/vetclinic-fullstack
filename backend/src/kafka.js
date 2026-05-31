import { Kafka, logLevel } from "kafkajs";
import { timeMoscow } from "./time.js";

const BROKER = process.env.KAFKA_BROKER || "kafka:9092";

const kafka = new Kafka({
  clientId: "vetclinic-backend",
  brokers: [BROKER],
  logLevel: logLevel.NOTHING,
  retry: { initialRetryTime: 1000, retries: 20 },
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: "vetclinic-group" });

export const TOPICS = {
  APPOINTMENT_CREATED: "appointment.created",
  LAB_ORDER_CREATED: "lab.order.created",
  LAB_RESULT_READY: "lab.result.ready",
};

export const status = { ready: false, lastError: null };

export const eventLog = [];
function pushLog(topic, payload) {
  eventLog.unshift({
    id: "evt-" + Math.random().toString(36).slice(2, 8),
    topic,
    payload,
    ts: timeMoscow(),
  });
  if (eventLog.length > 50) eventLog.pop();
}

// При старте контейнеров backend может подняться раньше брокера —
// поэтому пытаемся подключиться с повторами
async function waitForKafka() {
  for (let i = 1; i <= 20; i++) {
    try {
      const admin = kafka.admin();
      await admin.connect();
      await admin.createTopics({
        topics: Object.values(TOPICS).map((t) => ({ topic: t, numPartitions: 1 })),
        waitForLeaders: true,
      });
      await admin.disconnect();
      console.log(`[kafka] брокер ${BROKER} готов`);
      return;
    } catch (e) {
      console.log(`[kafka] ожидание брокера (попытка ${i}/20)…`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw new Error("Kafka недоступна");
}

export async function initKafka(onMessage) {
  await waitForKafka();
  await producer.connect();
  await consumer.connect();
  await consumer.subscribe({ topics: Object.values(TOPICS), fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const payload = JSON.parse(message.value.toString());
      if (onMessage) await onMessage(topic, payload);
    },
  });

  status.ready = true;
  console.log("[kafka] подключено");
}

export async function publish(topic, payload) {
  if (!status.ready) {
    const err = "Kafka не подключена";
    status.lastError = err;
    throw new Error(err);
  }
  try {
    await producer.send({
      topic,
      messages: [{ value: JSON.stringify(payload) }],
    });
    pushLog(topic, payload);
  } catch (e) {
    status.lastError = e.message;
    throw e;
  }
}
