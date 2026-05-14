import React, { useState, useEffect } from 'react'
import { Row, Col, Card, Statistic, Spin } from 'antd'
import {
  AppstoreOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  UserOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { getStatsOverview, getStatsTrend, getStatsDistribution } from '../utils/api'

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
      const [overviewRes, trendRes, distributionRes] = await Promise.all([
        getStatsOverview(),
        getStatsTrend({ days: 30 }),
        getStatsDistribution(),
      ])
      setOverview(overviewRes.data)
      setTrend(trendRes.data)
      setDistribution(distributionRes.data)
    } catch (e) {
      console.error('Failed to fetch stats:', e)
    } finally {
      setLoading(false)
    }
  }

  const getTrendOption = () => {
    const list = trend.list || []
    return {
      title: {
        text: '近30天发布趋势',
        left: 'center',
      },
      tooltip: {
        trigger: 'axis',
      },
      legend: {
        data: ['总发布', '寻物', '招领'],
        bottom: 0,
      },
      xAxis: {
        type: 'category',
        data: list.map((item) => item.date.slice(5)),
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
      },
      series: [
        {
          name: '总发布',
          type: 'line',
          data: list.map((item) => item.total),
          smooth: true,
          itemStyle: { color: '#1890ff' },
        },
        {
          name: '寻物',
          type: 'line',
          data: list.map((item) => item.lost),
          smooth: true,
          itemStyle: { color: '#13c2c2' },
        },
        {
          name: '招领',
          type: 'line',
          data: list.map((item) => item.found),
          smooth: true,
          itemStyle: { color: '#eb2f96' },
        },
      ],
    }
  }

  const getPostTypeOption = () => {
    const data = distribution.postType || []
    return {
      title: {
        text: '物品类型分布',
        left: 'center',
        top: 10,
      },
      tooltip: {
        trigger: 'item',
      },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          data: data,
          label: {
            formatter: '{b}: {c} ({d}%)',
          },
        },
      ],
    }
  }

  const getReviewStatusOption = () => {
    const data = distribution.reviewStatus || []
    return {
      title: {
        text: '审核状态分布',
        left: 'center',
        top: 10,
      },
      tooltip: {
        trigger: 'item',
      },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          data: data,
          label: {
            formatter: '{b}: {c} ({d}%)',
          },
        },
      ],
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h2>数据统计</h2>
      </div>

      <div className="stat-cards">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#e6f7ff' }}>
            <AppstoreOutlined style={{ color: '#1890ff' }} />
          </div>
          <div className="stat-content">
            <h3>{overview.totalItems || 0}</h3>
            <p>总发布数</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fff7e6' }}>
            <ClockCircleOutlined style={{ color: '#fa8c16' }} />
          </div>
          <div className="stat-content">
            <h3>{overview.pendingItems || 0}</h3>
            <p>待审核数</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#f6ffed' }}>
            <CheckCircleOutlined style={{ color: '#52c41a' }} />
          </div>
          <div className="stat-content">
            <h3>{overview.claimedItems || 0}</h3>
            <p>已认领数 (认领率 {overview.claimRate || 0}%)</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#f0f5ff' }}>
            <UserOutlined style={{ color: '#2f54eb' }} />
          </div>
          <div className="stat-content">
            <h3>{overview.totalUsers || 0}</h3>
            <p>用户总数</p>
          </div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <ReactECharts option={getTrendOption()} style={{ height: 350 }} />
        </div>
        <div className="chart-card">
          <ReactECharts option={getPostTypeOption()} style={{ height: 160 }} />
          <ReactECharts option={getReviewStatusOption()} style={{ height: 160 }} />
        </div>
      </div>

      <Row gutter={16}>
        <Col span={8}>
          <Card size="small" title="待处理事项">
            <Statistic
              title="待审核物品"
              value={overview.pendingItems || 0}
              valueStyle={{ color: '#faad14' }}
            />
            <Statistic
              title="待审核线索"
              value={overview.pendingClues || 0}
              valueStyle={{ color: '#fa8c16' }}
              style={{ marginTop: 16 }}
            />
            <Statistic
              title="待审核认证"
              value={overview.pendingVerifications || 0}
              valueStyle={{ color: '#52c41a' }}
              style={{ marginTop: 16 }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Dashboard
