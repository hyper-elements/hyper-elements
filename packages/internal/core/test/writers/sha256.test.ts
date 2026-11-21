import { createHash } from "node:crypto";
import { utf8Encode } from "../../src/writers/shared/bytes";
import { sha256Hex } from "../../src/writers/shared/sha256";

/** What names an email's files: the same bytes as Node's SHA-256 and TextEncoder, without either (the engine runs where they aren't). */
describe("sha256Hex and utf8Encode", () => {
  const node = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

  it("gives FIPS 180-4's digests", () => {
    expect(sha256Hex(new Uint8Array())).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256Hex(utf8Encode("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(sha256Hex(utf8Encode("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"))).toBe("248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1");
  });

  it("matches Node's on every length around a block's edges, and on a long message", () => {
    for (let length = 0; length <= 200; length++) {
      const bytes = Uint8Array.from({ length }, (_, i) => (i * 31 + length) & 0xff);
      expect(sha256Hex(bytes), `length ${length}`).toBe(node(bytes));
    }
    const long = Uint8Array.from({ length: 100_000 }, (_, i) => (i * 7) & 0xff);
    expect(sha256Hex(long)).toBe(node(long));
  });

  it("encodes text as TextEncoder does: ASCII, accents, CJK, emoji, and a lone surrogate as U+FFFD", () => {
    for (const text of ["", "plain", "café — naïve", "日本語のテキスト", "a 😀 b", "lone \ud800 high", "lone \udc00 low", "end \ud83d"]) {
      expect(Array.from(utf8Encode(text)), JSON.stringify(text)).toEqual(Array.from(new TextEncoder().encode(text)));
    }
  });
});
