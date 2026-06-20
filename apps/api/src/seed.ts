import { eq } from "drizzle-orm";
import { sessions, thoughts, SEED_SESSION_ID } from "@mindnotes/schema";
import { db } from "./db";

/**
 * Ідемпотентний seed: одна сесія «Викрадена увага» + 5 думок (одна в архіві),
 * у стилі сирих думок під час читання нон-фікшну про увагу.
 */
async function seed() {
  // Чистимо попередні дані цієї сесії (cascade прибере думки).
  await db.delete(sessions).where(eq(sessions.id, SEED_SESSION_ID));

  const startedAt = new Date("2026-06-18T20:10:00.000Z");

  await db.insert(sessions).values({
    id: SEED_SESSION_ID,
    title: "Викрадена увага",
    startedAt,
    createdAt: startedAt,
  });

  // Розводимо created_at у часі, щоб порядок у потоці був стабільним.
  const base = startedAt.getTime();
  const minute = 60_000;
  const thoughtSeed: Array<{ body: string; archived: boolean; offset: number }> = [
    {
      body: "Він каже, що проблема не в нашій силі волі. Середовище спеціально спроєктоване, щоб красти увагу. Дивно відчувати полегшення і злість водночас.",
      archived: false,
      offset: 0,
    },
    {
      body: "«Флоу» неможливий, коли тебе перебивають кожні три хвилини. А я ж сам перебиваю себе — рука сама тягнеться до телефона.",
      archived: false,
      offset: 4,
    },
    {
      body: "Треба перевірити цю статистику пізніше.",
      archived: true,
      offset: 7,
    },
    {
      body: "Сон. Він повертається до сну знову і знову. Невиспаний мозок просто фізично не здатен утримувати фокус — це не лінь.",
      archived: false,
      offset: 11,
    },
    {
      body: "Цікава думка: увага — це не лише особиста гігієна, а колективна проблема. Демократія потребує людей, здатних слухати одне одного довше за хвилину.",
      archived: false,
      offset: 15,
    },
  ];

  await db.insert(thoughts).values(
    thoughtSeed.map((t) => ({
      sessionId: SEED_SESSION_ID,
      body: t.body,
      archived: t.archived,
      createdAt: new Date(base + t.offset * minute),
    })),
  );

  console.log(`🌱 Засіяно сесію «Викрадена увага» (${SEED_SESSION_ID}) + ${thoughtSeed.length} думок`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
