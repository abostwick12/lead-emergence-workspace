import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextCoreWebVitals,
  {
    rules: {
      // The existing asynchronous Workspace loaders deliberately set state after
      // an initial fetch. This preserves the prior Next 14 lint policy without
      // changing product behavior solely for a new lint recommendation.
      "react-hooks/set-state-in-effect": "off"
    }
  },
  globalIgnores([
    ".next/**",
    "artifacts/**",
    "coverage/**",
    "playwright-report/**",
    "scripts/**",
    "supabase/**",
    "test-results/**",
    "next-env.d.ts"
  ])
]);
