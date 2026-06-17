import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { VaultProvider, useVault } from '@/hooks/useVault'
import { CreateVaultPage } from '@/pages/CreateVaultPage'
import { UnlockPage } from '@/pages/UnlockPage'
import { ResetPasswordPage } from '@/pages/ResetPasswordPage'
import { VaultPage } from '@/pages/VaultPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { useEffect, useState } from 'react'

function CryptoCheck({ children }: { children: React.ReactNode }) {
  const [isSupported, setIsSupported] = useState(true)

  useEffect(() => {
    // 检查 crypto.subtle 是否可用
    if (!window.crypto || !window.crypto.subtle) {
      setIsSupported(false)
    }
  }, [])

  if (!isSupported) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold text-destructive">不支持的环境</h1>
          <p className="text-muted-foreground">
            此应用需要安全上下文（HTTPS 或 localhost）才能运行。
          </p>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>• 如果在本地开发，请使用 localhost 访问</p>
            <p>• 如果在局域网访问，请配置 HTTPS 证书</p>
            <p>• 生产环境请部署到 HTTPS 域名</p>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

function AppRoutes() {
  const { hasVault, isUnlocked, isLoading } = useVault()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    )
  }

  // 没有保险库：只能去创建页
  if (!hasVault) {
    return (
      <Routes>
        <Route path="/create" element={<CreateVaultPage />} />
        <Route path="*" element={<Navigate to="/create" replace />} />
      </Routes>
    )
  }

  // 有保险库但未解锁：可以去解锁页或重置密码页
  if (!isUnlocked) {
    return (
      <Routes>
        <Route path="/unlock" element={<UnlockPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="*" element={<Navigate to="/unlock" replace />} />
      </Routes>
    )
  }

  // 已解锁：可访问主界面和设置
  return (
    <Routes>
      <Route path="/vault" element={<VaultPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="/vault" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <CryptoCheck>
      <BrowserRouter>
        <VaultProvider>
          <AppRoutes />
        </VaultProvider>
      </BrowserRouter>
    </CryptoCheck>
  )
}

export default App
