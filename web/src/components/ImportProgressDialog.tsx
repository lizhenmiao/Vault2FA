import { Progress } from '@/components/ui/Progress'
import {
  BaseModal,
  BaseModalHeader,
  BaseModalTitle,
} from '@/components/ui/BaseModal'

interface ImportProgressDialogProps {
  open: boolean
  total: number
  current: number
  currentName: string
}

/**
 * 批量导入进度弹窗
 *
 * 独立的进度显示弹窗，不可关闭（导入完成自动关闭）
 */
export function ImportProgressDialog({
  open,
  total,
  current,
  currentName,
}: ImportProgressDialogProps) {
  const percentage = Math.round((current / total) * 100)

  return (
    <BaseModal open={open} onClose={() => {}} hideCloseButton>
      <BaseModalHeader>
        <BaseModalTitle>批量导入中...</BaseModalTitle>
      </BaseModalHeader>

      <div className="space-y-4 py-4">
        {/* 进度信息 */}
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            正在导入 {current}/{total}
          </span>
          <span className="text-muted-foreground">
            {percentage}%
          </span>
        </div>

        {/* 进度条 */}
        <Progress
          value={current}
          max={total}
          className="h-2"
        />

        {/* 当前账户 */}
        {currentName && (
          <div className="text-sm text-muted-foreground">
            当前: <span className="font-medium text-foreground">{currentName}</span>
          </div>
        )}
      </div>
    </BaseModal>
  )
}
