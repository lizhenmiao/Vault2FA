import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card'
import { RecoveryCodeDialog } from '@/components/RecoveryCodeDialog'
import { useVault } from '@/hooks/useVault'
import { getCachedUsername } from '@/storage'

/**
 * 解锁/登录页面
 *
 * - 有缓存用户名：锁定态解锁（只输密码）
 * - 无缓存用户名：完整登录（输用户名+密码）
 * - 检测 localStorage 中的待确认恢复码，显示弹窗提醒
 */
export function UnlockPage() {
  const navigate = useNavigate()
  const { login, unlock, logout } = useVault()

  // 读取缓存用户名：有则为「锁定态解锁」（只输密码），无则为「完整登录」（输用户名+密码）
  const cachedUsername = getCachedUsername()
  const isLockedMode = cachedUsername !== null

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // 恢复码弹窗状态
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false)
  const [recoveryCode, setRecoveryCode] = useState('')

  // 检测 localStorage 中的待确认恢复码
  useEffect(() => {
    const pending = localStorage.getItem('vault_pending_recovery')
    if (pending) {
      try {
        const { recoveryCode } = JSON.parse(pending)
        setRecoveryCode(recoveryCode)
        setShowRecoveryDialog(true)
      } catch (error) {
        console.error('解析待确认恢复码失败:', error)
        localStorage.removeItem('vault_pending_recovery')
      }
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      if (isLockedMode) {
        // 锁定态解锁：只用密码，用户名从缓存读
        await unlock(password)
      } else {
        // 完整登录：用户名 + 密码
        if (!username.trim()) {
          setError('请输入用户名')
          setIsLoading(false)
          return
        }
        await login(username.trim(), password)
      }
      navigate('/vault')
    } catch (error) {
      setError(error instanceof Error ? error.message : '解锁失败')
    } finally {
      setIsLoading(false)
    }
  }

  // 复制恢复码
  // 确认恢复码
  const handleRecoveryConfirm = () => {
    // 清除 localStorage 标记
    localStorage.removeItem('vault_pending_recovery')
    setShowRecoveryDialog(false)
    // 继续正常登录流程
  }

  // 「不是你？退出」：清除缓存用户名和本地数据，回到完整登录
  const handleLogout = async () => {
    await logout()
    // logout 后 cachedUsername 被清，刷新页面以重置为完整登录态
    window.location.reload()
  }

  return (
    <>
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">
            {isLockedMode ? '解锁保险库' : '登录'}
          </CardTitle>
          <CardDescription>
            {isLockedMode
              ? `欢迎回来，${cachedUsername}`
              : '输入用户名和登录密码'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 完整登录态才显示用户名输入 */}
            {!isLockedMode && (
              <div className="space-y-2">
                <Label htmlFor="username">用户名</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="输入用户名"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                  required
                  autoFocus
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">登录密码</Label>
              <Input
                id="password"
                type="password"
                placeholder="输入登录密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
                autoFocus={isLockedMode}
              />
              <div className="text-right">
                <Link
                  to="/reset-password"
                  className="text-sm text-primary hover:underline"
                >
                  忘记密码？
                </Link>
              </div>
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? '处理中...' : isLockedMode ? '解锁' : '登录'}
              </Button>

              {/* 锁定态显示「不是你？退出」 */}
              {isLockedMode && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleLogout}
                  disabled={isLoading}
                  className="text-muted-foreground text-sm"
                >
                  不是你？退出并清除本地数据
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>

    {/* 恢复码提醒弹窗 */}
    <RecoveryCodeDialog
      open={showRecoveryDialog}
      recoveryCode={recoveryCode}
      onConfirm={handleRecoveryConfirm}
      confirmButtonText="复制并继续登录"
    />
  </>
  )
}
