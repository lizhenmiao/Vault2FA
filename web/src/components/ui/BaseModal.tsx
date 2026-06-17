import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/utils/cn'

interface BaseModalProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  className?: string
  hideCloseButton?: boolean  // 隐藏右上角关闭按钮
  backdropOpacity?: 'light' | 'normal' | 'heavy'  // 遮罩透明度
}

/**
 * 基础模态对话框组件
 *
 * - fixed 居中卡片 + 半透明遮罩
 * - 点击遮罩或按 ESC 关闭
 * - 打开时焦点管理、禁用背景滚动
 * - fade-in + scale-in 动画
 * - 使用 Portal 渲染到 body，避免被父组件卸载
 */
export function BaseModal({
  open,
  onClose,
  children,
  className,
  hideCloseButton = false,
  backdropOpacity = 'normal'
}: BaseModalProps) {
  const previousActiveElement = useRef<HTMLElement | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // 焦点管理：打开时保存当前焦点，聚焦弹窗；关闭时恢复焦点
  useEffect(() => {
    if (open) {
      previousActiveElement.current = document.activeElement as HTMLElement
      // 下一帧聚焦弹窗内第一个可聚焦元素
      requestAnimationFrame(() => {
        const firstFocusable = contentRef.current?.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        firstFocusable?.focus()
      })
    } else {
      // 关闭时恢复焦点
      previousActiveElement.current?.focus()
    }
  }, [open])

  // 滚动锁定：打开时禁用 body 滚动
  useEffect(() => {
    if (!open) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [open])

  // ESC 键关闭
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  // 遮罩透明度映射
  const backdropClass = {
    light: 'bg-black/50',
    normal: 'bg-black/80',
    heavy: 'bg-black/90',
  }[backdropOpacity]

  // 使用 Portal 渲染到 body，避免被父组件卸载影响
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in-0 duration-200">
      {/* 遮罩 */}
      <div
        className={cn("absolute inset-0", backdropClass)}
        onClick={onClose}
      />

      {/* 内容卡片 */}
      <div
        ref={contentRef}
        className={cn(
          'relative z-10 w-full max-w-lg rounded-lg border bg-background p-6 shadow-lg max-h-[90vh] overflow-y-auto',
          'animate-in zoom-in-95 duration-200',
          className
        )}
      >
        {children}
        {/* 右上角关闭按钮（可选） */}
        {!hideCloseButton && (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">关闭</span>
          </button>
        )}
      </div>
    </div>,
    document.body
  )
}

/** 标题区 */
export function BaseModalHeader({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col space-y-1.5 text-center sm:text-left mb-4">{children}</div>
}

/** 标题 */
export function BaseModalTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={cn("text-lg font-semibold leading-none tracking-tight", className)}>{children}</h2>
}

/** 描述 */
export function BaseModalDescription({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>
}

/** 底部按钮区（修复移动端间距） */
export function BaseModalFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end mt-6">
      {children}
    </div>
  )
}
