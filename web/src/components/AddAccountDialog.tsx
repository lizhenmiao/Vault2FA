import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import {
  BaseModal,
  BaseModalHeader,
  BaseModalTitle,
  BaseModalDescription,
  BaseModalFooter,
} from '@/components/ui/BaseModal'
import { ToastNotification, useToast } from '@/components/ui/Toast'
import { QRScannerFullscreen } from './QRScannerFullscreen'
import { ImportProgressDialog } from './ImportProgressDialog'
import { useVault } from '@/hooks/useVault'
import {
  parseOTPAuthURI,
  createAccountFromParsed,
  isValidBase32Secret,
  generateUUID,
  parseGoogleMigrationURI,
  isGoogleMigrationURI,
  filterActiveAccounts,
} from '@/totp'
import type { Account } from '@/totp/types'
import { Camera } from 'lucide-react'

interface AddAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddAccountDialog({ open, onOpenChange }: AddAccountDialogProps) {
  const { addAccount, addAccountsBatch, accounts } = useVault()
  const { toast, showToast, hideToast } = useToast()
  const [mode, setMode] = useState<'uri' | 'manual'>('uri')
  const [uri, setUri] = useState('')
  const [issuer, setIssuer] = useState('')
  const [label, setLabel] = useState('')
  const [secret, setSecret] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)

  // 批量导入进度
  const [importProgress, setImportProgress] = useState<{
    total: number
    current: number
    currentName: string
  } | null>(null)

  const resetForm = () => {
    setUri('')
    setIssuer('')
    setLabel('')
    setSecret('')
    setError('')
    setMode('uri')
    setImportProgress(null)
  }

  const handleClose = () => {
    resetForm()
    onOpenChange(false)
  }

  // 扫码成功后自动添加账户
  const handleScan = async (data: string) => {
    try {
      setIsLoading(true)

      const trimmedUri = data.trim()
      console.log('[扫码] 原始数据:', data)
      console.log('[扫码] 裁剪后数据:', trimmedUri)

      // 只检查活跃账户（排除已删除）
      const activeAccounts = filterActiveAccounts(accounts)
      console.log('[扫码] 活跃账户数:', activeAccounts.length, '总账户数:', accounts.length)

      // 检测是否为 Google Authenticator 批量导出
      if (isGoogleMigrationURI(trimmedUri)) {
        console.log('[扫码] 检测到 Google 批量导出 URI')
        const parsedAccounts = parseGoogleMigrationURI(trimmedUri)
        console.log('[扫码] 解析到账户数量:', parsedAccounts.length)
        console.log('[扫码] 解析结果:', parsedAccounts)

        // 关闭扫码界面和添加对话框
        setScannerOpen(false)
        onOpenChange(false)

        // 等待对话框关闭动画完成
        await new Promise(resolve => setTimeout(resolve, 100))

        const accountsToAdd: Account[] = []
        let skippedCount = 0

        // 初始化进度
        setImportProgress({
          total: parsedAccounts.length,
          current: 0,
          currentName: '',
        })

        // 批量处理所有账户（先收集，不立即同步）
        for (let i = 0; i < parsedAccounts.length; i++) {
          const parsed = parsedAccounts[i]
          console.log('[扫码] 处理账户:', parsed)
          const account = createAccountFromParsed(parsed)
          console.log('[扫码] 创建账户对象:', account)

          // 更新进度
          setImportProgress({
            total: parsedAccounts.length,
            current: i + 1,
            currentName: account.issuer,
          })

          // 检查重复（只检查活跃账户）
          const isDuplicate = activeAccounts.some(a => a.secret === account.secret)
          console.log('[扫码] 是否重复:', isDuplicate, 'secret:', account.secret)

          if (isDuplicate) {
            skippedCount++
          } else {
            accountsToAdd.push(account)
          }

          // 给用户一点时间看到进度
          await new Promise(resolve => setTimeout(resolve, 100))
        }

        // 统一添加所有账户（只同步一次）
        if (accountsToAdd.length > 0) {
          console.log('[扫码] 批量添加账户:', accountsToAdd.length)
          await addAccountsBatch(accountsToAdd)
        }

        setImportProgress(null)
        console.log('[扫码] 批量添加完成, 成功:', accountsToAdd.length, '跳过:', skippedCount)

        // 成功提示
        if (accountsToAdd.length > 0 && skippedCount > 0) {
          showToast({ type: 'success', message: `成功添加 ${accountsToAdd.length} 个账户，跳过 ${skippedCount} 个重复` })
        } else if (accountsToAdd.length > 0) {
          showToast({ type: 'success', message: `成功添加 ${accountsToAdd.length} 个账户` })
        } else {
          showToast({ type: 'warning', message: `所有账户已存在，跳过添加` })
        }
        handleClose()
        return
      }

      // 标准单账户 URI
      console.log('[扫码] 检测到标准单账户 URI')
      const parsed = parseOTPAuthURI(trimmedUri)
      console.log('[扫码] 解析结果:', parsed)

      const account = createAccountFromParsed(parsed)
      console.log('[扫码] 创建账户对象:', account)

      // 检查重复（只检查活跃账户）
      const isDuplicate = activeAccounts.some(a => a.secret === account.secret)
      console.log('[扫码] 是否重复:', isDuplicate, 'secret:', account.secret)

      if (isDuplicate) {
        showToast({ type: 'warning', message: '该账户已存在，跳过添加' })
        handleClose()
        return
      }

      await addAccount(account)
      console.log('[扫码] 添加成功')
      showToast({ type: 'success', message: '添加成功' })
      handleClose()
    } catch (error) {
      console.error('[扫码] 错误:', error)
      showToast({ type: 'error', message: error instanceof Error ? error.message : '扫码添加失败' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      // 只检查活跃账户（排除已删除）
      const activeAccounts = filterActiveAccounts(accounts)
      console.log('[手动输入] 活跃账户数:', activeAccounts.length, '总账户数:', accounts.length)

      if (mode === 'uri') {
        // 从 URI 解析
        console.log('[手动输入-URI] 开始处理')
        if (!uri.trim()) {
          throw new Error('请输入 otpauth URI')
        }

        const trimmedUri = uri.trim()
        console.log('[手动输入-URI] URI:', trimmedUri)

        // 检测是否为 Google Authenticator 批量导出
        if (isGoogleMigrationURI(trimmedUri)) {
          console.log('[手动输入-URI] 检测到 Google 批量导出')
          const parsedAccounts = parseGoogleMigrationURI(trimmedUri)
          console.log('[手动输入-URI] 解析到账户数量:', parsedAccounts.length)
          console.log('[手动输入-URI] 解析结果:', parsedAccounts)

          // 先关闭当前对话框，避免遮挡进度弹窗
          onOpenChange(false)

          // 等待对话框关闭动画完成
          await new Promise(resolve => setTimeout(resolve, 100))

          const accountsToAdd: Account[] = []
          let skippedCount = 0

          // 初始化进度
          setImportProgress({
            total: parsedAccounts.length,
            current: 0,
            currentName: '',
          })

          // 批量处理所有账户（先收集，不立即同步）
          for (let i = 0; i < parsedAccounts.length; i++) {
            const parsed = parsedAccounts[i]
            const account = createAccountFromParsed(parsed)
            console.log('[手动输入-URI] 处理账户:', account)

            // 更新进度
            setImportProgress({
              total: parsedAccounts.length,
              current: i + 1,
              currentName: account.issuer,
            })

            // 检查重复（只检查活跃账户）
            const isDuplicate = activeAccounts.some(a => a.secret === account.secret)
            console.log('[手动输入-URI] 是否重复:', isDuplicate, 'secret:', account.secret)

            if (isDuplicate) {
              skippedCount++
            } else {
              accountsToAdd.push(account)
            }

            // 给用户一点时间看到进度
            await new Promise(resolve => setTimeout(resolve, 100))
          }

          // 统一添加所有账户（只同步一次）
          if (accountsToAdd.length > 0) {
            console.log('[手动输入-URI] 批量添加账户:', accountsToAdd.length)
            await addAccountsBatch(accountsToAdd)
          }

          setImportProgress(null)
          console.log('[手动输入-URI] 批量完成, 成功:', accountsToAdd.length, '跳过:', skippedCount)

          // 成功提示
          if (accountsToAdd.length > 0 && skippedCount > 0) {
            showToast({ type: 'success', message: `成功添加 ${accountsToAdd.length} 个账户，跳过 ${skippedCount} 个重复` })
          } else if (accountsToAdd.length > 0) {
            showToast({ type: 'success', message: `成功添加 ${accountsToAdd.length} 个账户` })
          } else {
            showToast({ type: 'warning', message: `所有账户已存在，跳过添加` })
          }
          handleClose()
          return
        }

        // 标准单账户 URI
        console.log('[手动输入-URI] 标准单账户 URI')
        const parsed = parseOTPAuthURI(trimmedUri)
        console.log('[手动输入-URI] 解析结果:', parsed)

        const account = createAccountFromParsed(parsed)
        console.log('[手动输入-URI] 创建账户:', account)

        // 检查重复（只检查活跃账户）
        const isDuplicate = activeAccounts.some(a => a.secret === account.secret)
        console.log('[手动输入-URI] 是否重复:', isDuplicate, 'secret:', account.secret)
        console.log('[手动输入-URI] 活跃账户 secrets:', activeAccounts.map(a => ({ id: a.id, issuer: a.issuer, secret: a.secret })))

        if (isDuplicate) {
          showToast({ type: 'warning', message: '该账户已存在，跳过添加' })
          handleClose()
          return
        }

        await addAccount(account)
        console.log('[手动输入-URI] 添加成功')
        showToast({ type: 'success', message: '添加成功' })
      } else {
        // 手动输入
        console.log('[手动输入-表单] 开始处理')
        console.log('[手动输入-表单] issuer:', issuer, 'label:', label, 'secret:', secret)

        if (!issuer.trim() || !secret.trim()) {
          throw new Error('发行方和密钥为必填项')
        }

        const cleanSecret = secret.trim().toUpperCase().replace(/\s+/g, '')
        console.log('[手动输入-表单] 清理后 secret:', cleanSecret)

        if (!isValidBase32Secret(cleanSecret)) {
          throw new Error('密钥格式错误（需要 Base32 编码，至少 16 个字符）')
        }

        const account: Account = {
          id: generateUUID(),
          issuer: issuer.trim(),
          label: label.trim() || issuer.trim(),
          secret: cleanSecret,
          algorithm: 'SHA1',
          digits: 6,
          period: 30,
          type: 'totp',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          deletedAt: null,
        }

        console.log('[手动输入-表单] 创建账户:', account)

        // 检查重复（只检查活跃账户）
        const isDuplicate = activeAccounts.some(a => a.secret === account.secret)
        console.log('[手动输入-表单] 是否重复:', isDuplicate, 'secret:', account.secret)
        console.log('[手动输入-表单] 活跃账户 secrets:', activeAccounts.map(a => ({ id: a.id, issuer: a.issuer, secret: a.secret })))

        if (isDuplicate) {
          showToast({ type: 'warning', message: '该账户已存在，跳过添加' })
          handleClose()
          return
        }

        await addAccount(account)
        console.log('[手动输入-表单] 添加成功')
        showToast({ type: 'success', message: '添加成功' })
      }

      handleClose()
    } catch (error) {
      console.error('[手动输入] 错误:', error)
      showToast({ type: 'error', message: error instanceof Error ? error.message : '添加失败' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      {/* 添加账户表单对话框（扫码时隐藏） */}
      <BaseModal open={open && !scannerOpen} onClose={handleClose}>
        <BaseModalHeader>
          <BaseModalTitle>添加账户</BaseModalTitle>
          <BaseModalDescription>
            从 otpauth URI 或手动输入信息添加新的两步验证账户
          </BaseModalDescription>
        </BaseModalHeader>

        <form onSubmit={handleSubmit}>
            {/* 模式切换 */}
            <div className="flex gap-2 mb-4">
              <Button
                type="button"
                variant={mode === 'uri' ? 'default' : 'outline'}
                onClick={() => setMode('uri')}
                disabled={isLoading}
                className="flex-1"
              >
                URI 导入
              </Button>
              <Button
                type="button"
                variant={mode === 'manual' ? 'default' : 'outline'}
                onClick={() => setMode('manual')}
                disabled={isLoading}
                className="flex-1"
              >
                手动输入
              </Button>
            </div>

            {/* URI 模式：扫码为主，粘贴为备选 */}
            {mode === 'uri' && (
              <div className="space-y-5">
                {/* 主方式：放大的相机扫码按钮 */}
                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  disabled={isLoading}
                  className="w-full flex flex-col items-center justify-center gap-3 py-8 rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-accent/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
                    <Camera className="h-8 w-8 text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">扫描二维码</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      实时扫码或从相册选择
                    </p>
                  </div>
                </button>

                {/* 分隔线 */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">或粘贴链接</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* 备选方式：手动粘贴 URI */}
                <div className="space-y-2">
                  <Input
                    id="uri"
                    placeholder="otpauth://totp/..."
                    value={uri}
                    onChange={(e) => setUri(e.target.value)}
                    disabled={isLoading}
                    className="font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground">
                    支持标准 otpauth:// 链接和 Google Authenticator 批量导出链接
                  </p>
                </div>
              </div>
            )}

            {/* 手动输入模式 */}
            {mode === 'manual' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="issuer">
                    发行方 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="issuer"
                    placeholder="GitHub"
                    value={issuer}
                    onChange={(e) => setIssuer(e.target.value)}
                    disabled={isLoading}
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="label">标签（可选）</Label>
                  <Input
                    id="label"
                    placeholder="user@example.com"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="secret">
                    密钥 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="secret"
                    placeholder="JBSWY3DPEHPK3PXP"
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    disabled={isLoading}
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Base32 编码的密钥（通常在二维码下方显示）
                  </p>
                </div>
              </div>
            )}

            {/* 错误提示 */}
            {error && (
              <div className="mt-4 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                {error}
              </div>
            )}

            {/* 底部按钮 */}
            <BaseModalFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isLoading}
              >
                取消
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? '添加中...' : '添加'}
              </Button>
            </BaseModalFooter>
          </form>
      </BaseModal>

      {/* 批量导入进度弹窗（独立显示） */}
      {importProgress && (
        <ImportProgressDialog
          open={!!importProgress}
          total={importProgress.total}
          current={importProgress.current}
          currentName={importProgress.currentName}
        />
      )}

      {/* Toast 通知 */}
      <ToastNotification toast={toast} onClose={hideToast} />

      {/* 全屏扫码（独立渲染，Dialog 外部） */}
      <QRScannerFullscreen
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
      />
    </>
  )
}
