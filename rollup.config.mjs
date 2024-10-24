import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "rollup-plugin-typescript2";
import cleaner from "rollup-plugin-cleaner";
import {terser} from "rollup-plugin-terser";

export default [
    {
        input: "src/client.ts",
        output: [
            {
                file: "dist/client.js",
                format: "iife",
                name: "ClientWs"
            },
            {
                dir: "dist",
                format: "esm",
                entryFileNames: "[name].mjs"
            }
        ],
        plugins: [
            cleaner({
                targets: ["./dist/"]
            }),
            resolve(),
            commonjs(),
            typescript({
                useTsconfigDeclarationDir: true
            }),
            terser() // 压缩代码
        ]
    },
    {
        input: "src/server.ts",
        output: [
            {
                dir: "dist",
                format: "cjs",
                entryFileNames: "[name].cjs"
            }
        ],
        plugins: [
            resolve(),
            commonjs(),
            typescript({
                useTsconfigDeclarationDir: true
            }),
            terser() // 压缩代码
        ]
    }
];