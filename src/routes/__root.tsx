import {
	createRootRoute,
	HeadContent,
	Link,
	Scripts,
} from "@tanstack/react-router";
import { seo } from "../seo";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{ title: seo.title },
			{ name: "description", content: seo.description },
			{ name: "theme-color", content: "#1e1e1e" },
			{ name: "color-scheme", content: "dark" },

			{ property: "og:type", content: "website" },
			{ property: "og:site_name", content: "Voxen Engine" },
			{ property: "og:title", content: seo.title },
			{ property: "og:description", content: seo.description },
			{ property: "og:url", content: `${seo.siteUrl}/` },
			{ property: "og:image", content: seo.ogImage },
			{ property: "og:image:width", content: "1200" },
			{ property: "og:image:height", content: "630" },
			{ property: "og:image:alt", content: "Voxen Engine logo" },

			{ name: "twitter:card", content: "summary_large_image" },
			{ name: "twitter:title", content: seo.title },
			{ name: "twitter:description", content: seo.description },
			{ name: "twitter:image", content: seo.ogImage },
		],
		links: [
			{ rel: "stylesheet", href: appCss },
			{ rel: "canonical", href: `${seo.siteUrl}/` },
			{ rel: "icon", type: "image/svg+xml", href: "/logo.svg" },
			{
				rel: "icon",
				type: "image/png",
				sizes: "32x32",
				href: "/favicon-32x32.png",
			},
			{
				rel: "icon",
				type: "image/png",
				sizes: "16x16",
				href: "/favicon-16x16.png",
			},
			{
				rel: "apple-touch-icon",
				sizes: "180x180",
				href: "/apple-touch-icon.png",
			},
			{ rel: "manifest", href: "/site.webmanifest" },
		],
	}),
	shellComponent: RootDocument,
	notFoundComponent: NotFound,
});

function NotFound() {
	return (
		<main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas px-6 text-center text-content">
			<p className="text-sm font-semibold text-muted">404</p>
			<h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
				This page does not exist
			</h1>
			<p className="max-w-md text-base leading-7 text-muted">
				The link may be broken, or the page may have moved.
			</p>
			<div className="mt-2 flex items-center gap-3">
				<Link
					to="/"
					className="bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas motion-reduce:transition-none"
				>
					Go Home
				</Link>
				<Link
					to="/projects"
					className="border border-edge bg-panel px-5 py-2.5 text-sm font-medium text-content transition-colors hover:bg-panel-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas motion-reduce:transition-none"
				>
					Open the Editor
				</Link>
			</div>
		</main>
	);
}

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				{children}
				<Scripts />
			</body>
		</html>
	);
}
