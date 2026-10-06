/**
 * An RGBA color with 0-255 channels. The inspector shows it as a preview
 * swatch, a picker, and separate R, G, B, and A inputs.
 */
export class Color {
	constructor(
		public r = 255,
		public g = 255,
		public b = 255,
		public a = 255,
	) {}
}
