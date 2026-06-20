import { createFileRoute } from "@tanstack/react-router";
import { SessionPage } from "@/pages/SessionPage";

export const Route = createFileRoute("/sessions/$sessionId")({
  component: SessionRouteComponent,
});

function SessionRouteComponent() {
  const { sessionId } = Route.useParams();
  return <SessionPage sessionId={sessionId} />;
}
