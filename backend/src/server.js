import express from "express";
import cors from "cors";
import db from "./db.js";
import { initKafka, publish, TOPICS, eventLog, status as kafkaStatus } from "./kafka.js";
import { getSchedule, setSchedule, invalidate, ttlLeft, stats } from "./redis.js";
import { nowMoscow, dateMoscow } from "./time.js";

const app = express();
app.use(cors());
app.use(express.json());

const SLOTS = ["09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00"];

app.get("/api/vets", (req, res) => {
  res.json(db.prepare("SELECT * FROM vets").all());
});

app.get("/api/pets", (req, res) => {
  const pets = db.prepare("SELECT * FROM pets WHERE owner_id = 1").all();
  for (const p of pets) {
    p.records = db.prepare(
      "SELECT date,type,note FROM medical_records WHERE pet_id=? ORDER BY id DESC"
    ).all(p.id);
    p.vaccinations = db.prepare(
      "SELECT name,date,next_date AS next FROM vaccinations WHERE pet_id=?"
    ).all(p.id);
  }
  res.json(pets);
});

app.post("/api/pets", (req, res) => {
  const { name, species, breed, age } = req.body;
  if (!name || !species)
    return res.status(400).json({ error: "Имя и вид обязательны" });
  const info = db.prepare(
    "INSERT INTO pets (owner_id,name,species,breed,age) VALUES (?,?,?,?,?)"
  ).run(1, name, species, breed || "", Number(age) || 0);
  res.json({ ok: true, id: info.lastInsertRowid });
});

app.get("/api/pets/:id", (req, res) => {
  const pet = db.prepare("SELECT * FROM pets WHERE id=?").get(req.params.id);
  if (!pet) return res.status(404).json({ error: "Питомец не найден" });
  pet.records = db.prepare(
    "SELECT id,date,type,note FROM medical_records WHERE pet_id=? ORDER BY id DESC"
  ).all(pet.id);
  pet.vaccinations = db.prepare(
    "SELECT name,date,next_date AS next FROM vaccinations WHERE pet_id=?"
  ).all(pet.id);
  pet.labOrders = db.prepare(
    "SELECT id,test,status,result,created_at FROM lab_orders WHERE pet_id=? ORDER BY id DESC"
  ).all(pet.id);
  res.json(pet);
});

app.get("/api/schedule/:vetId", async (req, res) => {
  const vetId = req.params.vetId;
  const key = `schedule:${vetId}`;

  const cached = await getSchedule(key);
  if (cached) {
    return res.json({ fromCache: true, ttl: await ttlLeft(key), grid: cached });
  }

  const busy = db.prepare("SELECT slot FROM appointments WHERE vet_id=?")
    .all(vetId).map((r) => r.slot);
  const grid = SLOTS.map((s) => ({ slot: s, free: !busy.includes(s) }));
  await setSchedule(key, grid);

  res.json({ fromCache: false, ttl: 15, grid });
});

app.post("/api/appointments", async (req, res) => {
  const { vetId, petId, slot } = req.body;
  const vet = db.prepare("SELECT * FROM vets WHERE id=?").get(vetId);
  const pet = db.prepare("SELECT * FROM pets WHERE id=?").get(petId);
  if (!vet || !pet || !slot)
    return res.status(400).json({ error: "Некорректные данные" });

  const created_at = nowMoscow();
  const info = db.prepare(
    "INSERT INTO appointments (vet_id,pet_id,slot,created_at) VALUES (?,?,?,?)"
  ).run(vetId, petId, slot, created_at);

  await invalidate(`schedule:${vetId}`);

  // Если Kafka недоступна — запись всё равно должна сохраниться
  try {
    await publish(TOPICS.APPOINTMENT_CREATED, {
      apptId: info.lastInsertRowid,
      vetName: vet.name,
      petName: pet.name,
      slot,
    });
  } catch (e) {
    console.error("publish appointment.created:", e.message);
  }

  res.json({ ok: true, id: info.lastInsertRowid });
});

app.get("/api/appointments", (req, res) => {
  const rows = db.prepare(`
    SELECT a.id, a.slot, a.status, a.created_at,
           v.name AS vetName, p.name AS petName, p.species, p.id AS petId
    FROM appointments a
    JOIN vets v ON v.id = a.vet_id
    JOIN pets p ON p.id = a.pet_id
    ORDER BY a.id DESC
  `).all();
  res.json(rows);
});

app.post("/api/appointments/:id/complete", (req, res) => {
  const { note, petId } = req.body;
  db.prepare("INSERT INTO medical_records (pet_id,date,type,note) VALUES (?,?,?,?)")
    .run(petId, dateMoscow(), "Приём", note || "");
  db.prepare("UPDATE appointments SET status='Завершён' WHERE id=?")
    .run(req.params.id);
  res.json({ ok: true });
});

app.post("/api/lab-orders", async (req, res) => {
  const { petId, test } = req.body;
  const created_at = nowMoscow();
  const info = db.prepare(
    "INSERT INTO lab_orders (pet_id,test,created_at) VALUES (?,?,?)"
  ).run(petId, test, created_at);

  try {
    await publish(TOPICS.LAB_ORDER_CREATED, {
      orderId: info.lastInsertRowid,
      petId,
      test,
    });
  } catch (e) {
    console.error("publish lab.order.created:", e.message);
  }

  res.json({ ok: true, id: info.lastInsertRowid });
});

app.get("/api/lab-orders", (req, res) => {
  res.json(db.prepare("SELECT * FROM lab_orders ORDER BY id DESC").all());
});

app.delete("/api/lab-orders/:id", (req, res) => {
  db.prepare("DELETE FROM lab_orders WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

// ===== Админка =====

app.post("/api/vets", async (req, res) => {
  const { name, spec } = req.body;
  if (!name || !spec) return res.status(400).json({ error: "Имя и специализация обязательны" });
  const info = db.prepare("INSERT INTO vets (name, spec) VALUES (?, ?)").run(name, spec);
  res.json({ ok: true, id: info.lastInsertRowid });
});

app.put("/api/vets/:id", async (req, res) => {
  const { name, spec } = req.body;
  db.prepare("UPDATE vets SET name=?, spec=? WHERE id=?").run(name, spec, req.params.id);
  await invalidate(`schedule:${req.params.id}`);
  res.json({ ok: true });
});

app.delete("/api/vets/:id", (req, res) => {
  const apptsCount = db.prepare("SELECT COUNT(*) AS c FROM appointments WHERE vet_id=?")
    .get(req.params.id).c;
  if (apptsCount > 0) {
    return res.status(400).json({
      error: `Нельзя удалить врача: у него ${apptsCount} запис(ей). Сначала удалите записи.`,
    });
  }
  db.prepare("DELETE FROM vets WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

app.get("/api/all-pets", (req, res) => {
  const pets = db.prepare(`
    SELECT p.*, o.name AS owner_name
    FROM pets p LEFT JOIN owners o ON o.id = p.owner_id
    ORDER BY p.id DESC
  `).all();
  res.json(pets);
});

app.put("/api/pets/:id", (req, res) => {
  const { name, species, breed, age } = req.body;
  db.prepare("UPDATE pets SET name=?, species=?, breed=?, age=? WHERE id=?")
    .run(name, species, breed || "", Number(age) || 0, req.params.id);
  res.json({ ok: true });
});

// Каскад управляем через query: админка по умолчанию защищена от случайного
// удаления питомца с записями, владелец передаёт ?cascade=true и удаляет всё
app.delete("/api/pets/:id", async (req, res) => {
  const cascade = req.query.cascade === "true";
  const petId = req.params.id;

  const appts = db.prepare("SELECT vet_id FROM appointments WHERE pet_id=?").all(petId);

  if (appts.length > 0 && !cascade) {
    return res.status(400).json({
      error: `Нельзя удалить питомца: у него ${appts.length} запис(ей).`,
    });
  }

  if (cascade && appts.length > 0) {
    db.prepare("DELETE FROM appointments WHERE pet_id=?").run(petId);
    const vetIds = [...new Set(appts.map((a) => a.vet_id))];
    for (const vid of vetIds) await invalidate(`schedule:${vid}`);
  }

  db.prepare("DELETE FROM medical_records WHERE pet_id=?").run(petId);
  db.prepare("DELETE FROM vaccinations WHERE pet_id=?").run(petId);
  db.prepare("DELETE FROM lab_orders WHERE pet_id=?").run(petId);
  db.prepare("DELETE FROM pets WHERE id=?").run(petId);
  res.json({ ok: true });
});

app.put("/api/appointments/:id", async (req, res) => {
  const { slot, status } = req.body;
  const old = db.prepare("SELECT vet_id FROM appointments WHERE id=?").get(req.params.id);
  db.prepare("UPDATE appointments SET slot=?, status=? WHERE id=?")
    .run(slot, status, req.params.id);
  if (old) await invalidate(`schedule:${old.vet_id}`);
  res.json({ ok: true });
});

app.delete("/api/appointments/:id", async (req, res) => {
  const old = db.prepare("SELECT vet_id FROM appointments WHERE id=?").get(req.params.id);
  db.prepare("DELETE FROM appointments WHERE id=?").run(req.params.id);
  if (old) await invalidate(`schedule:${old.vet_id}`);
  res.json({ ok: true });
});

app.get("/api/records/:petId", (req, res) => {
  const rows = db.prepare(
    "SELECT id, date, type, note FROM medical_records WHERE pet_id=? ORDER BY id DESC"
  ).all(req.params.petId);
  res.json(rows);
});

app.post("/api/records", (req, res) => {
  const { petId, date, type, note } = req.body;
  if (!petId || !type) return res.status(400).json({ error: "Питомец и тип записи обязательны" });
  const info = db.prepare(
    "INSERT INTO medical_records (pet_id,date,type,note) VALUES (?,?,?,?)"
  ).run(petId, date || dateMoscow(), type, note || "");
  res.json({ ok: true, id: info.lastInsertRowid });
});

app.put("/api/records/:id", (req, res) => {
  const { date, type, note } = req.body;
  db.prepare("UPDATE medical_records SET date=?, type=?, note=? WHERE id=?")
    .run(date, type, note || "", req.params.id);
  res.json({ ok: true });
});

app.delete("/api/records/:id", (req, res) => {
  db.prepare("DELETE FROM medical_records WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

app.get("/api/monitor", (req, res) => {
  const total = stats.hits + stats.misses;
  res.json({
    events: eventLog,
    kafka: {
      ready: kafkaStatus.ready,
      lastError: kafkaStatus.lastError,
    },
    cache: {
      hits: stats.hits,
      misses: stats.misses,
      hitRate: total ? Math.round((stats.hits / total) * 100) : 0,
    },
  });
});

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

async function handleEvent(topic, payload) {
  // Имитация работы лаборатории: 4 секунды и публикуем готовый результат
  if (topic === TOPICS.LAB_ORDER_CREATED) {
    setTimeout(async () => {
      const results = {
        "Общий анализ крови": "Лейкоциты 8.2 · Гемоглобин 135 · Норма",
        "Биохимия": "АЛТ 42 · Креатинин 1.1 · Незначительные отклонения",
        "Анализ мочи": "Белок отр. · pH 6.5 · Норма",
      };
      try {
        await publish(TOPICS.LAB_RESULT_READY, {
          orderId: payload.orderId,
          petId: payload.petId,
          test: payload.test,
          result: results[payload.test] || "Результаты в пределах нормы",
        });
      } catch (e) {
        console.error("publish lab.result.ready:", e.message);
      }
    }, 4000);
  }

  if (topic === TOPICS.LAB_RESULT_READY) {
    db.prepare("INSERT INTO medical_records (pet_id,date,type,note) VALUES (?,?,?,?)")
      .run(
        payload.petId,
        dateMoscow(),
        "Лаборатория: " + payload.test,
        payload.result
      );
    db.prepare("UPDATE lab_orders SET status='Готов', result=? WHERE id=?")
      .run(payload.result, payload.orderId);
  }
}

const PORT = process.env.PORT || 4000;

initKafka(handleEvent)
  .then(() => {
    app.listen(PORT, () => console.log(`[server] порт ${PORT}`));
  })
  .catch((e) => {
    console.error("[server] Kafka init:", e.message);
    app.listen(PORT, () => console.log(`[server] порт ${PORT} (без Kafka)`));
  });
