/**
 * Mint a pipeline id on the client. Used as the URL slug for /pipeline/<id>
 * and propagated to the backend so it becomes the LangSmith trace thread id.
 * Falls back to a manual RFC-4122 v4 implementation when `crypto.randomUUID`
 * isn't available (older browsers / non-secure contexts).
 */
export function newPipelineId(): string {
  const c: Crypto | undefined =
    typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (c?.randomUUID) return c.randomUUID();

  // Fallback: RFC 4122 v4 via getRandomValues.
  if (!c?.getRandomValues) {
    throw new Error("Web Crypto API is unavailable");
  }
  const buf = new Uint8Array(16);
  c.getRandomValues(buf);
  buf[6] = (buf[6] & 0x0f) | 0x40;
  buf[8] = (buf[8] & 0x3f) | 0x80;
  const hex = Array.from(buf, (b) => b.toString(16).padStart(2, "0"));
  return (
    hex.slice(0, 4).join("") +
    "-" +
    hex.slice(4, 6).join("") +
    "-" +
    hex.slice(6, 8).join("") +
    "-" +
    hex.slice(8, 10).join("") +
    "-" +
    hex.slice(10, 16).join("")
  );
}
