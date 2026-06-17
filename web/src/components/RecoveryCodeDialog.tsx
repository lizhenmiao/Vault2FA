import { useState, useEffect } from 'react'
import confetti from 'canvas-confetti'
import {
  BaseModal,
  BaseModalHeader,
  BaseModalTitle,
  BaseModalDescription,
  BaseModalFooter,
} from '@/components/ui/BaseModal'
import { Button } from '@/components/ui/Button'

interface RecoveryCodeDialogProps {
  open: boolean
  recoveryCode: string
  onConfirm: () => void
  confirmButtonText?: string  // 可自定义按钮文字
}

/**
 * 恢复码展示弹窗（通用组件）
 *
 * 用途：
 * - CreateVaultPage: "复制并进入保险库"
 * - UnlockPage: "复制并继续登录"
 *
 * 特性：
 * - 无法关闭（必须确认）
 * - 点击按钮自动复制 + 调用 onConfirm
 * - 半透明遮罩
 * - 弹窗打开时撒花特效 🎉
 */
export function RecoveryCodeDialog({
  open,
  recoveryCode,
  onConfirm,
  confirmButtonText = '复制并继续'
}: RecoveryCodeDialogProps) {
  const [copied, setCopied] = useState(false)

  // 弹窗打开时触发撒花特效
  useEffect(() => {
    if (open) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      })
    }
  }, [open])

  const handleConfirm = async () => {
    try {
      // 自动复制到剪贴板
      await navigator.clipboard.writeText(recoveryCode)
      setCopied(true)

      // 短暂延迟后执行回调（让用户看到"已复制"提示）
      setTimeout(() => {
        onConfirm()
      }, 300)
    } catch (error) {
      console.error('复制失败:', error)
      // 复制失败也允许继续（用户可能手动复制了）
      onConfirm()
    }
  }

  return (
    <BaseModal
      open={open}
      onClose={() => {}}
      hideCloseButton={true}
      backdropOpacity="light"
    >
      <BaseModalHeader>
        <BaseModalTitle>⚠️ 保存恢复码</BaseModalTitle>
        <BaseModalDescription>
          这是您的保险库恢复码，仅显示一次，请务必保存！
        </BaseModalDescription>
      </BaseModalHeader>

      <div className="space-y-4">
        {/* 恢复码显示 */}
        <div className="p-4 bg-muted rounded-lg">
          <div className="font-mono text-lg text-center tracking-wider break-all">
            {recoveryCode}
          </div>
        </div>

        {/* 提示信息 */}
        <div className="text-sm text-muted-foreground space-y-2">
          <p>⚠️ 重要提示：</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>此恢复码用于忘记登录密码时重置密码</li>
            <li>请将恢复码保存到安全的地方（如密码管理器）</li>
            <li>任何人获得恢复码都可以重置您的密码</li>
          </ul>
        </div>
      </div>

      <BaseModalFooter>
        <Button
          onClick={handleConfirm}
          className="w-full"
          disabled={copied}
        >
          {copied ? '已复制，正在跳转...' : confirmButtonText}
        </Button>
      </BaseModalFooter>
    </BaseModal>
  )
}
