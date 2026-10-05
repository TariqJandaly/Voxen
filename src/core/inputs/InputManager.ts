export type InputAction = string;

/** Maps an action name to one or more `KeyboardEvent.code` values. */
export type InputBinding = Record<InputAction, string | string[]>;

export interface InputManagerOptions {
	/** Call `preventDefault()` on keyboard events whose code is bound to an action. */
	preventDefault?: boolean;
}

/**
 * Tracks keyboard state for the polling game loop.
 *
 * DOM events mutate the state; game code reads it during `update()`. Edge queries
 * (`wasPressed` / `wasReleased`) stay true until `endFrame()` clears them, so every
 * component sees the same edges within a frame. Attach to a focusable element (e.g. the
 * canvas); `blur` clears held keys so movement never sticks when focus is lost.
 */
export class InputManager {
	private bindings: InputBinding;
	private readonly preventDefault: boolean;

	private actionToCodes = new Map<InputAction, string[]>();
	private boundCodes = new Set<string>();

	private readonly downCodes = new Set<string>();
	private readonly pressedCodes = new Set<string>();
	private readonly releasedCodes = new Set<string>();

	private target: EventTarget | null = null;

	constructor(bindings: InputBinding = {}, options: InputManagerOptions = {}) {
		this.bindings = bindings;
		this.preventDefault = options.preventDefault ?? false;
		this.rebuildIndex();
	}

	/** Starts listening on `target`. Calling it again with the same target is a no-op. */
	public attach(target: EventTarget): void {
		if (this.target === target) return;
		if (this.target) this.detach();

		this.target = target;
		target.addEventListener("keydown", this.onKeyDown);
		target.addEventListener("keyup", this.onKeyUp);
		target.addEventListener("blur", this.onBlur);
	}

	/** Stops listening and clears all tracked state. */
	public detach(): void {
		if (!this.target) return;

		this.target.removeEventListener("keydown", this.onKeyDown);
		this.target.removeEventListener("keyup", this.onKeyUp);
		this.target.removeEventListener("blur", this.onBlur);
		this.target = null;
		this.clear();
	}

	public setBindings(bindings: InputBinding): void {
		this.bindings = bindings;
		this.rebuildIndex();
	}

	public isDown(action: InputAction): boolean {
		return this.anyHeld(this.actionToCodes.get(action), this.downCodes);
	}

	public wasPressed(action: InputAction): boolean {
		return this.anyHeld(this.actionToCodes.get(action), this.pressedCodes);
	}

	public wasReleased(action: InputAction): boolean {
		return this.anyHeld(this.actionToCodes.get(action), this.releasedCodes);
	}

	public isKeyDown(code: string): boolean {
		return this.downCodes.has(code);
	}

	public wasKeyPressed(code: string): boolean {
		return this.pressedCodes.has(code);
	}

	public wasKeyReleased(code: string): boolean {
		return this.releasedCodes.has(code);
	}

	/** Clears per-frame edge state. Call once per tick, after all components update. */
	public endFrame(): void {
		this.pressedCodes.clear();
		this.releasedCodes.clear();
	}

	private readonly onKeyDown = (event: Event): void => {
		if (!(event instanceof KeyboardEvent)) return;

		const { code } = event;
		if (this.preventDefault && this.boundCodes.has(code)) {
			event.preventDefault();
		}

		// Ignore OS key-repeat: a held key only produces one press edge.
		if (this.downCodes.has(code)) return;

		this.downCodes.add(code);
		this.pressedCodes.add(code);
	};

	private readonly onKeyUp = (event: Event): void => {
		if (!(event instanceof KeyboardEvent)) return;

		const { code } = event;
		if (!this.downCodes.delete(code)) return;

		this.releasedCodes.add(code);
	};

	private readonly onBlur = (): void => {
		this.clear();
	};

	private clear(): void {
		this.downCodes.clear();
		this.pressedCodes.clear();
		this.releasedCodes.clear();
	}

	private anyHeld(codes: string[] | undefined, set: Set<string>): boolean {
		if (!codes) return false;

		for (let i = 0; i < codes.length; i++) {
			if (set.has(codes[i])) return true;
		}

		return false;
	}

	private rebuildIndex(): void {
		this.actionToCodes.clear();
		this.boundCodes.clear();

		for (const action of Object.keys(this.bindings)) {
			const binding = this.bindings[action];
			const codes = Array.isArray(binding) ? binding : [binding];

			this.actionToCodes.set(action, codes);
			for (let i = 0; i < codes.length; i++) {
				this.boundCodes.add(codes[i]);
			}
		}
	}
}
