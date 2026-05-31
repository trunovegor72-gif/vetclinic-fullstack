export default function MedicalRecord({ pet, showLabs = false, compact = false, onDeleteRecord, onDeleteLab }) {
  if (!pet) return null;

  return (
    <>
      {!compact && (
        <div className="pet-head">
          <h2 className="h2">{pet.name}</h2>
          <span className="tag">{pet.species} · {pet.breed} · {pet.age} г.</span>
        </div>
      )}

      <h3 className="h3">История приёмов и записей</h3>
      {(!pet.records || pet.records.length === 0) && (
        <p className="muted">Записей пока нет.</p>
      )}
      {pet.records?.map((r, i) => (
        <div key={r.id || i} className="record-row">
          <span className="record-date">{r.date}</span>
          <span className="record-type">{r.type}</span>
          <span style={{ flex: 1 }}>{r.note}</span>
          {onDeleteRecord && r.id && (
            <button className="btn-danger" onClick={() => onDeleteRecord(r.id)}>Удалить</button>
          )}
        </div>
      ))}

      <h3 className="h3">Вакцинации</h3>
      {(!pet.vaccinations || pet.vaccinations.length === 0) && (
        <p className="muted">Нет данных о вакцинациях.</p>
      )}
      {pet.vaccinations?.map((v, i) => (
        <div key={i} className="record-row">
          <span className="record-type">{v.name}</span>
          <span>сделана: {v.date}</span>
          <span className="muted">следующая: {v.next}</span>
        </div>
      ))}

      {showLabs && (
        <>
          <h3 className="h3">Назначенные анализы</h3>
          {(!pet.labOrders || pet.labOrders.length === 0) && (
            <p className="muted">Анализы не назначались.</p>
          )}
          {pet.labOrders?.map((o) => (
            <div key={o.id} className="lab-row">
              <span>{o.test}</span>
              <span className="action-buttons">
                <span className={o.status === "Готов" ? "cache-hit" : "muted"}>{o.status}</span>
                {onDeleteLab && (
                  <button className="btn-danger" onClick={() => onDeleteLab(o.id)}>Удалить</button>
                )}
              </span>
            </div>
          ))}
        </>
      )}
    </>
  );
}
