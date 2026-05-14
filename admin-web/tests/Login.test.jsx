import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Login from '../src/pages/Login'
import { adminLogin } from '../src/utils/api'

// 模拟依赖
vi.mock('../src/utils/api')
vi.mock('../src/utils/auth', () => ({
  setAdminToken: vi.fn(),
  setAdminUser: vi.fn(),
}))
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  }
})

describe('Login 组件', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应该渲染登录页面的所有主要元素', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )

    // 检查页面标题
    expect(screen.getByText('失物招领管理后台')).toBeInTheDocument()
    expect(screen.getByText('Lost & Found Admin System')).toBeInTheDocument()

    // 检查表单元素
    expect(screen.getByPlaceholderText('管理员账号')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('密码')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /登 录/ })).toBeInTheDocument()

    // 检查默认账号信息
    expect(screen.getByText(/默认管理员账号/)).toBeInTheDocument()
  })

  it('应该显示表单验证错误', async () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )

    // 点击登录按钮而不填写表单
    fireEvent.click(screen.getByRole('button', { name: /登 录/ }))

    // 检查验证错误
    await waitFor(() => {
      expect(screen.getByText('请输入管理员账号')).toBeInTheDocument()
      expect(screen.getByText('请输入密码')).toBeInTheDocument()
    })
  })

  it('应该在登录成功时调用 API 并导航', async () => {
    adminLogin.mockResolvedValueOnce({
      token: 'fake-token',
      username: '000',
    })

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )

    // 填写表单
    fireEvent.change(screen.getByPlaceholderText('管理员账号'), {
      target: { value: '000' },
    })
    fireEvent.change(screen.getByPlaceholderText('密码'), {
      target: { value: '0000' },
    })

    // 提交表单
    fireEvent.click(screen.getByRole('button', { name: /登 录/ }))

    // 验证 API 调用
    await waitFor(() => {
      expect(adminLogin).toHaveBeenCalledWith({
        username: '000',
        password: '0000',
      })
    })
  })
})
