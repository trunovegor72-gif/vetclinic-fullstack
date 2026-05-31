import Database from "better-sqlite3";

const db = new Database(process.env.DB_PATH || "/data/vetclinic.db");
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS owners (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  name  TEXT NOT NULL,
  email TEXT
);

CREATE TABLE IF NOT EXISTS vets (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  spec TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pets (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL REFERENCES owners(id),
  name     TEXT NOT NULL,
  species  TEXT,
  breed    TEXT,
  age      INTEGER
);

CREATE TABLE IF NOT EXISTS medical_records (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  pet_id INTEGER NOT NULL REFERENCES pets(id),
  date   TEXT NOT NULL,
  type   TEXT NOT NULL,
  note   TEXT
);

CREATE TABLE IF NOT EXISTS vaccinations (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  pet_id    INTEGER NOT NULL REFERENCES pets(id),
  name      TEXT NOT NULL,
  date      TEXT NOT NULL,
  next_date TEXT
);

CREATE TABLE IF NOT EXISTS appointments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  vet_id     INTEGER NOT NULL REFERENCES vets(id),
  pet_id     INTEGER NOT NULL REFERENCES pets(id),
  slot       TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'Запланирован',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lab_orders (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  pet_id   INTEGER NOT NULL REFERENCES pets(id),
  test     TEXT NOT NULL,
  status   TEXT NOT NULL DEFAULT 'Отправлен в лабораторию',
  result   TEXT,
  created_at TEXT NOT NULL
);
`);

const count = db.prepare("SELECT COUNT(*) AS c FROM owners").get().c;
if (count === 0) {
  const owner = db.prepare("INSERT INTO owners (name, email) VALUES (?, ?)")
    .run("Владелец Демо", "owner@example.com");
  const ownerId = owner.lastInsertRowid;

  db.prepare("INSERT INTO vets (name, spec) VALUES (?, ?)").run("Иванова Е. С.", "Терапевт");
  db.prepare("INSERT INTO vets (name, spec) VALUES (?, ?)").run("Петров А. Н.", "Хирург");
  db.prepare("INSERT INTO vets (name, spec) VALUES (?, ?)").run("Соколова М. В.", "Дерматолог");

  const p1 = db.prepare("INSERT INTO pets (owner_id,name,species,breed,age) VALUES (?,?,?,?,?)")
    .run(ownerId, "Барсик", "Кошка", "Британская", 3).lastInsertRowid;
  const p2 = db.prepare("INSERT INTO pets (owner_id,name,species,breed,age) VALUES (?,?,?,?,?)")
    .run(ownerId, "Рекс", "Собака", "Лабрадор", 5).lastInsertRowid;

  db.prepare("INSERT INTO medical_records (pet_id,date,type,note) VALUES (?,?,?,?)")
    .run(p1, "2026-02-10", "Осмотр", "Плановый осмотр, состояние в норме.");
  db.prepare("INSERT INTO vaccinations (pet_id,name,date,next_date) VALUES (?,?,?,?)")
    .run(p1, "Бешенство", "2025-09-01", "2026-09-01");
  db.prepare("INSERT INTO vaccinations (pet_id,name,date,next_date) VALUES (?,?,?,?)")
    .run(p2, "Чумка", "2025-11-15", "2026-11-15");

  console.log("[db] загружены начальные данные");
}

export default db;
