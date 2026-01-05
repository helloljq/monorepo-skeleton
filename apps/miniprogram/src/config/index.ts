/**
 * 小程序配置
 * 根据环境自动切换 API 地址
 */

// 环境类型
type Env = 'local' | 'dev' | 'staging' | 'production'

// 当前环境 - 修改这里来切换环境
// 'local' - 本地开发 (api-dev.{{DOMAIN}}，需配置 hosts + Caddy)
// 'dev' - 开发环境 (api-dev.{{DOMAIN}})
// 'staging' - 预发布 (api-staging.{{DOMAIN}})
// 'production' - 生产环境 (api.{{DOMAIN}})
const ENV: Env = 'local'

// API 地址配置
// 注意：local 和 dev 使用相同域名，区别在于：
// - local: 通过 hosts 指向本地 127.0.0.1 + Caddy 代理
// - dev: 直接访问远程开发服务器
const API_BASE_URL: Record<Env, string> = {
    local: 'https://api-dev.{{DOMAIN}}',
    dev: 'https://api-dev.{{DOMAIN}}',
    staging: 'https://api-staging.{{DOMAIN}}',
    production: 'https://api.{{DOMAIN}}',
}

// 导出配置
export const config = {
    env: ENV,
    apiBaseUrl: API_BASE_URL[ENV],
}

export default config
