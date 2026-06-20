import { createFileRoute } from "@tanstack/react-router";
import { ContextPage } from "@/pages/ContextPage";

export const Route = createFileRoute("/contexts/$contextId")({
  component: ContextRouteComponent,
});

function ContextRouteComponent() {
  const { contextId } = Route.useParams();
  return <ContextPage contextId={contextId} />;
}
