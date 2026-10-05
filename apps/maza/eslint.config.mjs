import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Tech debt — 155 `any` types concentrated in lib/orquestrador and
      // lib/pessoas. Downgraded from error to warn so the gate works without
      // blocking on Sprint 1 security work. Sprint 2: type the Supabase layer.
      "@typescript-eslint/no-explicit-any": "warn",

      // False positive: ESLint flags JSX prop `module="value"` as an
      // assignment to the global `module` variable. It is not — it is a
      // JSX attribute passed to <InsightPanel module="...">. Disabled.
      "@next/next/no-assign-module-variable": "off",

      // react-hooks rules from eslint-config-next — informational only.
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
