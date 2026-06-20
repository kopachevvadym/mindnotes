import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "./root";
import { SessionPage } from "@/pages/SessionPage";

export const sessionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sessions/$sessionId",
  component: SessionRouteComponent,
});

function SessionRouteComponent() {
  const { sessionId } = sessionRoute.useParams();
  return <SessionPage sessionId={sessionId} />;
}
