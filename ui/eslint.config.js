import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import globals from "globals";
import pluginVue from "eslint-plugin-vue";
import vueParser from "vue-eslint-parser";

const prod = process.env.NODE_ENV === "production";

export default [
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  js.configs.recommended,
  ...pluginVue.configs["flat/essential"],
  {
    files: ["**/*.vue"],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tsParser,
        ecmaVersion: "latest",
        sourceType: "module",
        extraFileExtensions: [".vue"],
      },
    },
  },
  {
    files: ["**/*.{ts,mts,cts,tsx}"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",
      "no-console": prod ? "warn" : "off",
      "no-debugger": prod ? "warn" : "off",
      "no-useless-assignment": "off",
      "vue/multi-word-component-names": "off",
      "vue/require-v-for-key": "off",
    },
  },
  {
    files: ["**/*.{js,mjs,cjs,vue}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      "no-console": prod ? "warn" : "off",
      "no-debugger": prod ? "warn" : "off",
      "no-useless-assignment": "off",
      "vue/multi-word-component-names": "off",
      "vue/require-v-for-key": "off",
    },
  },
];
