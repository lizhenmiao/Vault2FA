import { BaseModal, BaseModalHeader, BaseModalTitle, BaseModalDescription, BaseModalFooter } from './BaseModal'
import { Button } from './Button'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive'
  onConfirm: () => void | Promise<void>
}

/**
 * 确认对话框组件
 *
 * 替代原生 confirm()，提供更好的视觉效果和自定义能力
 *
 * 用法：
 * ```tsx
 * const [confirmOpen, setConfirmOpen] = useState(false)
 *
 * <ConfirmDialog
 *   open={confirmOpen}
 *   onOpenChange={setConfirmOpen}
 *   title="确定要退出吗？"
 *   description="本地数据将被清除，但云端数据不受影响。"
 *   confirmText="退出"
 *   variant="destructive"
 *   onConfirm={handleLogout}
 * />
 * ```
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = '确定',
  cancelText = '取消',
  variant = 'default',
  onConfirm,
}: ConfirmDialogProps) {
  const handleConfirm = async () => {
    await onConfirm()
    onOpenChange(false)
  }

  return (
    <BaseModal open={open} onClose={() => onOpenChange(false)}>
      <BaseModalHeader>
        <BaseModalTitle>{title}</BaseModalTitle>
        {description && <BaseModalDescription>{description}</BaseModalDescription>}
      </BaseModalHeader>

      <BaseModalFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {cancelText}
        </Button>
        <Button variant={variant} onClick={handleConfirm}>
          {confirmText}
        </Button>
      </BaseModalFooter>
    </BaseModal>
  )
}
