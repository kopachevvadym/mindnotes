import { createFileRoute, redirect } from "@tanstack/react-router";
import { SEED_SESSION_ID } from "@mindnotes/schema";

/** Корінь редіректить на засіяну сесію. */
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({
      to: "/sessions/$sessionId",
      params: { sessionId: SEED_SESSION_ID },
    });
  },
});
