import { TanStackDevtools } from "@tanstack/react-devtools";
import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
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
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				{children}
				<TanStackDevtools
					config={{
						position: "bottom-right",
					}}
					plugins={[
						{
							name: "Tanstack Router",
							render: <TanStackRouterDevtoolsPanel />,
						},
					]}
				/>
				<Scripts />
			</body>
		</html>
	);
}
