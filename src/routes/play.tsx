import { createFileRoute } from "@tanstack/react-router";
import { GameView } from "@/components/game-view";

type PlaySearch = { qa?: boolean };

export const Route = createFileRoute("/play")({
  component: PlayPage,
  validateSearch: (search: Record<string, unknown>): PlaySearch => {
    if (search.qa === "1" || search.qa === 1 || search.qa === true) return { qa: true };
    return {};
  },
});

function PlayPage() {
  const { qa } = Route.useSearch();
  return <GameView autoStart={Boolean(qa)} />;
}
