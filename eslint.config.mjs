import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import js from "@eslint/js";

export default [
    {files: ["**/*.{js,mjs,cjs,ts}"]},
    {ignores: ["dist/*"]},
    {languageOptions: {globals: {...globals.browser, ...globals.node}}},
    pluginJs.configs.recommended,
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        rules: {
            "@typescript-eslint/no-unused-vars": ["warn", {"varsIgnorePattern": "^_", "argsIgnorePattern": "^_"}],
            "no-multiple-empty-lines": ["error", { "max": 1 }],
            "no-trailing-spaces": "error",
            "semi": ["error", "always"],
            "quotes": ["error", "double"],
            "comma-dangle": ["error", "never"],
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-unsafe-function-type": "off"
        }
    }
];