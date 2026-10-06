/**
 * A plain 2D vector. The inspector shows it as a point field, so a component
 * can keep `position = new Vector2(0, 0)` and edit it right from the panel.
 */
export class Vector2 {
	constructor(
		public x = 0,
		public y = 0,
	) {}
}
