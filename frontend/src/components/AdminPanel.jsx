import { useState } from "react";
import VetsAdmin from "./admin/VetsAdmin.jsx";
import PetsAdmin from "./admin/PetsAdmin.jsx";
import AppointmentsAdmin from "./admin/AppointmentsAdmin.jsx";
import RecordsAdmin from "./admin/RecordsAdmin.jsx";
import MonitorTab from "./admin/MonitorTab.jsx";

export default function AdminPanel() {
  const [tab, setTab] = useState("vets");
  const tabs = [
    ["vets", "Врачи"],
    ["pets", "Питомцы"],
    ["appts", "Записи"],
    ["records", "Медкарты"],
    ["monitor", "Мониторинг"],
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
      {tab === "vets" && <VetsAdmin />}
      {tab === "pets" && <PetsAdmin />}
      {tab === "appts" && <AppointmentsAdmin />}
      {tab === "records" && <RecordsAdmin />}
      {tab === "monitor" && <MonitorTab />}
    </div>
  );
}
