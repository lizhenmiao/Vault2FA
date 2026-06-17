import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import {
  BaseModal,
  BaseModalHeader,
  BaseModalTitle,
  BaseModalDescription,
  BaseModalFooter,
} from '@/components/ui/BaseModal'
import { useVault } from '@/hooks/useVault'
import type { Account } from '@/totp/types'
import { AlertTriangle } from 'lucide-react'

interface DeleteAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: Account | null
}

export function DeleteAccountDialog({
  open,
  onOpenChange,
  account,
}: DeleteAccountDialogProps) {
  const { deleteAccount } = useVault()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleClose = () => {
    setError('')
    onOpenChange(false)
  }

  const handleDelete = async () => {
    if (!account) return

    setError('')
    setIsLoading(true)

    try {
      await deleteAccount(account.id)
      handleClose()
    } catch (error) {
      setError(error instanceof Error ? error.message : '删除失败')
    } finally {
      setIsLoading(false)
    }
  }

  if (!account) return null

  return (
    <BaseModal open={open} onClose={handleClose}>
      <BaseModalHeader>
        <BaseModalTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          删除账户
        </BaseModalTitle>
        <BaseModalDescription>此操作无法撤销</BaseModalDescription>
      </BaseModalHeader>

      <div className="py-4">
        <p className="text-sm text-muted-foreground mb-3">
          确定要删除以下账户吗？
        </p>
        <div className="bg-muted p-3 rounded-md">
          <div className="font-medium">{account.issuer}</div>
          <div className="text-sm text-muted-foreground">{account.label}</div>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
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
        <Button
          type="button"
          variant="destructive"
          onClick={handleDelete}
          disabled={isLoading}
        >
          {isLoading ? '删除中...' : '删除'}
        </Button>
      </BaseModalFooter>
    </BaseModal>
  )
}
