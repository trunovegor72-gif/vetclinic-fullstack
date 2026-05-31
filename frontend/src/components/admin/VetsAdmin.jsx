import { useState, useEffect } from "react";
import { api } from "../../api.js";

export default function VetsAdmin() {
  const [vets, setVets] = useState([]);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: "", spec: "Терапевт" });
  const [err, setErr] = useState("");

  const load = () => api("/vets").then(setVets);
  useEffect(() => { load(); }, []);

  function startEdit(v) {
    setEditId(v.id);
    setForm({ name: v.name, spec: v.spec });
    setErr("");
  }

  function startAdd() {
    setEditId("new");
    setForm({ name: "", spec: "Терапевт" });
    setErr("");
  }

  function cancel() {
    setEditId(null);
    setErr("");
  }

  async function save() {
    if (!form.name.trim() || !form.spec.trim()) {
      setErr("Заполните имя и специализацию.");
      return;
    }
    const path = editId === "new" ? "/vets" : `/vets/${editId}`;
    const method = editId === "new" ? "POST" : "PUT";
    const r = await api(path, { method, body: JSON.stringify(form) });
    if (r.ok) { setEditId(null); load(); }
    else setErr(r.error || "Ошибка сохранения");
  }

  async function remove(id) {
    if (!confirm("Удалить врача?")) return;
    const r = await api(`/vets/${id}`, { method: "DELETE" });
    if (r.ok) load();
    else alert(r.error || "Не удалось удалить");
  }

  return (
    <>
      <div className="card">
        <div className="pet-head">
          <h2 className="h2">Управление врачами</h2>
          {editId !== "new" && (
            <button className="btn-secondary" onClick={startAdd}>+ Добавить врача</button>
          )}
        </div>

        {editId === "new" && (
          <EditForm form={form} setForm={setForm} onSave={save} onCancel={cancel} err={err} />
        )}
      </div>

      {vets.map((v) => (
        <div key={v.id} className="card">
          {editId === v.id ? (
            <EditForm form={form} setForm={setForm} onSave={save} onCancel={cancel} err={err} />
          ) : (
            <div className="appt-row">
              <div>
                <div className="appt-title">{v.name}</div>
                <div className="muted">Специализация: {v.spec}</div>
              </div>
              <div className="action-buttons">
                <button className="btn-ghost" onClick={() => startEdit(v)}>Изменить</button>
                <button className="btn-danger" onClick={() => remove(v.id)}>Удалить</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </>
  );
}

function EditForm({ form, setForm, onSave, onCancel, err }) {
  return (
    <div>
      <h3 className="h3">Данные врача</h3>
      <div className="form-row">
        <label className="label">ФИО
          <input className="input" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Например, Сидоров П. И." />
        </label>
        <label className="label">Специализация
          <select className="input" value={form.spec}
            onChange={(e) => setForm({ ...form, spec: e.target.value })}>
            <option>Терапевт</option>
            <option>Хирург</option>
            <option>Дерматолог</option>
            <option>Стоматолог</option>
            <option>Офтальмолог</option>
            <option>Кардиолог</option>
          </select>
        </label>
      </div>
      <div className="action-buttons">
        <button className="btn-primary" onClick={onSave}>Сохранить</button>
        <button className="btn-ghost" onClick={onCancel}>Отмена</button>
      </div>
      {err && <div className="err-note">{err}</div>}
    </div>
  );
}
