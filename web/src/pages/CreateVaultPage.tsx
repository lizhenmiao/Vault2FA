import { useState } from 'react'
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

export function CreateVaultPage() {
  const { createNewVault } = useVault()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // 恢复码弹窗状态
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false)
  const [recoveryCode, setRecoveryCode] = useState('')
  const [completeSetup, setCompleteSetup] = useState<(() => void) | null>(null)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!username.trim()) {
      setError('请输入用户名')
      return
    }

    if (password.length < 8) {
      setError('登录密码至少 8 个字符')
      return
    }

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }

    setIsLoading(true)

    try {
      console.log('开始创建保险库...')
      const result = await createNewVault(username.trim(), password)
      console.log('保险库创建成功，恢复码:', result.recoveryCode ? '已生成' : '未生成')

      if (result.recoveryCode) {
        // 存恢复码到 localStorage（直到用户确认）
        localStorage.setItem('vault_pending_recovery', JSON.stringify({
          recoveryCode: result.recoveryCode,
          username: username.trim(),
          createdAt: Date.now()
        }))

        // 显示恢复码弹窗，保存 completeSetup 函数
        setRecoveryCode(result.recoveryCode)
        setCompleteSetup(() => result.completeSetup)
        setShowRecoveryDialog(true)
      } else {
        throw new Error('恢复码生成失败')
      }
    } catch (error) {
      console.error('创建保险库失败:', error)
      setError(error instanceof Error ? error.message : '创建失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRecoveryConfirm = () => {
    // 清除 localStorage 标记（用户已确认）
    localStorage.removeItem('vault_pending_recovery')

    // 完成设置：设置 isUnlocked 和 hasVault
    completeSetup?.()
    setShowRecoveryDialog(false)
    // 状态设置后，App.tsx 会自动跳转到 /vault
  }

  return (
    <>
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">创建保险库</CardTitle>
            <CardDescription>
              设置用户名和登录密码以保护您的两步验证账户
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">用户名</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="用于派生密钥，换设备时需输入"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">登录密码</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="至少 8 个字符"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">确认密码</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="再次输入密码"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>

              {error && (
                <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                  {error}
                </div>
              )}

              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? '创建中...' : '创建保险库'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* 恢复码弹窗 */}
      {/* 恢复码弹窗 */}
      <RecoveryCodeDialog
        open={showRecoveryDialog}
        recoveryCode={recoveryCode}
        onConfirm={handleRecoveryConfirm}
        confirmButtonText="复制并进入保险库"
      />
    </>
  )
}
