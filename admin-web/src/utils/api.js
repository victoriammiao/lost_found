import request from './request'

// 管理员认证
export const adminLogin = (data) => request.post('/admin/login', data)
export const adminLogout = () => request.post('/admin/logout')
export const adminCheck = () => request.get('/admin/check')

// 用户管理
export const getUsers = (params) => request.get('/admin/users', { params })
export const getUserItems = (username, params) => request.get(`/admin/users/${username}/items`, { params })
export const banUser = (username) => request.post(`/admin/users/${username}/ban`)
export const unbanUser = (username) => request.post(`/admin/users/${username}/unban`)

// 物品管理
export const getItems = (params) => request.get('/admin/items', { params })
export const updateItem = (id, data) => request.put(`/admin/items/${id}`, data)
export const reviewItem = (id, action) => request.put(`/admin/items/${id}/review`, { action })
export const batchReviewItems = (ids, action) => request.post('/admin/items/batch/review', { ids, action })
export const batchDeleteItems = (ids) => request.post('/admin/items/batch/delete', { ids })

// 线索管理
export const getAllClues = (params) => request.get('/admin/clues/all', { params })
export const getClue = (id) => request.get(`/admin/clues/${id}`)
export const matchClue = (id) => request.post(`/admin/clues/match`, { id })
export const rejectClue = (id) => request.post(`/admin/clues/reject`, { id })

// 数据统计
export const getStatsOverview = () => request.get('/admin/stats/overview')
export const getStatsTrend = (params) => request.get('/admin/stats/trend', { params })
export const getStatsDistribution = () => request.get('/admin/stats/distribution')

// 学生认证
export const getVerifications = (params) => request.get('/admin/student-verifications', { params })
export const approveVerification = (username) => request.post('/admin/student-verifications/approve', { username })
export const rejectVerification = (username) => request.post('/admin/student-verifications/reject', { username })
export const batchVerify = (usernames, action) => request.post('/admin/student-verifications/batch', { usernames, action })
