import { useRef } from 'react'
import QrScanner from 'qr-scanner'

interface QRImageUploadProps {
  onScan: (data: string) => void
  onError?: (error: string) => void
  disabled?: boolean
  children: React.ReactNode
}

/**
 * 二维码图片上传扫描组件
 *
 * 移动端：触发系统相机拍照或选择相册
 * PC端：上传二维码图片文件
 */
export function QRImageUpload({ onScan, onError, disabled, children }: QRImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      // 用 qr-scanner 解析图片文件中的二维码
      const result = await QrScanner.scanImage(file, {
        returnDetailedScanResult: true,
      })

      onScan(result.data)

      // 清空 input，允许重复选择同一文件
      if (inputRef.current) {
        inputRef.current.value = ''
      }
    } catch (error) {
      console.error('二维码解析失败:', error)
      const errorMessage = error instanceof Error ? error.message : '无法识别二维码'
      onError?.(errorMessage)

      // 清空 input
      if (inputRef.current) {
        inputRef.current.value = ''
      }
    }
  }

  const handleClick = () => {
    if (!disabled) {
      inputRef.current?.click()
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        disabled={disabled}
        className="hidden"
      />
      <div onClick={handleClick} className={disabled ? 'cursor-not-allowed opacity-50' : ''}>
        {children}
      </div>
    </>
  )
}
