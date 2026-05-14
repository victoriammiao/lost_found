import React, { useState, useEffect } from 'react'
import { Spin, Button, Empty, Tooltip } from 'antd'
import {
  AppstoreOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  UserOutlined,
  ReloadOutlined,
  ArrowUpOutlined,
  LineChartOutlined,
  SafetyCertificateOutlined,
  LinkOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { getStatsOverview, getStatsTrend, getStatsDistribution } from '../utils/api'

// 判断数据数组是否有非零数据
const hasData = (arr) =>
  Array.isArray(arr) && arr.some((d) => Number(d?.value || 0) > 0)

function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState({})
  const [trend, setTrend] = useState({})
  const [distribution, setDistribution] = useState({})

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      // 改为分别 await，单个接口失败时不影响其它数据展示
      const results = await Promise.allSettled([
        getStatsOverview(),
        getStatsTrend({ days: 30 }),
        getStatsDistribution(),
      ])
      setOverview(results[0].status === 'fulfilled' ? (results[0].value.data || {}) : {})
      setTrend(results[1].status === 'fulfilled' ? (results[1].value.data || {}) : {})
      setDistribution(results[2].status === 'fulfilled' ? (results[2].value.data || {}) : {})
    } catch (e) {
      console.error('Failed to fetch stats:', e)
    } finally {
      setLoading(false)
    }
  }

  // ---------- 图表配置 ----------
  const getTrendOption = () => {
    const list = Array.isArray(trend.list) ? trend.list : []
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
      },
      legend: {
        data: ['总发布', '寻物', '招领'],
        bottom: 0,
      },
      grid: { left: 40, right: 24, top: 20, bottom: 40 },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: list.map((item) => (item.date || '').slice(5)),
        axisLine: { lineStyle: { color: '#d9d9d9' } },
        axisLabel: { color: '#8c8c8c', fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#8c8c8c', fontSize: 11 },
        splitLine: { lineStyle: { type: 'dashed', color: '#f0f0f0' } },
      },
      series: [
        {
          name: '总发布',
          type: 'line',
          data: list.map((item) => item.total || 0),
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          itemStyle: { color: '#1890ff' },
          areaStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(24,144,255,0.25)' },
                { offset: 1, color: 'rgba(24,144,255,0)' },
              ],
            },
          },
        },
        {
          name: '寻物',
          type: 'line',
          data: list.map((item) => item.lost || 0),
          smooth: true,
          symbol: 'circle',
          symbolSize: 5,
          itemStyle: { color: '#13c2c2' },
        },
        {
          name: '招领',
          type: 'line',
          data: list.map((item) => item.found || 0),
          smooth: true,
          symbol: 'circle',
          symbolSize: 5,
          itemStyle: { color: '#eb2f96' },
        },
      ],
    }
  }

  const getPieOption = (data, colors) => ({
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, left: 'center', itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 12 } },
    series: [
      {
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['50%', '42%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        labelLine: { show: false },
        data: (data || []).map((d, i) => ({
          ...d,
          itemStyle: { color: colors[i % colors.length] },
        })),
      },
    ],
  })

  const POST_TYPE_COLORS = ['#1890ff', '#eb2f96']
  const REVIEW_COLORS = ['#faad14', '#52c41a', '#f5222d']
  const CLAIM_COLORS = ['#2f54eb', '#13c2c2']
  const VERIFY_COLORS = ['#52c41a', '#faad14', '#bfbfbf', '#f5222d']

  // ---------- 渲染辅助 ----------
  const renderPieCard = (title, data, colors) => (
    <div className="chart-card">
      <h3>{title}</h3>
      {hasData(data) ? (
        <ReactECharts option={getPieOption(data, colors)} style={{ height: 240 }} />
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无数据"
          style={{ padding: '40px 0' }}
        />
      )}
    </div>
  )

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" tip="加载中..." />
      </div>
    )
  }

  const trendList = Array.isArray(trend.list) ? trend.list : []
  const hasTrendData = trendList.some((item) => (item.total || 0) > 0)

  return (
    <div>
      <div className="page-header">
        <h2>数据统计</h2>
        <Tooltip title="刷新数据">
          <Button icon={<ReloadOutlined />} onClick={fetchData}>
            刷新
          </Button>
        </Tooltip>
      </div>

      {/* 统计卡片 */}
      <div className="stat-cards">
        <div className="stat-card" style={{ '--stat-color': '#1890ff' }}>
          <div className="stat-icon" style={{ background: '#e6f7ff', color: '#1890ff' }}>
            <AppstoreOutlined />
          </div>
          <div className="stat-content">
            <h3>{overview.totalItems || 0}</h3>
            <p>总发布数</p>
            <div className="stat-extra">
              已通过 {overview.approvedItems || 0}
            </div>
          </div>
        </div>

        <div className="stat-card" style={{ '--stat-color': '#fa8c16' }}>
          <div className="stat-icon" style={{ background: '#fff7e6', color: '#fa8c16' }}>
            <ClockCircleOutlined />
          </div>
          <div className="stat-content">
            <h3>{overview.pendingItems || 0}</h3>
            <p>待审核物品</p>
            <div className="stat-extra" style={{ color: '#fa8c16' }}>
              需尽快处理
            </div>
          </div>
        </div>

        <div className="stat-card" style={{ '--stat-color': '#52c41a' }}>
          <div className="stat-icon" style={{ background: '#f6ffed', color: '#52c41a' }}>
            <CheckCircleOutlined />
          </div>
          <div className="stat-content">
            <h3>{overview.claimedItems || 0}</h3>
            <p>已认领物品</p>
            <div className="stat-extra" style={{ color: '#52c41a' }}>
              <ArrowUpOutlined /> 认领率 {overview.claimRate || 0}%
            </div>
          </div>
        </div>

        <div className="stat-card" style={{ '--stat-color': '#2f54eb' }}>
          <div className="stat-icon" style={{ background: '#f0f5ff', color: '#2f54eb' }}>
            <UserOutlined />
          </div>
          <div className="stat-content">
            <h3>{overview.totalUsers || 0}</h3>
            <p>用户总数</p>
            <div className="stat-extra" style={{ color: '#2f54eb' }}>
              待审认证 {overview.pendingVerifications || 0}
            </div>
          </div>
        </div>
      </div>

      {/* 趋势图 + 待办 */}
      <div className="charts-grid">
        <div className="chart-card">
          <h3>
            <LineChartOutlined style={{ color: '#1890ff' }} />
            近30天发布趋势
          </h3>
          {hasTrendData ? (
            <ReactECharts option={getTrendOption()} style={{ height: 320 }} />
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="近30天暂无发布数据"
              style={{ padding: '80px 0' }}
            />
          )}
        </div>

        <div className="chart-card">
          <h3>
            <ClockCircleOutlined style={{ color: '#fa8c16' }} />
            待处理事项
          </h3>
          <ul className="todo-list">
            <li className="todo-item">
              <span className="todo-item-label">
                <ClockCircleOutlined style={{ color: '#fa8c16' }} />
                待审核物品
              </span>
              <span className="todo-item-value" style={{ color: '#fa8c16' }}>
                {overview.pendingItems || 0}
              </span>
            </li>
            <li className="todo-item">
              <span className="todo-item-label">
                <LinkOutlined style={{ color: '#1890ff' }} />
                待处理线索
              </span>
              <span className="todo-item-value" style={{ color: '#1890ff' }}>
                {overview.pendingClues || 0}
              </span>
            </li>
            <li className="todo-item">
              <span className="todo-item-label">
                <SafetyCertificateOutlined style={{ color: '#52c41a' }} />
                待审认证申请
              </span>
              <span className="todo-item-value" style={{ color: '#52c41a' }}>
                {overview.pendingVerifications || 0}
              </span>
            </li>
            <li className="todo-item">
              <span className="todo-item-label">
                <CheckCircleOutlined style={{ color: '#13c2c2' }} />
                整体认领率
              </span>
              <span className="todo-item-value" style={{ color: '#13c2c2' }}>
                {overview.claimRate || 0}%
              </span>
            </li>
          </ul>
        </div>
      </div>

      {/* 分布饼图 */}
      <div className="charts-grid-pies">
        {renderPieCard('物品类型分布', distribution.postType, POST_TYPE_COLORS)}
        {renderPieCard('审核状态分布', distribution.reviewStatus, REVIEW_COLORS)}
        {renderPieCard('认领状态分布', distribution.claimStatus, CLAIM_COLORS)}
        {renderPieCard('用户认证分布', distribution.userVerify, VERIFY_COLORS)}
      </div>
    </div>
  )
}

export default Dashboard
