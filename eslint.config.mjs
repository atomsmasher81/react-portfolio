import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

// `next lint` is gone in Next 16: `npm run lint` runs ESLint directly with the same
// rules .eslintrc.json used to extend (next/core-web-vitals).
const eslintConfig = [
  ...nextCoreWebVitals,
  {
    // eslint-plugin-react-hooks 7 adds the React Compiler's rules to its recommended
    // set. This app doesn't use the compiler, so keep the two hooks rules
    // (rules-of-hooks, exhaustive-deps) that next/core-web-vitals had before.
    rules: {
      "react-hooks/static-components": "off",
      "react-hooks/use-memo": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/incompatible-library": "off",
      "react-hooks/immutability": "off",
      "react-hooks/globals": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/error-boundaries": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-render": "off",
      "react-hooks/unsupported-syntax": "off",
      "react-hooks/config": "off",
      "react-hooks/gating": "off",
    },
    // ESLint 8 didn't report unused eslint-disable comments; ESLint 9 does by default.
    linterOptions: { reportUnusedDisableDirectives: "off" },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      ".next-*/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
