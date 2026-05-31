const CARDS = [
  { id: "owner", t: "Владелец питомца", d: "Запись на приём, медкарты, вакцинации, результаты анализов" },
  { id: "vet", t: "Ветеринар", d: "Расписание приёма, ведение медкарт, назначение анализов" },
  { id: "admin", t: "Администратор", d: "Управление врачами, питомцами, записями, медкартами и мониторинг" },
];

export default function RolePicker({ onPick }) {
  return (
    <div className="container">
      <h1 className="h1">Вход в систему</h1>
      <p className="lead">Выберите роль для демонстрации работы системы.</p>
      <div className="role-grid">
        {CARDS.map((c) => (
          <button key={c.id} className="role-card" onClick={() => onPick(c.id)}>
            <div className="role-card-title">{c.t}</div>
            <div className="role-card-desc">{c.d}</div>
            <span className="role-card-arrow">Войти →</span>
          </button>
        ))}
      </div>
    </div>
  );
}
