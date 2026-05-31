const TZ = "Europe/Moscow";

// Дата и время по Москве, например "28.05.2026, 14:30:05"
export function nowMoscow() {
  return new Date().toLocaleString("ru-RU", { timeZone: TZ });
}

// Только время по Москве, например "14:30:05"
export function timeMoscow() {
  return new Date().toLocaleTimeString("ru-RU", { timeZone: TZ });
}

// Дата по Москве в формате YYYY-MM-DD
export function dateMoscow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parts;
}
