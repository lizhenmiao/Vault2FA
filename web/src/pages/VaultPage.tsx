import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card'
import { AddAccountDialog } from '@/components/AddAccountDialog'
import { EditAccountDialog } from '@/components/EditAccountDialog'
import { DeleteAccountDialog } from '@/components/DeleteAccountDialog'
import { ExportQRDialog } from '@/components/ExportQRDialog'
import { useVault } from '@/hooks/useVault'
import { useAutoLock } from '@/hooks/useAutoLock'
import { getLockTimeoutMinutes } from '@/storage'
import { generateTOTP, filterActiveAccounts, sortAccounts, searchAccounts } from '@/totp'
import type { Account } from '@/totp/types'
import type { TOTPToken } from '@/totp/types'
import { useBrandIcon } from '@/utils/brandIcons'
import {
  Plus,
  Search,
  Copy,
  MoreVertical,
  Pencil,
  Trash2,
  QrCode,
  RefreshCw,
  Lock,
  Settings,
  Cloud,
  CloudOff,
} from 'lucide-react'

export function VaultPage() {
  const navigate = useNavigate()
  const { accounts, isUnlocked, lock, sync, syncStatus } = useVault()
  const [tokens, setTokens] = useState<Map<string, TOTPToken>>(new Map())
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [exportQRDialogOpen, setExportQRDialogOpen] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)

  // 自动锁定（读取用户配置的时长）
  const lockTimeoutMinutes = getLockTimeoutMinutes()
  useAutoLock(lock, lockTimeoutMinutes, isUnlocked)

  // Redirect to unlock if not unlocked
  useEffect(() => {
    if (!isUnlocked) {
      navigate('/unlock')
    }
  }, [isUnlocked, navigate])

  // Generate tokens for all accounts
  useEffect(() => {
    const generateTokens = () => {
      const activeAccounts = filterActiveAccounts(accounts)
      const newTokens = new Map<string, TOTPToken>()

      for (const account of activeAccounts) {
        try {
          const token = generateTOTP(account)
          newTokens.set(account.id, token)
        } catch (error) {
          console.error(`Failed to generate token [${account.issuer}]:`, error)
        }
      }

      setTokens(newTokens)
    }

    generateTokens()
    const interval = setInterval(generateTokens, 1000)

    return () => clearInterval(interval)
  }, [accounts])

  const handleCopy = async (accountId: string, token: string) => {
    await navigator.clipboard.writeText(token)
    setCopiedId(accountId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleEdit = (account: Account) => {
    setSelectedAccount(account)
    setEditDialogOpen(true)
    setMenuOpenId(null)
  }

  const handleDelete = (account: Account) => {
    setSelectedAccount(account)
    setDeleteDialogOpen(true)
    setMenuOpenId(null)
  }

  const handleExportQR = (account: Account) => {
    setSelectedAccount(account)
    setExportQRDialogOpen(true)
    setMenuOpenId(null)
  }

  const handleSync = async () => {
    try {
      await sync()
    } catch (error) {
      console.error('Sync failed:', error)
    }
  }

  const activeAccounts = filterActiveAccounts(accounts)
  const filteredAccounts = searchQuery
    ? searchAccounts(activeAccounts, searchQuery)
    : activeAccounts
  const sortedAccounts = sortAccounts(filteredAccounts)

  if (!isUnlocked) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 顶栏：左侧标题 + 右侧图标按钮 */}
      <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto px-6 py-4 max-w-7xl">
          <div className="flex items-center justify-between">
            {/* 左侧：标题 + 同步状态 */}
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-semibold tracking-tight">2FA</h1>
              {syncStatus.lastSyncAt && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {syncStatus.error ? (
                    <>
                      <CloudOff className="h-3.5 w-3.5 text-destructive" />
                      <span className="text-destructive">{syncStatus.error}</span>
                    </>
                  ) : (
                    <>
                      <Cloud className="h-3.5 w-3.5" />
                      <span>最后同步: {new Date(syncStatus.lastSyncAt).toLocaleTimeString()}</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* 右侧：图标按钮 */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSync}
                disabled={syncStatus.isSyncing}
                title="同步"
                className="h-9 w-9"
              >
                <RefreshCw className={`h-4 w-4 ${syncStatus.isSyncing ? 'animate-spin' : ''}`} />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/settings')}
                title="设置"
                className="h-9 w-9"
              >
                <Settings className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={lock}
                title="锁定"
                className="h-9 w-9"
              >
                <Lock className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容区：居中，最大宽度 */}
      <main className="container mx-auto px-6 py-8 max-w-7xl">
        {/* 搜索 + 添加按钮 */}
        <div className="flex gap-3 mb-8">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="搜索账户..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10"
            />
          </div>
          <Button onClick={() => setAddDialogOpen(true)} className="h-10">
            <Plus className="mr-2 h-4 w-4" />
            添加账户
          </Button>
        </div>

        {/* 账户卡片网格 */}
        {sortedAccounts.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                <QrCode className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-lg font-medium mb-2">
                {searchQuery ? '未找到匹配的账户' : '还没有账户'}
              </p>
              <p className="text-sm text-muted-foreground">
                {searchQuery
                  ? '尝试其他关键词或清空搜索'
                  : '点击上方"添加账户"按钮开始使用'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {sortedAccounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                token={tokens.get(account.id)}
                isCopied={copiedId === account.id}
                isMenuOpen={menuOpenId === account.id}
                onCopy={(token) => handleCopy(account.id, token)}
                onToggleMenu={() =>
                  setMenuOpenId(menuOpenId === account.id ? null : account.id)
                }
                onEdit={() => handleEdit(account)}
                onDelete={() => handleDelete(account)}
                onExportQR={() => handleExportQR(account)}
              />
            ))}
          </div>
        )}
      </main>

      <AddAccountDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
      <EditAccountDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        account={selectedAccount}
      />
      <DeleteAccountDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        account={selectedAccount}
      />
      <ExportQRDialog
        open={exportQRDialogOpen}
        onOpenChange={setExportQRDialogOpen}
        account={selectedAccount}
      />

      {menuOpenId && (
        <div className="fixed inset-0 z-0" onClick={() => setMenuOpenId(null)} />
      )}
    </div>
  )
}

/**
 * 账户卡片组件（重设计版：品牌图标 + 精致卡片）
 */
interface AccountCardProps {
  account: Account
  token?: TOTPToken
  isCopied: boolean
  isMenuOpen: boolean
  onCopy: (token: string) => void
  onToggleMenu: () => void
  onEdit: () => void
  onDelete: () => void
  onExportQR: () => void
}

function AccountCard({
  account,
  token,
  isCopied,
  isMenuOpen,
  onCopy,
  onToggleMenu,
  onEdit,
  onDelete,
  onExportQR,
}: AccountCardProps) {
  const brandIcon = useBrandIcon(account.issuer)
  const progress = token ? ((token.period - token.remaining) / token.period) * 100 : 0
  const isExpiringSoon = token && token.remaining <= 5

  return (
    <Card className="relative overflow-hidden hover:shadow-lg transition-shadow group">
      {/* 顶部进度条 */}
      <div
        className={`absolute top-0 left-0 h-1 transition-all ${
          isExpiringSoon ? 'bg-destructive' : 'bg-primary'
        }`}
        style={{ width: `${progress}%` }}
      />

      <CardHeader className="pb-3">
        <div className="flex items-start gap-4">
          {/* 品牌图标（大尺寸，圆形） */}
          <div className="w-12 h-12 flex-shrink-0 rounded-full overflow-hidden ring-1 ring-border">
            {brandIcon}
          </div>

          {/* 服务名 + 账号 */}
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-semibold truncate">
              {account.issuer}
            </CardTitle>
            <CardDescription className="text-xs truncate mt-0.5">
              {account.label}
            </CardDescription>
          </div>

          {/* 更多按钮 */}
          <div className="relative flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onToggleMenu}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>

            {isMenuOpen && (
              <div className="absolute right-0 mt-1 w-40 bg-popover border rounded-lg shadow-lg z-20 overflow-hidden">
                <button
                  className="w-full px-4 py-2.5 text-sm text-left hover:bg-accent transition-colors flex items-center gap-3"
                  onClick={onExportQR}
                >
                  <QrCode className="h-4 w-4" />
                  导出二维码
                </button>
                <button
                  className="w-full px-4 py-2.5 text-sm text-left hover:bg-accent transition-colors flex items-center gap-3"
                  onClick={onEdit}
                >
                  <Pencil className="h-4 w-4" />
                  编辑
                </button>
                <div className="border-t" />
                <button
                  className="w-full px-4 py-2.5 text-sm text-left hover:bg-accent text-destructive transition-colors flex items-center gap-3"
                  onClick={onDelete}
                >
                  <Trash2 className="h-4 w-4" />
                  删除
                </button>
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 验证码 + 倒计时 */}
        <div className="flex items-baseline justify-between">
          <div
            className={`font-mono text-3xl font-bold tracking-[0.25em] transition-colors ${
              isExpiringSoon ? 'text-destructive' : ''
            }`}
          >
            {token ? token.token : '••••••'}
          </div>
          <div
            className={`text-sm font-medium tabular-nums transition-colors ${
              isExpiringSoon ? 'text-destructive' : 'text-muted-foreground'
            }`}
          >
            {token ? `${token.remaining}s` : ''}
          </div>
        </div>

        {/* 复制按钮 */}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => token && onCopy(token.token)}
          disabled={!token}
        >
          <Copy className="mr-2 h-3.5 w-3.5" />
          {isCopied ? '已复制' : '复制'}
        </Button>
      </CardContent>
    </Card>
  )
}
