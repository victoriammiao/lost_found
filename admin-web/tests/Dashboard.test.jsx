import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import Dashboard from '../src/pages/Dashboard'
import { getStatsOverview, getStatsTrend, getStatsDistribution } from '../src/utils/api'

// 模拟依赖
vi.mock('../src/utils/api')
vi.mock('echarts-for-react', () => ({
  default: () => <div data-testid="mock-chart" />,
}))

describe('Dashboard 组件', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应该显示加载状态', () => {
    getStatsOverview.mockReturnValue(new Promise(() => {}))
    getStatsTrend.mockReturnValue(new Promise(() => {}))
    getStatsDistribution.mockReturnValue(new Promise(() => {}))

    render(<Dashboard />)

    expect(screen.getByText('加载中...')).toBeInTheDocument()
  })

  it('应该渲染统计卡片和图表标题', async () => {
    // 模拟 API 响应
    getStatsOverview.mockResolvedValueOnce({
      data: {
        totalItems: 10,
        pendingItems: 2,
        claimedItems: 5,
        totalUsers: 20,
        pendingVerifications: 3,
        pendingClues: 4,
        claimRate: 50,
      },
    })
    getStatsTrend.mockResolvedValueOnce({
      data: { list: [] },
    })
    getStatsDistribution.mockResolvedValueOnce({
      data: {},
    })

    render(<Dashboard />)

    // 等待组件加载完成
    await waitFor(() => {
      expect(getStatsOverview).toHaveBeenCalled()
    })

    // 检查页面标题
    expect(screen.getByText('数据统计')).toBeInTheDocument()
    expect(screen.getByText('刷新')).toBeInTheDocument()

    // 检查统计卡片
    expect(screen.getByText('总发布数')).toBeInTheDocument()
    expect(screen.getByText('待审核物品')).toBeInTheDocument()
    expect(screen.getByText('已认领物品')).toBeInTheDocument()
    expect(screen.getByText('用户总数')).toBeInTheDocument()

    // 检查图表标题
    expect(screen.getByText('近30天发布趋势')).toBeInTheDocument()
    expect(screen.getByText('待处理事项')).toBeInTheDocument()
  })

  it('应该显示待处理事项列表', async () => {
    getStatsOverview.mockResolvedValueOnce({
      data: {
        pendingItems: 5,
        pendingClues: 3,
        pendingVerifications: 2,
        claimRate: 40,
      },
    })
    getStatsTrend.mockResolvedValueOnce({
      data: { list: [] },
    })
    getStatsDistribution.mockResolvedValueOnce({
      data: {},
    })

    render(<Dashboard />)

    await waitFor(() => {
      expect(getStatsOverview).toHaveBeenCalled()
    })

    expect(screen.getByText('待审核物品')).toBeInTheDocument()
    expect(screen.getByText('待处理线索')).toBeInTheDocument()
    expect(screen.getByText('待审认证申请')).toBeInTheDocument()
    expect(screen.getByText('整体认领率')).toBeInTheDocument()
  })
})
