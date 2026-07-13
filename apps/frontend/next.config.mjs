import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Self-contained server bundle for the Docker runtime image.
  output: "standalone",
  // Trace from the monorepo root so hoisted deps + @applyai/types are bundled.
  // Stable top-level key since Next 15.
  outputFileTracingRoot: path.join(__dirname, "../../"),
  // @applyai/types ships raw .ts, so Next must transpile it like app code.
  transpilePackages: ["@applyai/types"],
  // Security headers applied to every response served by the Node runtime.
  // A strict Content-Security-Policy is intentionally omitted for now — Next's
  // inline bootstrap scripts + Firebase Auth make a non-breaking CSP fiddly to
  // get right; add one (start in Report-Only mode) once the allow-list is known.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
