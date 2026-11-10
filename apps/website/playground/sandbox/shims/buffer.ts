// What the PDF and image entries use of Node's Buffer (bytes to base64 and back), for a browser.
const CHUNK = 0x8000;

class Bytes extends Uint8Array {
  toString(encoding?: string): string {
    if (encoding === "base64") {
      let binary = "";
      for (let i = 0; i < this.length; i += CHUNK) binary += String.fromCharCode(...this.subarray(i, i + CHUNK));
      return btoa(binary);
    }
    if (encoding === "hex") return Array.from(this, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return new TextDecoder().decode(this);
  }
}

export const Buffer = {
  from(value: string | ArrayBuffer | ArrayLike<number>, encoding?: string): Bytes {
    if (typeof value === "string") {
      if (encoding === "base64") {
        const binary = atob(value);
        const bytes = new Bytes(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return bytes;
      }
      return new Bytes(new TextEncoder().encode(value));
    }
    return new Bytes(value instanceof ArrayBuffer ? new Uint8Array(value) : value);
  },
};
