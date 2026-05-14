import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ItemList from './pages/ItemList'
import UserList from './pages/UserList'
import ClueList from './pages/ClueList'
import StudentVerify from './pages/StudentVerify'
import { getAdminToken } from './utils/auth'

function App() {
  const [token, setToken] = useState(getAdminToken())

  // 监听 localStorage 变化
  useEffect(() => {
    const handleStorageChange = () => {
      setToken(getAdminToken())
    }
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  return (
    <Routes>
      <Route path="/login" element={token ? <Navigate to="/" /> : <Login />} />
      <Route
        path="/*"
        element={
          token ? (
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/items" element={<ItemList />} />
                <Route path="/users" element={<UserList />} />
                <Route path="/clues" element={<ClueList />} />
                <Route path="/verifications" element={<StudentVerify />} />
              </Routes>
            </Layout>
          ) : (
            <Navigate to="/login" />
          )
        }
      />
    </Routes>
  )
}

export default App
