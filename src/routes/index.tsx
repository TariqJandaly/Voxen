import { createFileRoute, Link } from "@tanstack/react-router";

const GITHUB_URL = "https://github.com/TariqJandaly/Voxen";

const FEATURES = [
	{
		title: "Entity-Component",
		body: "Compose behavior on components that hook into lifecycle callbacks, instead of a rigid class tree.",
	},
	{
		title: "Canvas 2D Rendering",
		body: "Sprite rendering on a DPI-aware viewport, so the picture stays crisp on high-density displays.",
	},
	{
		title: "Visual Editor",
		body: "A docked hierarchy and a Tweakpane inspector that edit the live scene while it runs.",
	},
];

const linkFocus =
	"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas motion-reduce:transition-none";

function Home() {
	return (
		<main className="flex h-dvh flex-col overflow-hidden bg-canvas text-content">
			<header className="mx-auto flex w-full max-w-5xl shrink-0 items-center justify-between px-6 py-4">
				<Link to="/" className={`flex items-center gap-2 ${linkFocus}`}>
					<img src="/logo.svg" width="28" height="28" alt="" />
					<span className="text-sm font-semibold">Voxen</span>
				</Link>
				<nav className="flex items-center gap-4">
					<a
						href={GITHUB_URL}
						className={`text-sm text-muted transition-colors hover:text-content ${linkFocus}`}
					>
						GitHub
					</a>
				</nav>
			</header>

			<section className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
				<img src="/logo.svg" width="80" height="80" alt="Voxen engine logo" />
				<h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
					A small 2D game engine with a built-in level editor
				</h1>
				<p className="mx-auto mt-4 max-w-xl text-pretty text-base leading-7 text-muted">
					Voxen pairs a pure TypeScript Canvas core with a React editor. Build
					side-scrollers and platformers with a real game loop and a level
					editor in one project.
				</p>
				<div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
					<Link
						to="/engine"
						className={`w-full bg-accent px-6 py-3 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover sm:w-auto ${linkFocus}`}
					>
						Open the Editor
					</Link>
					<a
						href={GITHUB_URL}
						className={`w-full border border-edge bg-panel px-6 py-3 text-sm font-medium text-content transition-colors hover:bg-panel-alt sm:w-auto ${linkFocus}`}
					>
						View on GitHub
					</a>
				</div>
			</section>

			<section className="mx-auto grid w-full max-w-5xl shrink-0 gap-4 px-6 pb-12 sm:grid-cols-3">
				{FEATURES.map((feature) => (
					<div key={feature.title} className="border border-edge bg-panel p-6">
						<h2 className="text-lg font-semibold">{feature.title}</h2>
						<p className="mt-2 text-base leading-6 text-muted">
							{feature.body}
						</p>
					</div>
				))}
			</section>

			<footer className="shrink-0 border-t border-edge">
				<p className="mx-auto max-w-5xl px-6 py-4 text-sm text-muted">
					Early development. Nothing here is a stable public API yet.
				</p>
			</footer>
		</main>
	);
}

export const Route = createFileRoute("/")({
	component: Home,
});
