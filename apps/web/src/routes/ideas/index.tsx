import { createFileRoute } from "@tanstack/react-router";
import { IdeasListPage } from "@/pages/IdeasListPage";

export const Route = createFileRoute("/ideas/")({
  component: IdeasListPage,
});
