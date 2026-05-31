import { useState, useEffect } from "react";
import { api } from "../../api.js";

export default function PetsAdmin() {
  const [pets, setPets] = useState([]);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: "", species: "", breed: "", age: 0 });
  const [err, setErr] = useState("");

  const load = () => api("/all-pets").then(setPets);
  useEffect(() => { load(); }, []);

  function startEdit(p) {
    setEditId(p.id);
    setForm({ name: p.name, species: p.species, breed: p.breed || "", age: p.age || 0 });
    setErr("");
  }

  async function save() {
    if (!form.name.trim() || !form.species.trim()) {
      setErr("Имя и вид обязательны.");
      return;
    }
    const r = await api(`/pets/${editId}`, {
      method: "PUT",
      body: JSON.stringify(form),
    });
    if (r.ok) { setEditId(null); load(); }
    else setErr(r.error || "Ошибка");
  }

  async function remove(id) {
    if (!confirm("Удалить питомца и всю его медкарту?")) return;
    let r = await api(`/pets/${id}`, { method: "DELETE" });
    if (!r.ok && r.error && r.error.includes("запис")) {
      if (confirm(`${r.error}\n\nУдалить вместе с записями?`)) {
        r = await api(`/pets/${id}?cascade=true`, { method: "DELETE" });
      } else return;
    }
    if (r.ok) load();
    else alert(r.error || "Не удалось удалить");
  }

  return (
    <>
      <div className="card">
        <h2 className="h2">Управление питомцами</h2>
        <p className="muted">Всего в системе: {pets.length}</p>
      </div>

      {pets.map((p) => (
        <div key={p.id} className="card">
          {editId === p.id ? (
            <div>
              <h3 className="h3">Редактирование питомца #{p.id}</h3>
              <div className="form-row">
                <label className="label">Имя
                  <input className="input" value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </label>
                <label className="label">Вид
                  <input className="input" value={form.species}
                    onChange={(e) => setForm({ ...form, species: e.target.value })} />
                </label>
              </div>
              <div className="form-row">
                <label className="label">Порода
                  <input className="input" value={form.breed}
                    onChange={(e) => setForm({ ...form, breed: e.target.value })} />
                </label>
                <label className="label">Возраст
                  <input className="input" type="number" min="0" max="40" value={form.age}
                    onChange={(e) => setForm({ ...form, age: e.target.value })} />
                </label>
              </div>
              <div className="action-buttons">
                <button className="btn-primary" onClick={save}>Сохранить</button>
                <button className="btn-ghost" onClick={() => setEditId(null)}>Отмена</button>
              </div>
              {err && <div className="err-note">{err}</div>}
            </div>
          ) : (
            <div className="appt-row">
              <div>
                <div className="appt-title">{p.name}</div>
                <div className="muted">
                  {p.species} · {p.breed || "—"} · {p.age || "—"} г. · владелец: {p.owner_name || "—"}
                </div>
              </div>
              <div className="action-buttons">
                <button className="btn-ghost" onClick={() => startEdit(p)}>Изменить</button>
                <button className="btn-danger" onClick={() => remove(p.id)}>Удалить</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </>
  );
}
