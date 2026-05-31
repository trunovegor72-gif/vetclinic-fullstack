import { useState, useEffect } from "react";
import { api } from "../api.js";
import MedicalRecord from "./MedicalRecord.jsx";

export default function OwnerCabinet() {
  const [tab, setTab] = useState("book");
  const tabs = [
    ["book", "Запись на приём"],
    ["pets", "Мои питомцы"],
    ["appts", "Мои записи"],
  ];
  return (
    <div className="container">
      <div className="tabs">
        {tabs.map(([k, label]) => (
          <button
            key={k}
            className={tab === k ? "tab active" : "tab"}
            onClick={() => setTab(k)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "book" && <BookingForm />}
      {tab === "pets" && <PetList />}
      {tab === "appts" && <MyAppointments />}
    </div>
  );
}

function BookingForm() {
  const [vets, setVets] = useState([]);
  const [pets, setPets] = useState([]);
  const [vetId, setVetId] = useState("");
  const [petId, setPetId] = useState("");
  const [slot, setSlot] = useState("");
  const [schedule, setSchedule] = useState(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api("/vets").then((v) => { setVets(v); if (v[0]) setVetId(String(v[0].id)); });
    api("/pets").then((p) => { setPets(p); if (p[0]) setPetId(String(p[0].id)); });
  }, []);

  function loadSchedule(vid) {
    if (!vid) return;
    api(`/schedule/${vid}`).then(setSchedule);
  }
  useEffect(() => { loadSchedule(vetId); }, [vetId]);

  async function submit() {
    if (!petId || !slot) { setMsg("Выберите питомца и время."); return; }
    const r = await api("/appointments", {
      method: "POST",
      body: JSON.stringify({ vetId: Number(vetId), petId: Number(petId), slot }),
    });
    if (r.ok) {
      const pet = pets.find((p) => p.id === Number(petId));
      const vet = vets.find((v) => v.id === Number(vetId));
      setMsg(`Запись создана: ${pet.name} → ${vet.name}, ${slot}. Событие отправлено в Kafka.`);
      setSlot("");
      loadSchedule(vetId);
    }
  }

  return (
    <div className="card">
      <h2 className="h2">Онлайн-запись на приём</h2>
      <div className="form-row">
        <label className="label">Питомец
          <select className="input" value={petId} onChange={(e) => setPetId(e.target.value)}>
            {pets.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.species})</option>)}
          </select>
        </label>
        <label className="label">Врач
          <select className="input" value={vetId} onChange={(e) => setVetId(e.target.value)}>
            {vets.map((v) => <option key={v.id} value={v.id}>{v.name} — {v.spec}</option>)}
          </select>
        </label>
      </div>

      <div className="grid-head">
        <span>Сетка приёма врача</span>
        {schedule && (
          <span className={schedule.fromCache ? "cache-hit" : "cache-miss"}>
            {schedule.fromCache
              ? `● из кэша Redis (TTL ~${schedule.ttl}c)`
              : "● рассчитано и закэшировано в Redis"}
          </span>
        )}
      </div>
      <div className="slot-grid">
        {(schedule?.grid || []).map((g) => {
          const cls = "slot" + (!g.free ? " busy" : "") + (slot === g.slot ? " selected" : "");
          return (
            <button
              key={g.slot}
              className={cls}
              disabled={!g.free}
              onClick={() => setSlot(g.slot)}
            >
              {g.slot}
              <span className="slot-state">{g.free ? "свободно" : "занято"}</span>
            </button>
          );
        })}
      </div>

      <button className="btn-primary" onClick={submit}>Записаться</button>
      {msg && <div className="note">{msg}</div>}
    </div>
  );
}

function PetList() {
  const [pets, setPets] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [delErr, setDelErr] = useState("");

  const loadPets = () => api("/pets").then(setPets);
  useEffect(() => {
    loadPets();
    const t = setInterval(loadPets, 3000); // подтягиваем новые записи медкарты
    return () => clearInterval(t);
  }, []);

  async function deletePet(pet) {
    if (!confirm(`Удалить питомца «${pet.name}»? Все записи на приём, медкарта, вакцинации и анализы будут удалены.`)) return;
    const r = await api(`/pets/${pet.id}?cascade=true`, { method: "DELETE" });
    if (r.ok) {
      setDelErr("");
      loadPets();
    } else {
      setDelErr(r.error || "Не удалось удалить питомца");
    }
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="pet-head">
          <h2 className="h2">Мои питомцы</h2>
          <button
            className="btn-secondary"
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? "Отмена" : "+ Добавить питомца"}
          </button>
        </div>
        {showForm && (
          <AddPetForm
            onAdded={() => { setShowForm(false); loadPets(); }}
          />
        )}
        {delErr && <div className="err-note">{delErr}</div>}
      </div>

      {pets.map((p) => (
        <div key={p.id} className="card">
          <div className="pet-head">
            <div>
              <h2 className="h2" style={{ margin: 0 }}>{p.name}</h2>
              <span className="tag">{p.species} · {p.breed} · {p.age} г.</span>
            </div>
            <button className="btn-danger" onClick={() => deletePet(p)}>
              Удалить питомца
            </button>
          </div>
          <MedicalRecord pet={p} compact={true} />
        </div>
      ))}
    </div>
  );
}

function AddPetForm({ onAdded }) {
  const [name, setName] = useState("");
  const [species, setSpecies] = useState("Кошка");
  const [customSpecies, setCustomSpecies] = useState("");
  const [breed, setBreed] = useState("");
  const [age, setAge] = useState("");
  const [err, setErr] = useState("");

  const isCustom = species === "Другое";
  const finalSpecies = isCustom ? customSpecies.trim() : species;

  async function submit() {
    if (!name.trim()) { setErr("Введите имя питомца."); return; }
    if (isCustom && !customSpecies.trim()) {
      setErr("Укажите тип питомца."); return;
    }
    const r = await api("/pets", {
      method: "POST",
      body: JSON.stringify({ name, species: finalSpecies, breed, age }),
    });
    if (r.ok) {
      setName(""); setBreed(""); setAge(""); setCustomSpecies(""); setErr("");
      onAdded();
    } else {
      setErr(r.error || "Не удалось добавить питомца");
    }
  }

  return (
    <div>
      <h3 className="h3">Регистрация питомца</h3>
      <div className="form-row">
        <label className="label">Имя
          <input
            className="input"
            placeholder="Имя питомца"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="label">Вид
          <select
            className="input"
            value={species}
            onChange={(e) => setSpecies(e.target.value)}
          >
            <option>Кошка</option>
            <option>Собака</option>
            <option>Птица</option>
            <option>Грызун</option>
            <option>Рептилия</option>
            <option>Рыбка</option>
            <option>Другое</option>
          </select>
        </label>
      </div>
      {isCustom && (
        <div className="form-row">
          <label className="label">Свой тип питомца
            <input
              className="input"
              placeholder="Введите тип питомца"
              value={customSpecies}
              onChange={(e) => setCustomSpecies(e.target.value)}
              autoFocus
            />
          </label>
        </div>
      )}
      <div className="form-row">
        <label className="label">Порода
          <input
            className="input"
            placeholder="Порода"
            value={breed}
            onChange={(e) => setBreed(e.target.value)}
          />
        </label>
        <label className="label">Возраст (лет)
          <input
            className="input"
            type="number"
            min="0"
            max="40"
            value={age}
            onChange={(e) => setAge(e.target.value)}
          />
        </label>
      </div>
      <button className="btn-primary" onClick={submit}>Зарегистрировать</button>
      {err && <div className="note" style={{ background: "#fbe9e9", color: "#b04444" }}>{err}</div>}
    </div>
  );
}

function MyAppointments() {
  const [appts, setAppts] = useState([]);
  const loadAppts = () => api("/appointments").then(setAppts);
  useEffect(() => {
    loadAppts();
    const t = setInterval(loadAppts, 3000);
    return () => clearInterval(t);
  }, []);

  async function cancelAppt(a) {
    if (!confirm(`Отменить запись «${a.petName} → ${a.vetName}, ${a.slot}»?`)) return;
    const r = await api(`/appointments/${a.id}`, { method: "DELETE" });
    if (r.ok) loadAppts();
  }

  if (appts.length === 0)
    return (
      <div className="card">
        <p className="muted">Записей нет. Создайте запись на вкладке «Запись на приём».</p>
      </div>
    );

  return (
    <div className="stack">
      {appts.map((a) => (
        <div key={a.id} className="card">
          <div className="appt-row">
            <div>
              <div className="appt-title">{a.petName} → {a.vetName}</div>
              <div className="muted">Время: {a.slot} · создано {a.created_at}</div>
            </div>
            <div className="action-buttons">
              <span className="status-tag">{a.status}</span>
              {a.status === "Запланирован" && (
                <button className="btn-danger" onClick={() => cancelAppt(a)}>
                  Отменить
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
