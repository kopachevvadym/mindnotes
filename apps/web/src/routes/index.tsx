import { createFileRoute } from "@tanstack/react-router";
import { SessionsListPage } from "@/pages/SessionsListPage";

/** Корінь — екран-список сесій. */
export const Route = createFileRoute("/")({
  component: SessionsListPage,
});
