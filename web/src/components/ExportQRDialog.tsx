import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Button } from '@/components/ui/Button'
import {
  BaseModal,
  BaseModalHeader,
  BaseModalTitle,
  BaseModalDescription,
  BaseModalFooter,
} from '@/components/ui/BaseModal'
import { generateOTPAuthURI } from '@/totp'
import type { Account } from '@/totp/types'
import { Download, QrCode as QrCodeIcon } from 'lucide-react'

interface ExportQRDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: Account | null
}

export function ExportQRDialog({ open, onOpenChange, account }: ExportQRDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    if (!open || !account || !canvasRef.current) {
      return
    }

    const generateQR = async () => {
      try {
        setError('')
        const uri = generateOTPAuthURI({
          issuer: account.issuer,
          label: account.label,
          secret: account.secret,
          algorithm: account.algorithm,
          digits: account.digits,
          period: account.period,
        })

        await QRCode.toCanvas(canvasRef.current!, uri, {
          width: 300,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
        })
      } catch (err) {
        console.error('生成二维码失败:', err)
        setError(err instanceof Error ? err.message : '生成二维码失败')
      }
    }

    generateQR()
  }, [open, account])

  const handleDownload = () => {
    if (!canvasRef.current || !account) return

    const url = canvasRef.current.toDataURL('image/png')
    const link = document.createElement('a')
    link.download = `${account.issuer}-${account.label}.png`
    link.href = url
    link.click()
  }

  if (!account) return null

  return (
    <BaseModal open={open} onClose={() => onOpenChange(false)}>
      <BaseModalHeader>
        <BaseModalTitle className="flex items-center gap-2">
          <QrCodeIcon className="h-5 w-5" />
          导出二维码
        </BaseModalTitle>
        <BaseModalDescription>
          扫描此二维码可将账户导入其他 2FA 应用
        </BaseModalDescription>
      </BaseModalHeader>

      <div className="space-y-4">
        {/* 账户信息 */}
        <div className="bg-muted p-3 rounded-md">
          <div className="font-medium">{account.issuer}</div>
          <div className="text-sm text-muted-foreground">{account.label}</div>
        </div>

        {/* 二维码 */}
        <div className="flex justify-center bg-white p-4 rounded-lg">
          <canvas ref={canvasRef} />
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
            {error}
          </div>
        )}

        {/* 警告 */}
        <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md">
          ⚠️ 二维码包含敏感信息，请勿分享给他人
        </div>
      </div>

      <BaseModalFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          关闭
        </Button>
        <Button onClick={handleDownload} disabled={!!error}>
          <Download className="mr-2 h-4 w-4" />
          下载图片
        </Button>
      </BaseModalFooter>
    </BaseModal>
  )
}
