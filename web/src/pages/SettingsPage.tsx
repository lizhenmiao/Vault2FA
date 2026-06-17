import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useVault } from '@/hooks/useVault'
import { getLockTimeoutMinutes, setLockTimeoutMinutes } from '@/storage'

export function SettingsPage() {
  const navigate = useNavigate()
  const { logout } = useVault()
  const [lockTimeout, setLockTimeout] = useState(getLockTimeoutMinutes())
  const [isSaving, setIsSaving] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)

  const handleSave = () => {
    setIsSaving(true)
    setLockTimeoutMinutes(lockTimeout)
    setTimeout(() => {
      setIsSaving(false)
      navigate('/vault')
    }, 300)
  }

  // 确认退出后执行
  const handleLogoutConfirm = async () => {
    await logout()
    navigate('/unlock')
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">设置</h1>
          <Button variant="ghost" onClick={() => navigate('/vault')}>
            返回
          </Button>
        </div>

        {/* 锁定时长设置 */}
        <Card>
          <CardHeader>
            <CardTitle>自动锁定</CardTitle>
            <CardDescription>
              无操作一段时间后自动锁定保险库（清除内存密钥，保留本地数据）
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="lockTimeout">锁定时长（分钟）</Label>
              <div className="flex gap-2">
                {[1, 5, 15, 30].map((min) => (
                  <Button
                    key={min}
                    type="button"
                    variant={lockTimeout === min ? 'default' : 'outline'}
                    onClick={() => setLockTimeout(min)}
                    className="flex-1"
                  >
                    {min} 分钟
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customTimeout">自定义（分钟）</Label>
              <input
                id="customTimeout"
                type="number"
                min="1"
                max="120"
                value={lockTimeout}
                onChange={(e) => setLockTimeout(parseInt(e.target.value) || 5)}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>

            <Button onClick={handleSave} disabled={isSaving} className="w-full">
              {isSaving ? '保存中...' : '保存设置'}
            </Button>
          </CardContent>
        </Card>

        {/* 账户操作 */}
        <Card>
          <CardHeader>
            <CardTitle>账户</CardTitle>
            <CardDescription>管理您的账户和数据</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              onClick={() => setLogoutConfirmOpen(true)}
              className="w-full text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              退出并清除本地数据
            </Button>
            <p className="text-xs text-muted-foreground">
              退出后本地数据将被清除，但云端数据保留。下次登录时从云端恢复。
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 退出确认对话框 */}
      <ConfirmDialog
        open={logoutConfirmOpen}
        onOpenChange={setLogoutConfirmOpen}
        title="确定要退出吗？"
        description="本地数据将被清除，但云端数据不受影响。"
        confirmText="退出"
        cancelText="取消"
        variant="destructive"
        onConfirm={handleLogoutConfirm}
      />
    </div>
  )
}
