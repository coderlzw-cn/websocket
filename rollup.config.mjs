import terser from '@rollup/plugin-terser';
import typescript from "@rollup/plugin-typescript";
import deletePlugin from 'rollup-plugin-delete';

export default {
  input: "src/websocket.ts",
  output: [
    {
      file: "dist/websocket.js",
      format: "cjs",
      sourcemap: true
    },
    {
      file: "dist/websocket.esm.js",
      format: "esm",
      sourcemap: true
    },
    {
      file: "dist/websocket.umd.js",
      format: "umd",
      sourcemap: true,
      name: "WebSocketClient"
    }
  ],
  plugins: [
    deletePlugin({ targets: ['dist'] }), // 在构建前删除 dist 目录
    typescript({
      tsconfig: "./tsconfig.json",
      declaration: true,
      declarationDir: "dist"
    }),
    terser()
  ]
};
