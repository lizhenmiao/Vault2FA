import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, AlertCircle, X } from 'lucide-react'
import { cn } from '@/utils/cn'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  type: ToastType
  message: string
  duration?: number
}

interface ToastNotificationProps {
  toast: Toast | null
  onClose: () => void
}

const icons = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertCircle,
  info: AlertCircle,
}

const colors = {
  success: 'bg-green-500/90',
  error: 'bg-destructive/90',
  warning: 'bg-orange-500/90',
  info: 'bg-blue-500/90',
}

/**
 * Toast 通知组件
 *
 * - 右上角吐司通知
 * - 成功/失败/警告/信息四种类型
 * - 自动消失（可配置时长）
 */
export function ToastNotification({ toast, onClose }: ToastNotificationProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (toast) {
      setVisible(true)
      const timer = setTimeout(() => {
        setVisible(false)
        setTimeout(onClose, 300) // 等动画结束
      }, toast.duration || 3000)
      return () => clearTimeout(timer)
    } else {
      setVisible(false)
    }
  }, [toast, onClose])

  if (!toast) return null

  const Icon = icons[toast.type]

  return (
    <div
      className={cn(
        'fixed top-4 right-4 z-[300] flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-white backdrop-blur-sm transition-all duration-300 max-w-sm',
        colors[toast.type],
        visible ? 'animate-in slide-in-from-top-2' : 'animate-out slide-out-to-top-2 opacity-0'
      )}
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      <p className="text-sm font-medium flex-1">{toast.message}</p>
      <button
        onClick={() => {
          setVisible(false)
          setTimeout(onClose, 300)
        }}
        className="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

/**
 * Toast 管理 Hook
 *
 * 用法：
 * const { toast, showToast, hideToast } = useToast()
 * showToast({ type: 'success', message: '添加成功' })
 */
export function useToast() {
  const [toast, setToast] = useState<Toast | null>(null)

  const showToast = (params: Omit<Toast, 'id'>) => {
    setToast({
      ...params,
      id: Date.now().toString(),
    })
  }

  const hideToast = () => {
    setToast(null)
  }

  return { toast, showToast, hideToast }
}
