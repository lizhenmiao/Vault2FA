import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { useVault } from '@/hooks/useVault'

/**
 * 重置密码页面
 *
 * 流程：
 * 1. 输入恢复码
 * 2. 输入新的登录密码
 * 3. 用恢复码解密 DEK，用新密码重新包裹
 * 4. 更新 vault 并推送到后端
 * 5. 跳转到 unlock 页面让用户重新登录
 */
export function ResetPasswordPage() {
  const navigate = useNavigate()
  const { resetPasswordWithRecovery } = useVault()

  const [recoveryCode, setRecoveryCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // 验证恢复码格式（16 个字符 + 3 个连字符）
    const cleanCode = recoveryCode.trim().toUpperCase()
    if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(cleanCode)) {
      setError('恢复码格式错误（应为 XXXX-XXXX-XXXX-XXXX）')
      return
    }

    // 验证新密码长度
    if (newPassword.length < 8) {
      setError('新密码至少 8 个字符')
      return
    }

    // 验证两次密码一致
    if (newPassword !== confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }

    setIsLoading(true)

    try {
      await resetPasswordWithRecovery(cleanCode, newPassword)
      // 重置成功，跳转到 unlock 页面让用户重新登录
      navigate('/unlock')
    } catch (error) {
      console.error('重置密码失败:', error)
      setError(error instanceof Error ? error.message : '重置失败，请检查恢复码是否正确')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">重置登录密码</CardTitle>
          <CardDescription>
            使用恢复码重置您的登录密码
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="recovery">恢复码</Label>
              <Input
                id="recovery"
                type="text"
                placeholder="XXXX-XXXX-XXXX-XXXX"
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value)}
                disabled={isLoading}
                required
                autoFocus
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                创建保险库时显示的恢复码（16 个字符）
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">新的登录密码</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="至少 8 个字符"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">确认新密码</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="再次输入新密码"
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

            <div className="flex flex-col gap-2">
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? '重置中...' : '重置密码'}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate('/unlock')}
                disabled={isLoading}
              >
                返回登录
              </Button>
            </div>
          </form>

          <div className="mt-6 p-4 bg-muted rounded-lg text-sm space-y-2">
            <p className="font-semibold">⚠️ 重要提示</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>恢复码仅在创建保险库时显示一次</li>
              <li>重置后将用新密码重新加密所有数据</li>
              <li>重置成功后请牢记新密码</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
