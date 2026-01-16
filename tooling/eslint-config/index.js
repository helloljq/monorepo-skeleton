/**
 * 共享 ESLint 配置
 * 各应用可以在此基础上扩展
 */
module.exports = {
  extends: ["eslint:recommended"],
  rules: {
    "no-console": "warn",
    "no-unused-vars": "off", // TypeScript 处理
  },
};
