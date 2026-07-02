import { createFileRoute } from "@tanstack/react-router";
import { TriagePage } from "@/pages/TriagePage";

/** Розбір думок сесії. `$sessionId_` — щоб НЕ вкладатися в маршрут сесії. */
export const Route = createFileRoute("/sessions/$sessionId_/triage")({
  component: TriageRouteComponent,
});

function TriageRouteComponent() {
  const { sessionId } = Route.useParams();
  return <TriagePage sessionId={sessionId} />;
}
