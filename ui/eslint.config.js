import js from "@eslint/js";
import globals from "globals";
import pluginVue from "eslint-plugin-vue";

const prod = process.env.NODE_ENV === "production";

export default [
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  js.configs.recommended,
  ...pluginVue.configs["flat/essential"],
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
