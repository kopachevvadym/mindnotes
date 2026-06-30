# mindnotes

Застосунок-нотатник потоку думок. Користувач під час читання книжки накидає сирий
потік думок, а пізніше організовує їх сам (AI лише асистує). Два режими:
**Потік** (захоплення) і **Синтез** (організація).

## Package manager / runtime

- **Менеджер пакетів — `pnpm`** (pnpm workspaces). Завжди використовуй `pnpm`, НЕ npm/yarn/bun для встановлення.
- **Рантайм — `bun`**: бекенд (Hono) і скрипти (`seed`) запускаються через bun.
- Оркестрація задач — **turborepo**.

```bash
pnpm install          # встановлення
pnpm dev              # turbo: підняти api + web
```

## Структура

```
apps/
  api/        Hono на bun + drizzle-orm (SQLite, локальний файл)
  web/        Vite + React + TS, tailwind, shadcn/ui, tanstack router/query, zustand
packages/
  schema/     zod-схеми + drizzle-таблиці (спільні для фронта і бека)
```

## Архітектурні правила

- Єдиний типізований api-клієнт у `apps/web/src/lib/api-client.ts`. Базовий URL — лише з
  `VITE_API_BASE_URL`. Ніде не хардкодити localhost.
- Усі tanstack-query запити йдуть тільки крізь цей клієнт.
- Відповіді бекенда валідуються спільними zod-схемами з `@mindnotes/schema` на обох боках.
- UI — українською. Ідентифікатори в коді — англійською.

## Команди БД

Локальний SQLite-файл (`apps/api/mindnotes.db`, шлях у `DATABASE_URL`). Драйвер — `bun:sqlite`. Жодного докера.

```bash
pnpm db:generate            # згенерувати SQLite-міграцію з drizzle-схеми
pnpm db:migrate             # застосувати міграції (bun-sqlite migrator)
pnpm db:seed                # засіяти демо-сесію
```

Four rules:

1. Ask, don’t assume. If something’s unclear, ask before writing a line and no silent guesses about intent, architecture, or requirements.

2. Simplest solution first and implement the minimum thing that works. No abstractions you didn’t request.

3. Don’t touch unrelated code and if a file isn’t part of the current task, leave it.

4. Flag uncertainty explicitly or if you’re not confident, say so before proceeding as confidence without certainty causes more damage than admitting a gap.

## Свідомо відкладено — не спрощувати й не добудовувати

Модель навмисно мінімальна; ці рішення ухвалені свідомо (2026-06-29). Не «спрощуй» наведені прогалини і не реалізовуй відкладене без явного прохання.

**Кістяк (ухвалено):**
- Одна сутність «група» = таблиця `context` + опційний `thesis`. Порожня теза ⇒ «контекст» (тематична група); заповнена ⇒ «ідея». Той самий обʼєкт на градієнті зрілості — НЕ окремі «тег»/«сенс»/«ідея».
- Думка ↔ група: M2M (думка може бути в кількох групах; крос-книжковий синтез — центральний сценарій).
- `thought.parentId`: дерево «думка від думки» в межах сесії, один батько. Афорданс потоку, а не організація — членства в групі не дає.

**Відкладено навмисно (НЕ будувати, доки не попросять явно):**
- Папки над контекстами (коли буде реальний безлад → один рівень, одна папка на контекст).
- Граф звʼязків «будь-що-з-будь-чим» і типізовані ребра (свідомо обрано дерево, не граф).
- Поле `exit` на групі (посилання ідея→ідея) — доки не дозріє потреба.
- Глобальний вид «усі думки» поза сесіями.
- Офлайн-захоплення + синхронізація (зараз захоплення йде через сервер).
- Голосове захоплення; експорт (Markdown/Obsidian); auth/мультикористувач; памʼять AI між сесіями.

**AI (коли дійде черга):** лише в режимі Синтез і лише на явний запит, ніколи в Потоці. Обчислення (ембединги, схожість) — тихо; зміна структури — лише з підтвердженням користувача. Ключ моделі — на бекенді, ніколи на фронті.
