/**
 * What a preview's runtime reads beside the email (its `email-client-config`). Written out here, with the block map's
 * shape, so the shell, and HTML previewed without core, need no types from core; the runtime's
 * Config is this type, and core's BlockMap fits `PreviewBlockMap`.
 */
import type { Computer, ModelClient, PreviewClient } from "./clients";

/** One block in the email (render()'s blockMap entry): its path, id, component and where its element starts. */
export interface PreviewBlockEntry {
  path: string;
  nodeId?: string;
  type: string;
  /** The UTF-8 byte offset just after its outermost element's tag name. */
  offset: number;
}

/** The email's blocks, as render()'s blockMap gives them: none for HTML the caller gave. */
export interface PreviewBlockMap {
  version: number;
  unit: "utf8";
  entries: PreviewBlockEntry[];
}

export interface PreviewConfig {
  id: string;
  client: PreviewClient;
  /** The models' client it's drawn with (Apple Mail on an iPhone: apple-mail-ios). */
  model: ModelClient;
  name: string;
  variant: "desktop" | "phone";
  /** For webmail, the computer it's read on (its fonts). */
  computer?: Computer;
  dark: boolean;
  width: number;
  approximate: boolean;
  blocks: PreviewBlockMap;
  fontOrigin: string | null;
  /** Where each of the client's open font files loads from: its URL, or a data: URL. */
  fontSources: Record<string, string>;
  /** Each stand-in face to load before measuring, and their families (the models'). */
  faces: string[];
  /** Families whose stand-ins aren't loaded, as the email doesn't name them (NAMED_ONLY): their @font-face rules are left out. */
  leftOut: string[];
  standIns: string[];
  /** The Elements version the client's model was measured on, the runtime's sha256, and the models' script's and protocol. */
  elements: string | null;
  runtime: string;
  models: { script: string; protocol: number };
}
