import resolve from "@rollup/plugin-node-resolve";
import typescript from "rollup-plugin-typescript2";
import cleaner from "rollup-plugin-cleaner";
import {terser} from "rollup-plugin-terser";
import dts from "rollup-plugin-dts"; // 导入 dts 插件
import commonjs from "@rollup/plugin-commonjs";
import nodePolyfills from "rollup-plugin-polyfill-node";

export default [
    {
        input: "src/index.ts",
        output: [
            {
                dir: "dist",
                format: "iife",
                entryFileNames: "[name].js",
                name: "CoderLzwWebSocket"
            },
            {
                dir: "dist",
                format: "esm",
                entryFileNames: "[name].mjs"
            },
            {
                dir: "dist",
                format: "cjs",
                entryFileNames: "[name].cjs"
            }
        ],
        plugins: [
            cleaner({
                targets: ["./dist/"]
            }),
            commonjs(),
            nodePolyfills(),
            resolve(),
            typescript({
                useTsconfigDeclarationDir: true
            }),
            terser()
        ]
    },
    {
        input: "src/index.ts",
        output: {
            dir: "dist",
            format: "es",
            entryFileNames: "type.d.ts"
        },
        plugins: [dts()]
    }
];