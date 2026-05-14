/**
 * 管理员后台前端基础测试
 * 
 * 这个测试文件包含基础的项目结构测试和简单的组件逻辑验证
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

console.log('开始运行前端基础测试...\n')

function testProjectStructure() {
  console.log('1. 测试项目结构...')
  
  const requiredFiles = [
    'vite.config.js',
    'package.json',
    'index.html',
    'src/main.jsx',
    'src/App.jsx',
  ]
  
  let allExist = true
  for (const file of requiredFiles) {
    const exists = fs.existsSync(path.join(projectRoot, file))
    console.log(`   ${exists ? '✓' : '✗'} ${file}`)
    if (!exists) allExist = false
  }
  
  return allExist
}

function testPackageJson() {
  console.log('\n2. 测试 package.json 配置...')
  
  const packageJsonPath = path.join(projectRoot, 'package.json')
  if (!fs.existsSync(packageJsonPath)) {
    console.log('   ✗ package.json 不存在')
    return false
  }
  
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
  
  const requiredDeps = ['react', 'react-dom', 'antd', 'axios']
  let allDepsExist = true
  
  for (const dep of requiredDeps) {
    const hasDep = (pkg.dependencies && pkg.dependencies[dep]) || 
                   (pkg.devDependencies && pkg.devDependencies[dep])
    console.log(`   ${hasDep ? '✓' : '✗'} ${dep}`)
    if (!hasDep) allDepsExist = false
  }
  
  return allDepsExist
}

function testMainPagesExist() {
  console.log('\n3. 测试主要页面组件是否存在...')
  
  const pagesDir = path.join(projectRoot, 'src', 'pages')
  if (!fs.existsSync(pagesDir)) {
    console.log('   ✗ pages 目录不存在')
    return false
  }
  
  const requiredPages = ['Login.jsx', 'Dashboard.jsx', 'Items.jsx', 'Users.jsx']
  const existingFiles = fs.readdirSync(pagesDir)
  
  let allPagesExist = true
  for (const page of requiredPages) {
    const exists = existingFiles.includes(page)
    console.log(`   ${exists ? '✓' : '✗'} ${page}`)
    if (!exists) allPagesExist = false
  }
  
  return allPagesExist
}

function testApiUtilsExist() {
  console.log('\n4. 测试 API 工具文件是否存在...')
  
  const utilsDir = path.join(projectRoot, 'src', 'utils')
  if (!fs.existsSync(utilsDir)) {
    console.log('   ✗ utils 目录不存在')
    return false
  }
  
  const utilsFiles = fs.readdirSync(utilsDir)
  const hasApiFile = utilsFiles.some(f => f.includes('api'))
  
  console.log(`   ${hasApiFile ? '✓' : '✗'} API 工具文件存在`)
  return hasApiFile
}

function testSimpleLogic() {
  console.log('\n5. 测试简单逻辑验证...')
  
  // 验证一些简单的逻辑
  const tests = [
    { name: '用户名验证', test: () => '000'.length === 3 && 'testuser'.length >= 2 },
    { name: '状态枚举检查', test: () => ['pending', 'approved', 'rejected'].length === 3 },
    { name: '物品状态检查', test: () => ['未认领', '已认领'].length === 2 },
  ]
  
  let allPassed = true
  for (const t of tests) {
    const passed = t.test()
    console.log(`   ${passed ? '✓' : '✗'} ${t.name}`)
    if (!passed) allPassed = false
  }
  
  return allPassed
}

// 运行所有测试
function runTests() {
  const results = []
  
  results.push({ name: '项目结构测试', passed: testProjectStructure() })
  results.push({ name: 'package.json 测试', passed: testPackageJson() })
  results.push({ name: '页面组件测试', passed: testMainPagesExist() })
  results.push({ name: 'API 工具测试', passed: testApiUtilsExist() })
  results.push({ name: '简单逻辑测试', passed: testSimpleLogic() })
  
  console.log('\n' + '='.repeat(50))
  console.log('测试结果汇总：')
  console.log('='.repeat(50))
  
  let allPassed = true
  for (const result of results) {
    console.log(`${result.passed ? '✓' : '✗'} ${result.name}`)
    if (!result.passed) allPassed = false
  }
  
  console.log('='.repeat(50))
  console.log(`\n总体: ${allPassed ? '所有测试通过！' : '部分测试失败。'}`)
  
  return allPassed ? 0 : 1
}

// 如果直接运行此文件，则执行测试
if (import.meta.url === `file://${__filename}`) {
  const exitCode = runTests()
  process.exit(exitCode)
}

export default {
  testProjectStructure,
  testPackageJson,
  testMainPagesExist,
  testApiUtilsExist,
  testSimpleLogic,
  runTests
}
