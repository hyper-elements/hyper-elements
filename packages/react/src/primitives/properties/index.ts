/**
 * Properties: what an element's props and a template's fields are made with (`prop`'s helpers), and a team's own
 * (`defineProperty()`). They describe values and their limits as data, so the same limits can check a value with no
 * render: these modules import only the engine, never React or the render that collects a design
 * (`properties.test.ts` holds them to it). `defineElement()` (`../custom.tsx`) makes elements with them.
 */
export { prop, type BlocksSpec, type FieldInput, type FieldInputs, type FieldValue, type FieldValues, type ListSpec, type ObjectSpec } from "./prop";
export { defineProperty, type PropertyDefinition } from "./define";
export { checkValue, type CheckedValue } from "./check";
