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
  api/        Hono на bun + drizzle-orm (Postgres)
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

```bash
docker compose up -d        # Postgres
pnpm db:generate            # згенерувати міграції з drizzle-схеми
pnpm db:migrate             # застосувати міграції
pnpm db:push                # запушити схему напряму (швидкий прототип, без міграцій)
pnpm db:seed                # засіяти демо-сесію
```
