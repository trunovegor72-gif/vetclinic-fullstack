import { useState, useEffect } from "react";
import { api } from "../api.js";
import MedicalRecord from "./MedicalRecord.jsx";

export default function VetPanel() {
  const [appts, setAppts] = useState([]);
  useEffect(() => {
    const load = () => api("/appointments").then(setAppts);
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="container">
      <h2 className="h2">Расписание приёма</h2>
      {appts.length === 0 && (
        <div className="card"><p className="muted">Записей пока нет.</p></div>
      )}
      <div className="stack">
        {appts.map((a) => <AppointmentCard key={a.id} appt={a} />)}
      </div>
    </div>
  );
}

function AppointmentCard({ appt }) {
  const [note, setNote] = useState("");
  const [test, setTest] = useState("Общий анализ крови");
  const [done, setDone] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [petCard, setPetCard] = useState(null);

  function loadCard() {
    api(`/pets/${appt.petId}`).then(setPetCard);
  }
  useEffect(() => {
    if (!showHistory) return;
    loadCard();
    const t = setInterval(loadCard, 3000);
    return () => clearInterval(t);
  }, [showHistory, appt.petId]);

  async function addRecord() {
    if (!note.trim()) return;
    await api(`/appointments/${appt.id}/complete`, {
      method: "POST",
      body: JSON.stringify({ note, petId: appt.petId }),
    });
    setNote("");
    setDone(true);
    if (showHistory) loadCard(); // сразу обновим карту, если она открыта
  }

  async function orderLab() {
    await api("/lab-orders", {
      method: "POST",
      body: JSON.stringify({ petId: appt.petId, test }),
    });
    if (showHistory) loadCard();
  }

  async function deleteRecord(id) {
    if (!confirm("Удалить запись из медкарты?")) return;
    await api(`/records/${id}`, { method: "DELETE" });
    loadCard();
  }

  async function deleteLab(id) {
    if (!confirm("Удалить заказ анализа?")) return;
    await api(`/lab-orders/${id}`, { method: "DELETE" });
    loadCard();
  }

  return (
    <div className="card">
      <div className="appt-row">
        <div>
          <div className="appt-title">{appt.petName} ({appt.species})</div>
          <div className="muted">{appt.vetName} · {appt.slot} · {appt.created_at}</div>
        </div>
        <span className="status-tag">{appt.status}</span>
      </div>

      <div style={{ marginTop: 12 }}>
        <button
          className="btn-ghost"
          onClick={() => setShowHistory((v) => !v)}
        >
          {showHistory ? "Скрыть медкарту" : "Показать медкарту"}
        </button>
      </div>

      {showHistory && (
        <div className="history-block">
          {petCard
            ? <MedicalRecord pet={petCard} showLabs={true} compact={true}
                onDeleteRecord={deleteRecord} onDeleteLab={deleteLab} />
            : <p className="muted">Загрузка карты…</p>}
        </div>
      )}

      <h3 className="h3">Запись в медкарту</h3>
      <textarea
        className="textarea"
        placeholder="Диагноз, назначения, рекомендации…"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <button className="btn-primary" onClick={addRecord}>Сохранить в медкарту</button>
      {done && <span className="ok-inline">✓ Запись добавлена в карту</span>}

      <h3 className="h3">Назначить анализ (интеграция с лабораторией)</h3>
      <div className="form-row">
        <select className="input" value={test} onChange={(e) => setTest(e.target.value)}>
          <option>Общий анализ крови</option>
          <option>Биохимия</option>
          <option>Анализ мочи</option>
        </select>
        <button className="btn-secondary" onClick={orderLab}>Отправить в лабораторию</button>
      </div>
    </div>
  );
}
