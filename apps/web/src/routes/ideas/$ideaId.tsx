import { createFileRoute } from "@tanstack/react-router";
import { IdeaPage } from "@/pages/IdeaPage";

export const Route = createFileRoute("/ideas/$ideaId")({
  component: IdeaRouteComponent,
});

function IdeaRouteComponent() {
  const { ideaId } = Route.useParams();
  return <IdeaPage ideaId={ideaId} />;
}
