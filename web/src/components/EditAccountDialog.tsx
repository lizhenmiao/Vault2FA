import { useState, useEffect } from 'react'
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
import { useVault } from '@/hooks/useVault'
import { isValidBase32Secret } from '@/totp'
import type { Account } from '@/totp/types'

interface EditAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: Account | null
}

export function EditAccountDialog({
  open,
  onOpenChange,
  account,
}: EditAccountDialogProps) {
  const { updateAccount } = useVault()
  const [issuer, setIssuer] = useState('')
  const [label, setLabel] = useState('')
  const [secret, setSecret] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // 当 account 变化时，更新表单
  useEffect(() => {
    if (account) {
      setIssuer(account.issuer)
      setLabel(account.label)
      setSecret(account.secret)
    }
  }, [account])

  const resetForm = () => {
    setError('')
  }

  const handleClose = () => {
    resetForm()
    onOpenChange(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!account) return

    setError('')
    setIsLoading(true)

    try {
      if (!issuer.trim() || !secret.trim()) {
        throw new Error('发行方和密钥为必填项')
      }

      const cleanSecret = secret.trim().toUpperCase().replace(/\s+/g, '')
      if (!isValidBase32Secret(cleanSecret)) {
        throw new Error('密钥格式错误（需要 Base32 编码，至少 16 个字符）')
      }

      await updateAccount(account.id, {
        issuer: issuer.trim(),
        label: label.trim() || issuer.trim(),
        secret: cleanSecret,
      })

      handleClose()
    } catch (error) {
      setError(error instanceof Error ? error.message : '更新失败')
    } finally {
      setIsLoading(false)
    }
  }

  if (!account) return null

  return (
    <BaseModal open={open} onClose={handleClose}>
      <BaseModalHeader>
        <BaseModalTitle>编辑账户</BaseModalTitle>
        <BaseModalDescription>修改账户的发行方、标签或密钥</BaseModalDescription>
      </BaseModalHeader>

      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-issuer">
              发行方 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-issuer"
              placeholder="GitHub"
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
              disabled={isLoading}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-label">标签（可选）</Label>
            <Input
              id="edit-label"
              placeholder="user@example.com"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-secret">
              密钥 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-secret"
              placeholder="JBSWY3DPEHPK3PXP"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              disabled={isLoading}
              className="font-mono"
            />
          </div>
        </div>

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
              {isLoading ? '保存中...' : '保存'}
            </Button>
          </BaseModalFooter>
        </form>
    </BaseModal>
  )
}
