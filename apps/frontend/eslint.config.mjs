// Flat ESLint config (ESLint 9 + Next 16). Replaces the removed `next lint`
// command; eslint-config-next now ships native flat-config arrays.
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts"],
  },
  {
    // react-hooks v6 (bundled with Next 16) ships React-Compiler-aware rules as
    // errors. The Compiler isn't enabled here, so keep them advisory rather than
    // failing the build on long-standing, working patterns.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
    },
  },
];
