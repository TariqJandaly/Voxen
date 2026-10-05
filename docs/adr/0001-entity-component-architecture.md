# ADR 0001: Entity-component composition over ECS

- **Status:** Accepted
- **Date:** 2026-10-05
- **Deciders:** Voxen maintainers

## Context

Voxen needs a way to compose game behavior across many kinds of objects (players, enemies, props, triggers) without leaning on a rigid class tree. We considered three models.

1. **Deep inheritance.** `Player extends Character extends Entity`.
2. **Entity-component (EC).** An entity is a container. Behavior lives on components that subscribe to lifecycle callbacks and can query each other.
3. **Entity-component-system (ECS).** Entities are IDs, components are plain data kept in archetype or column arrays, and systems iterate over matching component sets.

Voxen targets 2D side-scrollers and platformers with hundreds to low thousands of active entities. It also ships an inspector-based editor, so components need to be presentable as objects with named, editable fields.

## Decision

Use **entity-component composition**. `GameObject` is the entity, `Component` holds behavior, and components hook directly into `start`, `update`, `onEnable`, and `onDisable`. There is no separate system scheduler. `Scene` drives the loop and calls `update` on active objects.

## Consequences

**Positive**

- Components are ordinary objects with fields and methods, which maps cleanly onto an inspector UI.
- Behavior is self-contained. A component can read input, move its transform, and draw without crossing a system boundary.
- Low ceremony. Nothing to learn about queries, archetypes, or component registration.
- Familiar to anyone coming from a Unity-style engine.

**Negative**

- The performance ceiling is lower than ECS at very large entity counts. Per-component object allocation and virtual dispatch are not cache-friendly.
- Behavior and data live together, so bulk data-oriented optimizations such as struct-of-arrays layout and parallel system iteration are not available.
- Moving to ECS later would be an engine-wide change, not something incremental.

**Mitigations**

- Object pooling plus indexed `for` loops in the update path keep per-frame GC pressure and loop overhead low at the target scale.
- If the scale target grows, the rendering backend abstraction (Phase 7) is the intended seam for a future data-oriented path.

## Naming

This is **not** ECS. Documentation and code comments should say "entity-component", or EC, and should not describe a system scheduler that does not exist.

## Alternatives rejected

- **Deep inheritance.** Rigid, and prone to diamond hierarchies. Adding one behavior means editing a base class.
- **Full ECS.** Better raw throughput, but more boilerplate and indirection than the target scale needs, and a worse fit for an inspector that edits component objects.
