import { useState } from 'react'
import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { config } from '../../config'
import './index.scss'

type ApiStatus = 'idle' | 'loading' | 'success' | 'error'

function Index() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>('idle')
  const [apiMessage, setApiMessage] = useState('')

  // 测试 API 连接
  const testApiConnection = async () => {
    setApiStatus('loading')
    setApiMessage('正在连接...')

    try {
      const response = await Taro.request({
        url: `${config.apiBaseUrl}/health`,
        method: 'GET',
        timeout: 5000,
      })

      if (response.statusCode === 200) {
        setApiStatus('success')
        setApiMessage(`API 连接成功！(${config.apiBaseUrl})`)
        Taro.showToast({ title: '连接成功', icon: 'success' })
      } else {
        setApiStatus('error')
        setApiMessage(`API 返回状态码: ${response.statusCode}`)
      }
    } catch (error) {
      setApiStatus('error')
      const errorMsg = error instanceof Error ? error.message : '未知错误'
      setApiMessage(`连接失败: ${errorMsg}`)
      Taro.showToast({ title: '连接失败', icon: 'none' })
    }
  }

  return (
    <View className="index">
      <View className="header">
        <Text className="title">{{TITLE}}</Text>
        <Text className="subtitle">微信小程序</Text>
      </View>

      <View className="card">
        <Text className="emoji">👋</Text>
        <Text className="greeting">Hello World!</Text>
        <Text className="desc">项目已成功初始化，可以开始开发了。</Text>
      </View>

      <View className="card api-test">
        <Text className="card-title">🔗 API 连接测试</Text>
        <Text className="api-url">API 地址: {config.apiBaseUrl}</Text>
        <Text className="env-info">当前环境: {config.env}</Text>

        <Button
          className={`test-btn ${apiStatus}`}
          onClick={testApiConnection}
          loading={apiStatus === 'loading'}
        >
          {apiStatus === 'loading' ? '测试中...' : '测试连接'}
        </Button>

        {apiMessage && (
          <Text className={`status-message ${apiStatus}`}>{apiMessage}</Text>
        )}
      </View>
    </View>
  )
}

export default Index
