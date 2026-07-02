import { createFileRoute } from "@tanstack/react-router";
import { ContextsListPage } from "@/pages/ContextsListPage";

export const Route = createFileRoute("/contexts/")({
  component: ContextsListPage,
});
