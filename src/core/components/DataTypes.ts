import { Component } from "../Component";
import { Color } from "../math/Color";
import { Vector2 } from "../math/Vector2";
import { Vector3 } from "../math/Vector3";
import { Vector4 } from "../math/Vector4";

/**
 * A throwaway component with one field of every type the inspector can draw. It
 * does nothing on its own; keep it around to check that number, string, boolean,
 * color, and point fields show up correctly.
 */
export class DataTypes extends Component {
	public numberValue = 42;
	public stringValue = "hello";
	public booleanValue = true;
	public colorValue = new Color(255, 69, 0, 255);
	public point2dValue = new Vector2(100, 50);
	public point3dValue = new Vector3(1, 2, 3);
	public point4dValue = new Vector4(1, 2, 3, 4);
}
