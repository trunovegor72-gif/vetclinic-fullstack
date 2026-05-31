import { useState } from "react";
import "./styles.css";
import Header from "./components/Header.jsx";
import RolePicker from "./components/RolePicker.jsx";
import OwnerCabinet from "./components/OwnerCabinet.jsx";
import VetPanel from "./components/VetPanel.jsx";
import AdminPanel from "./components/AdminPanel.jsx";

export default function App() {
  const [role, setRole] = useState(null);

  return (
    <div className="app">
      <Header role={role} onLogout={() => setRole(null)} />

      {!role && <RolePicker onPick={setRole} />}
      {role === "owner" && <OwnerCabinet />}
      {role === "vet" && <VetPanel />}
      {role === "admin" && <AdminPanel />}

      <footer className="footer">
        Курсовая работа. Информационная система ветеринарной клиники
      </footer>
    </div>
  );
}
