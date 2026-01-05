import { defineConfig } from 'orval'

export default defineConfig({
  api: {
    input: {
      target: 'http://localhost:{{PORT_SERVER_DEV}}/api-json',
      validation: false, // 跳过 schema 验证（后端使用 OpenAPI 3.1 特性）
    },
    output: {
      mode: 'tags-split', // 按 tags 分割文件
      target: 'src/api/generated',
      schemas: 'src/api/model',
      client: 'react-query',
      override: {
        mutator: {
          path: 'src/api/custom-fetch.ts',
          name: 'customFetch',
        },
        query: {
          useQuery: true,
          useMutation: true,
          signal: true,
        },
      },
    },
    hooks: {
      afterAllFilesWrite: 'prettier --write',
    },
  },
})
