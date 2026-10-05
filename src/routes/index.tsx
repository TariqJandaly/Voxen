import { createFileRoute } from "@tanstack/react-router";
import { GameViewport } from "../editor/components/GameViewport";

export const Route = createFileRoute("/")({
	component: Home,
});

function Home() {
	return (
		<div className="h-screen w-screen overflow-hidden">
			<GameViewport />
		</div>
	);
}
