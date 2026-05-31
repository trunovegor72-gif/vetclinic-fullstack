import { useState, useEffect } from "react";
import { api } from "../../api.js";

const SLOTS = ["09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00"];
const STATUSES = ["Запланирован", "Завершён", "Отменён"];

export default function AppointmentsAdmin() {
  const [appts, setAppts] = useState([]);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ slot: "", status: "Запланирован" });

  const load = () => api("/appointments").then(setAppts);
  useEffect(() => { load(); }, []);

  function startEdit(a) {
    setEditId(a.id);
    setForm({ slot: a.slot, status: a.status });
  }

  async function save() {
    const r = await api(`/appointments/${editId}`, {
      method: "PUT",
      body: JSON.stringify(form),
    });
    if (r.ok) { setEditId(null); load(); }
  }

  async function remove(id) {
    if (!confirm("Удалить запись?")) return;
    const r = await api(`/appointments/${id}`, { method: "DELETE" });
    if (r.ok) load();
  }

  return (
    <>
      <div className="card">
        <h2 className="h2">Управление записями на приём</h2>
        <p className="muted">Всего записей: {appts.length}</p>
      </div>

      {appts.length === 0 && (
        <div className="card"><p className="muted">Записей пока нет.</p></div>
      )}

      {appts.map((a) => (
        <div key={a.id} className="card">
          {editId === a.id ? (
            <div>
              <h3 className="h3">Редактирование записи #{a.id}</h3>
              <div className="muted" style={{ marginBottom: 12 }}>
                {a.petName} → {a.vetName}
              </div>
              <div className="form-row">
                <label className="label">Время
                  <select className="input" value={form.slot}
                    onChange={(e) => setForm({ ...form, slot: e.target.value })}>
                    {SLOTS.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </label>
                <label className="label">Статус
                  <select className="input" value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    {STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </label>
              </div>
              <div className="action-buttons">
                <button className="btn-primary" onClick={save}>Сохранить</button>
                <button className="btn-ghost" onClick={() => setEditId(null)}>Отмена</button>
              </div>
            </div>
          ) : (
            <div className="appt-row">
              <div>
                <div className="appt-title">{a.petName} → {a.vetName}</div>
                <div className="muted">
                  Время: {a.slot} · создано: {a.created_at}
                </div>
              </div>
              <div className="action-buttons">
                <span className="status-tag">{a.status}</span>
                <button className="btn-ghost" onClick={() => startEdit(a)}>Изменить</button>
                <button className="btn-danger" onClick={() => remove(a.id)}>Удалить</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </>
  );
}
