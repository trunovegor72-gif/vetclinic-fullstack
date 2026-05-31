import { useState, useEffect } from "react";
import { api } from "../../api.js";

const TOPIC_RU = {
  "appointment.created": "Запись на приём создана",
  "lab.order.created":   "Назначен анализ",
  "lab.result.ready":    "Результаты анализа готовы",
};

function describePayload(topic, p) {
  if (!p) return "";
  if (topic === "appointment.created")
    return `Питомец: ${p.petName}, врач: ${p.vetName}, время: ${p.slot}`;
  if (topic === "lab.order.created")
    return `Заказ №${p.orderId}, анализ: «${p.test}»`;
  if (topic === "lab.result.ready")
    return `Заказ №${p.orderId}, анализ: «${p.test}», результат: ${p.result}`;
  return JSON.stringify(p);
}

export default function MonitorTab() {
  const [data, setData] = useState({
    events: [],
    cache: { hits: 0, misses: 0, hitRate: 0 },
    kafka: { ready: false, lastError: null },
  });

  useEffect(() => {
    const load = () => api("/monitor").then(setData);
    load();
    const t = setInterval(load, 1500);
    return () => clearInterval(t);
  }, []);

  return (
    <>
      <h2 className="h2">Мониторинг системы</h2>

      <div className="status-bar">
        <span className={data.kafka.ready ? "status-ok" : "status-err"}>
          ● Kafka: {data.kafka.ready ? "подключена" : "не готова"}
        </span>
        {data.kafka.lastError && (
          <span className="status-err"> · последняя ошибка: {data.kafka.lastError}</span>
        )}
      </div>

      <div className="metric-row">
        <Metric value={data.events.length} label="Событий в журнале Kafka" />
        <Metric value={data.cache.hits} label="Попаданий в кэш Redis" />
        <Metric value={data.cache.misses} label="Промахов кэша Redis" />
        <Metric value={`${data.cache.hitRate}%`} label="Эффективность кэша" />
      </div>

      <h3 className="h3">Поток событий Kafka</h3>
      <div className="card">
        {data.events.length === 0 && (
          <p className="muted">
            Событий пока нет. Создайте запись на приём или назначьте анализ.
          </p>
        )}
        {data.events.map((e) => (
          <div key={e.id} className="event-row">
            <span className="muted">{e.ts}</span>
            <span className="topic-tag" title={e.topic}>
              {TOPIC_RU[e.topic] || e.topic}
            </span>
            <span className="event-payload">{describePayload(e.topic, e.payload)}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function Metric({ value, label }) {
  return (
    <div className="metric">
      <div className="metric-val">{value}</div>
      <div className="metric-lab">{label}</div>
    </div>
  );
}
