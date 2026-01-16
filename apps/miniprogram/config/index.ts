import type { UserConfigExport } from "@tarojs/cli";

const taroAppEnv = process.env.TARO_APP_ENV || "development";
const appEnv =
  taroAppEnv === "development"
    ? "dev"
    : taroAppEnv === "staging"
      ? "staging"
      : "prod";

export default {
  projectName: "monorepo-skeleton-miniprogram",
  date: "2024-12-30",
  designWidth: 750,
  deviceRatio: {
    640: 2.34 / 2,
    750: 1,
    375: 2,
    828: 1.81 / 2,
  },
  sourceRoot: "src",
  outputRoot: "dist",
  plugins: [],
  defineConstants: {
    "process.env.TARO_APP_ENV": JSON.stringify(taroAppEnv),
    "process.env.APP_ENV": JSON.stringify(appEnv),
  },
  copy: {
    patterns: [],
    options: {},
  },
  framework: "react",
  compiler: "webpack5",
  cache: {
    enable: false,
  },
  mini: {
    postcss: {
      pxtransform: {
        enable: true,
        config: {},
      },
      cssModules: {
        enable: false,
        config: {
          namingPattern: "module",
          generateScopedName: "[name]__[local]___[hash:base64:5]",
        },
      },
    },
  },
  h5: {
    publicPath: "/",
    staticDirectory: "static",
    postcss: {
      autoprefixer: {
        enable: true,
        config: {},
      },
      cssModules: {
        enable: false,
        config: {
          namingPattern: "module",
          generateScopedName: "[name]__[local]___[hash:base64:5]",
        },
      },
    },
  },
} satisfies UserConfigExport;
