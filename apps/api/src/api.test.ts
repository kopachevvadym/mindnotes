import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { thoughts, contexts, THOUGHT_EDIT_WINDOW_MIN } from "@mindnotes/schema";

// In-memory БД мусить бути задана ДО імпорту env/db (dotenv не перезаписує наявні змінні).
process.env.DATABASE_URL = ":memory:";
const { app } = await import("./index");
const { db } = await import("./db");

migrate(db, { migrationsFolder: `${import.meta.dir}/../drizzle` });

/** Хвилини → мс; для «постаріння» записів за межі вікна редагування. */
const MINUTE_MS = 60_000;
const BEYOND_WINDOW = new Date(Date.now() - (THOUGHT_EDIT_WINDOW_MIN + 1) * MINUTE_MS);

async function createSession(): Promise<string> {
  const res = await app.request("/sessions", { method: "POST" });
  expect(res.status).toBe(201);
  const body = (await res.json()) as { id: string };
  return body.id;
}

async function createThought(sessionId: string, text: string): Promise<string> {
  const res = await app.request(`/sessions/${sessionId}/thoughts`, {
    method: "POST",
    body: JSON.stringify({ body: text }),
  });
  expect(res.status).toBe(201);
  const body = (await res.json()) as { id: string };
  return body.id;
}

async function createContext(seedThoughtId: string): Promise<string> {
  const res = await app.request("/contexts", {
    method: "POST",
    body: JSON.stringify({ seedThoughtId }),
  });
  expect(res.status).toBe(201);
  const body = (await res.json()) as { context: { id: string } };
  return body.context.id;
}

function ageThought(id: string) {
  db.update(thoughts).set({ createdAt: BEYOND_WINDOW }).where(eq(thoughts.id, id)).run();
}

describe("health", () => {
  test("GET /health → ok", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  test("невідомий шлях → 404 { error: not_found }", async () => {
    const res = await app.request("/unknown");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });
});

describe("сесії", () => {
  test("POST /sessions створює порожню сесію без назви", async () => {
    const res = await app.request("/sessions", { method: "POST" });
    expect(res.status).toBe(201);
    const session = (await res.json()) as Record<string, unknown>;
    expect(session.title).toBeNull();
    expect(typeof session.id).toBe("string");
  });

  test("GET /sessions віддає список з кількістю думок", async () => {
    const id = await createSession();
    await createThought(id, "перша");
    await createThought(id, "друга");

    const res = await app.request("/sessions");
    expect(res.status).toBe(200);
    const list = (await res.json()) as Array<{ id: string; thoughtCount: number }>;
    const item = list.find((s) => s.id === id);
    expect(item?.thoughtCount).toBe(2);
  });

  test("GET /sessions/:id — 404 для невідомої", async () => {
    const res = await app.request(`/sessions/${crypto.randomUUID()}`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "session_not_found" });
  });

  test("GET /sessions/:id віддає думки за часом (asc) з contextId=null", async () => {
    const id = await createSession();
    const first = await createThought(id, "перша");
    const second = await createThought(id, "друга");
    // Розводимо created_at, щоб порядок був детермінований.
    db.update(thoughts)
      .set({ createdAt: new Date(Date.now() - MINUTE_MS) })
      .where(eq(thoughts.id, first))
      .run();

    const res = await app.request(`/sessions/${id}`);
    const detail = (await res.json()) as {
      thoughts: Array<{ id: string; contextId: string | null }>;
    };
    expect(detail.thoughts.map((t) => t.id)).toEqual([first, second]);
    expect(detail.thoughts.every((t) => t.contextId === null)).toBe(true);
  });

  test("PATCH /sessions/:id перейменовує і скидає назву", async () => {
    const id = await createSession();

    const renamed = await app.request(`/sessions/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ title: "Викрадена увага" }),
    });
    expect(((await renamed.json()) as { title: string }).title).toBe("Викрадена увага");

    const cleared = await app.request(`/sessions/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ title: null }),
    });
    expect(((await cleared.json()) as { title: null }).title).toBeNull();
  });

  test("PATCH /sessions/:id — 400 на кривому тілі, 404 на невідомій", async () => {
    const id = await createSession();
    const bad = await app.request(`/sessions/${id}`, {
      method: "PATCH",
      body: JSON.stringify({}),
    });
    expect(bad.status).toBe(400);

    const missing = await app.request(`/sessions/${crypto.randomUUID()}`, {
      method: "PATCH",
      body: JSON.stringify({ title: "x" }),
    });
    expect(missing.status).toBe(404);
  });

  test("DELETE /sessions/:id видаляє сесію разом із думками (cascade)", async () => {
    const id = await createSession();
    const thoughtId = await createThought(id, "зникне разом із сесією");

    const res = await app.request(`/sessions/${id}`, { method: "DELETE" });
    expect(res.status).toBe(204);

    const [row] = await db.select().from(thoughts).where(eq(thoughts.id, thoughtId));
    expect(row).toBeUndefined();
  });
});

describe("думки", () => {
  test("POST /sessions/:id/thoughts — 400 на порожньому body, 404 без сесії", async () => {
    const id = await createSession();
    const empty = await app.request(`/sessions/${id}/thoughts`, {
      method: "POST",
      body: JSON.stringify({ body: "   " }),
    });
    expect(empty.status).toBe(400);

    const missing = await app.request(`/sessions/${crypto.randomUUID()}/thoughts`, {
      method: "POST",
      body: JSON.stringify({ body: "думка" }),
    });
    expect(missing.status).toBe(404);
  });

  test("PATCH /thoughts/:id редагує тіло в межах вікна", async () => {
    const sessionId = await createSession();
    const id = await createThought(sessionId, "чорнетка");

    const res = await app.request(`/thoughts/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ body: "чистовик" }),
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { body: string }).body).toBe("чистовик");
  });

  test("PATCH /thoughts/:id — 403 edit_window_closed поза вікном", async () => {
    const sessionId = await createSession();
    const id = await createThought(sessionId, "стара думка");
    ageThought(id);

    const res = await app.request(`/thoughts/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ body: "запізно" }),
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "edit_window_closed" });
  });

  test("PATCH /thoughts/:id архівує без обмеження вікна", async () => {
    const sessionId = await createSession();
    const id = await createThought(sessionId, "в архів");
    ageThought(id);

    const res = await app.request(`/thoughts/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ archived: true }),
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { archived: boolean }).archived).toBe(true);
  });

  test("DELETE /thoughts/:id — у вікні 204, поза вікном 403", async () => {
    const sessionId = await createSession();
    const fresh = await createThought(sessionId, "свіжа");
    const old = await createThought(sessionId, "стара");
    ageThought(old);

    expect((await app.request(`/thoughts/${fresh}`, { method: "DELETE" })).status).toBe(204);

    const res = await app.request(`/thoughts/${old}`, { method: "DELETE" });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "delete_window_closed" });
  });
});

describe("ідеї", () => {
  test("POST /contexts народжує ідею (thesis=null) з думки-насінини", async () => {
    const sessionId = await createSession();
    const seed = await createThought(sessionId, "насінина");

    const res = await app.request("/contexts", {
      method: "POST",
      body: JSON.stringify({ seedThoughtId: seed }),
    });
    expect(res.status).toBe(201);
    const detail = (await res.json()) as {
      context: { thesis: string | null };
      thoughts: Array<{ id: string; sessionTitle: string | null }>;
    };
    expect(detail.context.thesis).toBeNull();
    expect(detail.thoughts.map((t) => t.id)).toEqual([seed]);
  });

  test("POST /contexts — 404 на невідомій думці", async () => {
    const res = await app.request("/contexts", {
      method: "POST",
      body: JSON.stringify({ seedThoughtId: crypto.randomUUID() }),
    });
    expect(res.status).toBe(404);
  });

  test("PATCH /contexts/:id — трім тези, порожня → null", async () => {
    const sessionId = await createSession();
    const contextId = await createContext(await createThought(sessionId, "s"));

    const set = await app.request(`/contexts/${contextId}`, {
      method: "PATCH",
      body: JSON.stringify({ thesis: "  Увага — колективна проблема  " }),
    });
    expect(((await set.json()) as { thesis: string }).thesis).toBe(
      "Увага — колективна проблема",
    );

    const cleared = await app.request(`/contexts/${contextId}`, {
      method: "PATCH",
      body: JSON.stringify({ thesis: "   " }),
    });
    expect(((await cleared.json()) as { thesis: null }).thesis).toBeNull();
  });

  test("POST /contexts/:id/thoughts втягує думку ідемпотентно", async () => {
    const sessionId = await createSession();
    const contextId = await createContext(await createThought(sessionId, "насінина"));
    const extra = await createThought(sessionId, "додаткова");

    for (let i = 0; i < 2; i++) {
      const res = await app.request(`/contexts/${contextId}/thoughts`, {
        method: "POST",
        body: JSON.stringify({ thoughtId: extra }),
      });
      expect(res.status).toBe(200);
    }

    const detail = (await (await app.request(`/contexts/${contextId}`)).json()) as {
      thoughts: unknown[];
    };
    expect(detail.thoughts.length).toBe(2);
  });

  test("думка в сесії дістає contextId НАЙНОВІШОЇ зі своїх ідей", async () => {
    const sessionId = await createSession();
    const seed = await createThought(sessionId, "у двох ідеях");
    const olderContext = await createContext(seed);
    const newerContext = await createContext(seed);
    // Форсуємо різні created_at, щоб «найновіша» була детермінованою.
    db.update(contexts)
      .set({ createdAt: new Date(Date.now() - MINUTE_MS) })
      .where(eq(contexts.id, olderContext))
      .run();

    const detail = (await (await app.request(`/sessions/${sessionId}`)).json()) as {
      thoughts: Array<{ id: string; contextId: string | null }>;
    };
    expect(detail.thoughts.find((t) => t.id === seed)?.contextId).toBe(newerContext);
  });

  test("DELETE /contexts/:id/thoughts/:thoughtId відчіпляє, думка лишається", async () => {
    const sessionId = await createSession();
    const seed = await createThought(sessionId, "відчепиться");
    const contextId = await createContext(seed);

    const res = await app.request(`/contexts/${contextId}/thoughts/${seed}`, { method: "DELETE" });
    expect(res.status).toBe(204);

    const detail = (await (await app.request(`/contexts/${contextId}`)).json()) as {
      thoughts: unknown[];
    };
    expect(detail.thoughts.length).toBe(0);
    const [row] = await db.select().from(thoughts).where(eq(thoughts.id, seed));
    expect(row).toBeDefined();
  });

  test("DELETE /contexts/:id видаляє ідею, думки лишаються", async () => {
    const sessionId = await createSession();
    const seed = await createThought(sessionId, "переживе ідею");
    const contextId = await createContext(seed);

    expect((await app.request(`/contexts/${contextId}`, { method: "DELETE" })).status).toBe(204);
    expect((await app.request(`/contexts/${contextId}`)).status).toBe(404);
    const [row] = await db.select().from(thoughts).where(eq(thoughts.id, seed));
    expect(row).toBeDefined();
  });

  test("видалення думки прибирає її з ідей (cascade лінків)", async () => {
    const sessionId = await createSession();
    const seed = await createThought(sessionId, "зникне з ідеї");
    const contextId = await createContext(seed);

    expect((await app.request(`/thoughts/${seed}`, { method: "DELETE" })).status).toBe(204);

    const detail = (await (await app.request(`/contexts/${contextId}`)).json()) as {
      thoughts: unknown[];
    };
    expect(detail.thoughts.length).toBe(0);
  });

  test("GET /contexts віддає превʼю найранішої думки групи", async () => {
    const sessionId = await createSession();
    const seed = await createThought(sessionId, "найраніша — вона і є превʼю");
    const contextId = await createContext(seed);
    await app.request(`/contexts/${contextId}/thoughts`, {
      method: "POST",
      body: JSON.stringify({ thoughtId: await createThought(sessionId, "пізніша") }),
    });

    const list = (await (await app.request("/contexts")).json()) as Array<{
      id: string;
      previewBody: string | null;
    }>;
    expect(list.find((i) => i.id === contextId)?.previewBody).toBe(
      "найраніша — вона і є превʼю",
    );
  });

  test("GET /contexts рахує думки кожної ідеї", async () => {
    const sessionId = await createSession();
    const contextId = await createContext(await createThought(sessionId, "перша"));
    await app.request(`/contexts/${contextId}/thoughts`, {
      method: "POST",
      body: JSON.stringify({ thoughtId: await createThought(sessionId, "друга") }),
    });

    const list = (await (await app.request("/contexts")).json()) as Array<{
      id: string;
      thoughtCount: number;
    }>;
    expect(list.find((i) => i.id === contextId)?.thoughtCount).toBe(2);
  });
});
