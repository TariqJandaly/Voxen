# Input

`InputManager` turns DOM keyboard events into state the polling game loop can read. It lives at `src/core/inputs/InputManager.ts`, is owned by the `Scene` as `scene.input`, and is shared by every component.

The idea is to keep the two halves apart. DOM handlers only record state. Gameplay code samples that state during `update()`. No game logic runs inside an event callback.

## Quick reference

Everything below is a method on the `scene.input` instance.

| Method | Returns | Meaning |
| --- | --- | --- |
| `attach(target)` | `void` | Start listening on an `EventTarget`, usually the canvas. Idempotent for the same target. |
| `detach()` | `void` | Remove listeners and clear all state. |
| `setBindings(bindings)` | `void` | Replace the action to key-code map. |
| `isDown(action)` | `boolean` | The action is currently held. |
| `wasPressed(action)` | `boolean` | The action went down this frame. |
| `wasReleased(action)` | `boolean` | The action went up this frame. |
| `isKeyDown(code)` | `boolean` | A raw `KeyboardEvent.code` is held. |
| `wasKeyPressed(code)` | `boolean` | A raw code went down this frame. |
| `wasKeyReleased(code)` | `boolean` | A raw code went up this frame. |
| `endFrame()` | `void` | Clear the one-frame edges. The scene calls this for you. |

## Bindings

A binding maps an action name to one or more physical keys, using `KeyboardEvent.code`. That means `KeyA` rather than the character `"a"`.

```ts
scene.input.setBindings({
  left: ["ArrowLeft", "KeyA"],
  right: ["ArrowRight", "KeyD"],
  up: ["ArrowUp", "KeyW"],
  down: ["ArrowDown", "KeyS"],
  jump: "Space",
});
```

Using `code` is deliberate. It keeps WASD working on AZERTY and other layouts. Common values are `ArrowLeft`, `KeyA` through `KeyZ`, `Digit0` through `Digit9`, `Space`, `ShiftLeft`, and `Escape`.

You can also pass bindings to the constructor, which is handy in tests:

```ts
import { InputManager } from "#/core/inputs/InputManager";

const input = new InputManager({ jump: "Space" }, { preventDefault: true });
```

## Actions or raw codes

Prefer actions for gameplay. They give you a stable name like `"jump"` that is not tied to a key, so rebinding is a one line change.

Use the raw API when you need one specific key and do not want to invent an action:

```ts
if (this.scene.input.isKeyDown("Escape")) {
  this.scene.stopLoop();
}
```

## Attaching and focus

`attach(target)` takes any `EventTarget`. Voxen attaches to the canvas element, which means keyboard input only registers while the canvas is focused. That is on purpose: it stops future editor panels from driving the game while you type into an inspector field.

The viewport focuses the canvas on mount and on click:

```ts
scene.input.attach(canvas);
canvas.focus();
```

```tsx
<canvas tabIndex={0} onPointerDown={() => canvasRef.current?.focus()} />
```

Always call `detach()` when tearing things down:

```ts
return () => {
  scene.input.detach();
  scene.stopLoop();
};
```

`attach` is idempotent for the same target. Calling it with a new target detaches the old one first, which makes it safe under React StrictMode's double mount.

## One-frame edges and endFrame

State is kept in three sets: keys currently held, keys pressed since the last frame, and keys released since the last frame.

- `isDown` reads the held set and stays `true` for as long as the key is held.
- `wasPressed` and `wasReleased` read the edge sets and stay `true` for a single tick.
- `Scene.tick()` calls `input.endFrame()` after every object updates. That way all components see the same edges within a frame, and the next frame starts clean.

A `keydown` event for a key that is already held is ignored, so OS key repeat never produces extra `wasPressed` edges.

```
frame N                          frame N+1
keydown A: pressed{A}=true       endFrame() clears pressed
wasPressed("left") === true      wasPressed("left") === false
isDown("left")     === true      isDown("left")     === true
```

If a key goes down and up within a single frame, both `wasPressed` and `wasReleased` read `true` for that frame, and `isDown` reads `false`.

## Losing focus

When the attached target fires `blur`, the manager clears all held and edge state. Without that, a key held while the user tabs away would stay down forever. The tradeoff is intentional: a held key does not survive focus loss.

## Preventing default

Some keys, like arrows and space, scroll or activate the page. Pass `preventDefault: true` to stop that for the codes you have bound. Unbound keys keep their normal browser behavior.

```ts
const input = new InputManager({ jump: "Space" }, { preventDefault: true });
```

## Example component

This is the real implementation in `src/core/components/PlayerController.ts`, which the viewport demo uses.

```ts
import { Component } from "#/core/Component";

export class PlayerController extends Component {
  public speed = 200;

  public update(deltaTime: number): void {
    const input = this.scene.input;

    let directionX = 0;
    let directionY = 0;

    if (input.isDown("left")) directionX -= 1;
    if (input.isDown("right")) directionX += 1;
    if (input.isDown("up")) directionY -= 1;
    if (input.isDown("down")) directionY += 1;

    // Keep diagonal movement the same speed as axis-aligned movement.
    if (directionX !== 0 && directionY !== 0) {
      directionX *= Math.SQRT1_2;
      directionY *= Math.SQRT1_2;
    }

    this.gameObject.transform.position.x += directionX * this.speed * deltaTime;
    this.gameObject.transform.position.y += directionY * this.speed * deltaTime;
  }
}
```

## Limitations

- Keyboard only. Mouse and pointer tracking, along with screen-to-world translation, are not built yet.
- No runtime rebinding UI. `setBindings` exists, but the editor does not expose it yet.
- No gamepad support.
- Input is focus-scoped. The canvas has to be focused, and there is no global fallback listener by design.
