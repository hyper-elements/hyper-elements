/**
 * A core whose BLOCK_MAP_VERSION is one this package reads but whose render() writes entries without their component:
 * renderInEmailClients() refuses it rather than writing previews whose findings would be silently empty.
 */
import React from "react";
import { vi } from "vitest";

vi.mock("@hyper-elements/react", async (original) => {
  const core = await original<typeof import("@hyper-elements/react")>();
  return {
    ...core,
    async render(...args: Parameters<typeof core.render>) {
      const rendered = await core.render(...args);
      return { ...rendered, blocks: rendered.blocks && { ...rendered.blocks, entries: rendered.blocks.entries.map(({ type: _, ...entry }) => entry) } };
    },
  };
});

const { Email, Text } = await import("@hyper-elements/react");
const { renderInEmailClients } = await import("../src/index");

it("refuses a block map whose entries don't say their component", async () => {
  const error = await renderInEmailClients(
    <Email width={600}>
      <Text>Hi</Text>
    </Email>
  ).catch((e: unknown) => e as Error);
  expect(error).toMatchObject({ name: "email-clients/version-mismatch", message: expect.stringContaining("has no block types in render()'s blockMap. Install a matching pair: npm i @hyper-elements/react@^0.4.0") });
});
