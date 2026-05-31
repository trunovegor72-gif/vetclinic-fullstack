import { useState, useEffect } from "react";
import { api } from "../../api.js";

export default function RecordsAdmin() {
  const [pets, setPets] = useState([]);
  const [petId, setPetId] = useState("");
  const [records, setRecords] = useState([]);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ date: "", type: "", note: "" });
  const [err, setErr] = useState("");

  useEffect(() => {
    api("/all-pets").then((p) => {
      setPets(p);
      if (p[0]) setPetId(String(p[0].id));
    });
  }, []);

  const loadRecords = () => {
    if (!petId) return;
    api(`/records/${petId}`).then(setRecords);
  };
  useEffect(() => { loadRecords(); }, [petId]);

  function startAdd() {
    setEditId("new");
    setForm({
      date: new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow" }).format(new Date()),
      type: "Осмотр",
      note: "",
    });
    setErr("");
  }

  function startEdit(r) {
    setEditId(r.id);
    setForm({ date: r.date, type: r.type, note: r.note || "" });
    setErr("");
  }

  async function save() {
    if (!form.type.trim()) {
      setErr("Укажите тип записи.");
      return;
    }
    let r;
    if (editId === "new") {
      r = await api("/records", {
        method: "POST",
        body: JSON.stringify({ petId: Number(petId), ...form }),
      });
    } else {
      r = await api(`/records/${editId}`, {
        method: "PUT",
        body: JSON.stringify(form),
      });
    }
    if (r.ok) { setEditId(null); loadRecords(); }
    else setErr(r.error || "Ошибка");
  }

  async function remove(id) {
    if (!confirm("Удалить запись из медкарты?")) return;
    const r = await api(`/records/${id}`, { method: "DELETE" });
    if (r.ok) loadRecords();
  }

  const selectedPet = pets.find((p) => p.id === Number(petId));

  return (
    <>
      <div className="card">
        <h2 className="h2">Управление медкартами</h2>
        <div className="form-row">
          <label className="label">Питомец
            <select className="input" value={petId} onChange={(e) => setPetId(e.target.value)}>
              {pets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.species}) — владелец: {p.owner_name || "—"}
                </option>
              ))}
            </select>
          </label>
        </div>
        {editId !== "new" && (
          <button className="btn-secondary" onClick={startAdd}>+ Добавить запись в карту</button>
        )}
      </div>

      {editId === "new" && (
        <div className="card">
          <RecordForm form={form} setForm={setForm} onSave={save}
            onCancel={() => setEditId(null)} err={err} />
        </div>
      )}

      {selectedPet && (
        <div className="card">
          <h3 className="h3">Медкарта: {selectedPet.name}</h3>
          {records.length === 0 && <p className="muted">Записей в медкарте нет.</p>}
          {records.map((r) =>
            editId === r.id ? (
              <RecordForm key={r.id} form={form} setForm={setForm} onSave={save}
                onCancel={() => setEditId(null)} err={err} />
            ) : (
              <div key={r.id} className="record-row">
                <span className="record-date">{r.date}</span>
                <span className="record-type">{r.type}</span>
                <span style={{ flex: 1 }}>{r.note}</span>
                <span className="action-buttons">
                  <button className="btn-ghost" onClick={() => startEdit(r)}>Изменить</button>
                  <button className="btn-danger" onClick={() => remove(r.id)}>Удалить</button>
                </span>
              </div>
            )
          )}
        </div>
      )}
    </>
  );
}

function RecordForm({ form, setForm, onSave, onCancel, err }) {
  return (
    <div>
      <h3 className="h3">Запись в медкарту</h3>
      <div className="form-row">
        <label className="label">Дата
          <input className="input" type="date" value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </label>
        <label className="label">Тип
          <select className="input" value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option>Осмотр</option>
            <option>Приём</option>
            <option>Вакцинация</option>
            <option>Лаборатория</option>
            <option>Операция</option>
          </select>
        </label>
      </div>
      <label className="label">Описание
        <textarea className="textarea" value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
          placeholder="Диагноз, назначения, рекомендации…" />
      </label>
      <div className="action-buttons" style={{ marginTop: 12 }}>
        <button className="btn-primary" onClick={onSave}>Сохранить</button>
        <button className="btn-ghost" onClick={onCancel}>Отмена</button>
      </div>
      {err && <div className="err-note">{err}</div>}
    </div>
  );
}
