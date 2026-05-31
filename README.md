# Информационная система управления ветеринарной клиникой

Курсовая работа. Полнофункциональное веб-приложение: онлайн-запись на приём,
электронные медкарты питомцев, учёт вакцинаций, интеграция с лабораторией.

**Технологический стек:** React (Vite) + Node.js (Express) + Apache Kafka +
Redis + SQLite, всё в Docker.

---

## Быстрый запуск (одна команда)

Требуется только установленный **Docker** с Docker Compose.

```bash
docker compose up --build
```

Первый запуск занимает несколько минут (сборка образов и старт Kafka).
Когда в логах появится `[server] API на порту 4000`, открыть в браузере:

```
http://localhost:8080
```

Остановка: `Ctrl+C`, затем `docker compose down`.
Полный сброс данных: `docker compose down -v`.

---

## Архитектура

```
┌────────────────────────────────────────────────────────┐
│              Браузер — React SPA (nginx :8080)            │
│      Кабинет владельца │ Панель врача │ Мониторинг        │
└───────────────────────────┬──────────────────────────────┘
                             │ REST API (/api, прокси nginx)
                             ▼
                  ┌─────────────────────┐
                  │  Node.js / Express  │
                  │     backend :4000   │
                  └───┬──────┬──────┬───┘
                      │      │      │
              SQLite  │      │      │  Redis (кэш сетки
            (данные)  │      │      │  приёма, TTL 15с)
                      │      │      │
                      │      ▼      │
                      │  Apache Kafka (топики событий)
                      │  • appointment.created
                      │  • lab.order.created
                      │  • lab.result.ready
                      ▼
              Консьюмеры: лаборатория обрабатывает заказ
              и публикует результат → запись в медкарту
```

### Поток событий Kafka

| Топик                 | Продюсер          | Консьюмер                        |
|-----------------------|-------------------|----------------------------------|
| `appointment.created` | POST /appointments| Логируется, виден в мониторинге  |
| `lab.order.created`   | POST /lab-orders  | «Лаборатория» (обработка 4 c)    |
| `lab.result.ready`    | Сервис лаборатории| Запись результата в медкарту     |

### Redis

Кэшируется ответ `GET /api/schedule/:vetId` (сетка приёма врача) с TTL 15 с.
При создании новой записи кэш соответствующего врача инвалидируется
(`DEL schedule:{vetId}`). В разделе «Мониторинг» отображаются метрики
hits / misses / hit-rate.

---

## Схема базы данных (SQLite)

```
owners(id, name, email)
  └─< pets(id, owner_id, name, species, breed, age)
         ├─< medical_records(id, pet_id, date, type, note)
         ├─< vaccinations(id, pet_id, name, date, next_date)
         └─< lab_orders(id, pet_id, test, status, result, created_at)

vets(id, name, spec)
  └─< appointments(id, vet_id, pet_id, slot, status, created_at)
```

---

## Структура проекта

```
vetclinic-fullstack/
├── docker-compose.yml        # оркестрация всех сервисов
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── server.js         # Express + REST API
│       ├── db.js             # SQLite: схема + сид-данные
│       ├── kafka.js          # kafkajs: продюсер/консьюмер
│       └── redis.js          # ioredis: кэш сетки приёма
└── frontend/
    ├── Dockerfile            # сборка Vite + раздача через nginx
    ├── nginx.conf            # SPA + прокси /api на backend
    ├── package.json
    └── src/
        ├── main.jsx          # точка входа React
        ├── App.jsx           # роутинг по ролям
        ├── api.js            # обёртка над fetch (REST API)
        ├── styles.css        # все стили
        └── components/
            ├── Header.jsx        # шапка
            ├── RolePicker.jsx    # экран входа / выбор роли
            ├── OwnerCabinet.jsx  # кабинет владельца (запись, питомцы, записи)
            ├── VetPanel.jsx      # панель ветеринара + карточки приёма
            ├── AdminPanel.jsx    # админ-панель с вкладками
            ├── MedicalRecord.jsx # переиспользуемая медкарта питомца
            └── admin/
                ├── VetsAdmin.jsx          # CRUD врачей
                ├── PetsAdmin.jsx          # CRUD питомцев
                ├── AppointmentsAdmin.jsx  # CRUD записей на приём
                ├── RecordsAdmin.jsx       # CRUD записей в медкартах
                └── MonitorTab.jsx         # мониторинг Kafka и Redis
```

---

## Сценарий демонстрации на защите

1. Открыть `http://localhost:8080`, войти как **Владелец питомца**.
2. Создать запись на приём — внизу появится сообщение, что событие
   отправлено в Kafka. Обратить внимание на метку: данные сетки взяты
   из кэша Redis либо рассчитаны и закэшированы.
3. Выйти, войти как **Ветеринар** — видна созданная запись.
   Заполнить медкарту, назначить анализ («Отправить в лабораторию»).
4. Через ~4 секунды статус анализа меняется на «Готов» — это сработала
   цепочка Kafka: `lab.order.created` → лаборатория → `lab.result.ready`.
5. Войти как **Администратор** — в реальном времени виден поток
   событий Kafka и метрики кэша Redis.

---

## Замечания по реализации

- **Kafka в режиме KRaft** (без ZooKeeper) — меньше контейнеров,
  быстрее и стабильнее старт, что важно для демонстрации.
- **SQLite** вместо отдельной СУБД — не требует контейнера и настройки,
  файл создаётся автоматически; для учебного проекта достаточно.
- Backend подключается к Kafka с **повторными попытками**: при старте
  контейнеров брокер может быть ещё не готов — это нормально, бэкенд
  дождётся и подключится сам.
- `depends_on` с `condition: service_healthy` гарантирует, что backend
  стартует только после готовности Redis и Kafka.
