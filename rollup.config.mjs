import { nodeResolve } from "@rollup/plugin-node-resolve";
import sucrase from "@rollup/plugin-sucrase";

const buildConfig = (platform) => {
  const year = new Date().getFullYear();
  const banner = `// Terrashell SDK v0.1.0 Copyright (c) ${year} Terrashell`;

  return [
    {
      input: "./src/index.ts",
      output: {
        file: `lib/${platform}/index.${platform == "esm" ? "mjs" : "js"}`,
        banner
      },
      plugins: [
        nodeResolve({
          extensions: ['.js', '.ts']
        }),
        sucrase({
          exclude: ['node_modules/**'],
          transforms: ['typescript']
        }),
      ]
    }
  ];
};

export default async () => {
  return [
    ...buildConfig("esm"),
    ...buildConfig("cjs"),
  ]
}