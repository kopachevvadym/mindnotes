import { createRoute, redirect } from "@tanstack/react-router";
import { SEED_SESSION_ID } from "@mindnotes/schema";
import { rootRoute } from "./root";

/** Корінь редіректить на засіяну сесію. */
export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({
      to: "/sessions/$sessionId",
      params: { sessionId: SEED_SESSION_ID },
    });
  },
});
