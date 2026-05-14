import axios from 'axios'
import { message } from 'antd'
import { getAdminToken, removeAdminToken } from './auth'

const BASE_URL = '/api'

const request = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
})

// 请求拦截器
request.interceptors.request.use(
  (config) => {
    const token = getAdminToken()
    if (token) {
      config.headers.Authorization = token
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
request.interceptors.response.use(
  (response) => {
    const res = response.data
    if (res.code !== 0) {
      message.error(res.message || '请求失败')
      return Promise.reject(new Error(res.message || '请求失败'))
    }
    return res
  },
  (error) => {
    if (error.response) {
      if (error.response.status === 401) {
        removeAdminToken()
        window.location.href = '/login'
        message.error('登录已过期，请重新登录')
      } else if (error.response.status === 403) {
        message.error('没有权限访问')
      } else {
        message.error(error.response.data?.message || '请求失败')
      }
    } else {
      message.error('网络错误，请检查连接')
    }
    return Promise.reject(error)
  }
)

export default request
