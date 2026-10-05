/**
 * Site metadata shared by every route.
 *
 * Set `VITE_SITE_URL` at build time to the deployed origin (for example
 * `https://voxen.example`) so canonical and Open Graph URLs are absolute and
 * correct. It falls back to localhost for local development.
 */
const siteUrl = (
	import.meta.env.VITE_SITE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

export const seo = {
	siteUrl,
	title: "Voxen Engine - a lightweight 2D game engine",
	description:
		"A lightweight 2D game engine with a pure TypeScript Canvas core and a React editor. Built for side-scrollers and platformers.",
	ogImage: `${siteUrl}/og-image.png`,
} as const;
