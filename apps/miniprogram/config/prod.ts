import type { UserConfigExport } from '@tarojs/cli'

export default {
  env: {
    NODE_ENV: '"production"',
  },
  defineConstants: {},
  mini: {
    optimizeMainPackage: {
      enable: true,
    },
  },
  h5: {},
} satisfies UserConfigExport
