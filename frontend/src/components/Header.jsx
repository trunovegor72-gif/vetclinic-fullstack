const TITLES = {
  owner: "Кабинет владельца",
  vet: "Панель ветеринара",
  admin: "Мониторинг системы",
};

export default function Header({ role, onLogout }) {
  return (
    <header className="header">
      <div className="logo">
        <span className="logo-mark">+</span>
        <div>
          <div className="logo-title">ВетКлиника</div>
          <div className="logo-sub">Информационная система</div>
        </div>
      </div>
      {role && (
        <div className="header-right">
          <span className="role-badge">{TITLES[role]}</span>
          <button className="btn-ghost" onClick={onLogout}>Выйти</button>
        </div>
      )}
    </header>
  );
}
