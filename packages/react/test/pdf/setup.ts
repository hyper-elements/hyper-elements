// pdf.js (test-only: it reads the PDFs back) uses Promise.withResolvers, which Node 20 (CI's) doesn't have.
if (!("withResolvers" in Promise)) {
  Object.assign(Promise, {
    withResolvers<T>() {
      let resolve!: (value: T) => void;
      let reject!: (reason?: unknown) => void;
      const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    },
  });
}

// And ArrayBuffer's transferToFixedLength (Node 21): without it, reading a page whose fonts it describes fails, and
// pdf.js skips the page's content (images included) with only a warning. The contents moved to a new buffer of
// `length` bytes, the old one detached.
if (!("transferToFixedLength" in ArrayBuffer.prototype)) {
  Object.defineProperty(ArrayBuffer.prototype, "transferToFixedLength", {
    configurable: true,
    writable: true,
    value(this: ArrayBuffer, length: number = this.byteLength) {
      const moved = new ArrayBuffer(length);
      new Uint8Array(moved).set(new Uint8Array(this, 0, Math.min(length, this.byteLength)));
      structuredClone(this, { transfer: [this] });
      return moved;
    },
  });
}
