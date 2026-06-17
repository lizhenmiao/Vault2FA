import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import QrScanner from 'qr-scanner'
import { X, Image as ImageIcon } from 'lucide-react'
import { QRImageUpload } from './QRImageUpload'

interface QRScannerFullscreenProps {
  open: boolean
  onClose: () => void
  onScan: (data: string) => void
}

/**
 * 支付宝风格的全屏实时扫码组件
 *
 * - 黑色全屏背景（Portal 渲染到 body，避免被 Dialog 遮挡）
 * - 中间取景框 + 四角高亮
 * - 扫描线上下循环动画
 * - 底部相册选择兜底
 */
export function QRScannerFullscreen({ open, onClose, onScan }: QRScannerFullscreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerRef = useRef<QrScanner | null>(null)
  const [error, setError] = useState<string>('')
  const [isScanning, setIsScanning] = useState(false)

  // 用 ref 存最新回调，避免回调变化触发 useEffect 重启摄像头
  const onScanRef = useRef(onScan)
  const onCloseRef = useRef(onClose)
  onScanRef.current = onScan
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) {
      return
    }

    let cancelled = false
    let scanner: QrScanner | null = null

    const startScanner = async () => {
      // 等一帧确保 video 元素已挂载
      await new Promise((r) => requestAnimationFrame(r))
      if (cancelled || !videoRef.current) return

      try {
        setError('')

        scanner = new QrScanner(
          videoRef.current,
          (result) => {
            onScanRef.current(result.data)
            onCloseRef.current()
          },
          {
            returnDetailedScanResult: true,
            highlightScanRegion: false,
            highlightCodeOutline: false,
            preferredCamera: 'environment',
          }
        )

        scannerRef.current = scanner
        await scanner.start()

        if (cancelled) {
          // 启动期间已被取消，立即停止
          scanner.stop()
          scanner.destroy()
          scannerRef.current = null
          return
        }
        setIsScanning(true)
      } catch (err) {
        if (cancelled) return
        console.error('启动扫描器失败:', err)
        setIsScanning(false)
        if (err instanceof Error) {
          if (err.name === 'NotAllowedError') {
            setError('摄像头权限被拒绝，请在浏览器设置中允许访问摄像头')
          } else if (err.name === 'NotFoundError') {
            setError('未找到摄像头设备')
          } else if (err.name === 'AbortError') {
            setError('摄像头被中断，请重试')
          } else {
            setError('无法启动摄像头：' + err.message)
          }
        } else {
          setError('无法启动摄像头')
        }
      }
    }

    startScanner()

    return () => {
      cancelled = true
      if (scannerRef.current) {
        scannerRef.current.stop()
        scannerRef.current.destroy()
        scannerRef.current = null
      }
      setIsScanning(false)
    }
  }, [open])

  const handleClose = () => {
    onClose()
  }

  const handleAlbumScan = (data: string) => {
    onScan(data)
    onClose()
  }

  const handleAlbumError = (errorMsg: string) => {
    setError(`相册扫码失败: ${errorMsg}`)
  }

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black pointer-events-auto">
      {/* 摄像头视频流容器（隔离 qr-scanner 注入的元素） */}
      <div className="absolute inset-0 pointer-events-none">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
        />
      </div>

      {/* UI 层（完全独立，确保可点击） */}
      {/* 顶部：标题 + 关闭按钮 */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between p-4 bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
        <div className="text-white">
          <h2 className="text-lg font-medium">扫描二维码</h2>
          <p className="text-xs text-white/70 mt-0.5">对准二维码自动识别</p>
        </div>
        <button
          onClick={handleClose}
          type="button"
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 active:bg-white/40 transition-colors pointer-events-auto"
        >
          <X className="h-5 w-5 text-white" />
        </button>
      </div>

      {/* 中间：取景框 + 扫描线 */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative z-10 w-64 h-64">
          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
          {isScanning && (
            <div className="absolute inset-x-0 h-0.5 bg-primary shadow-[0_0_10px_rgba(0,191,255,0.8)] animate-scan" />
          )}
        </div>
      </div>

      {/* 底部：相册选择按钮 */}
      <div className="absolute bottom-0 left-0 right-0 z-30 p-6 bg-gradient-to-t from-black/70 to-transparent pointer-events-none">
        <div className="pointer-events-auto">
          <QRImageUpload onScan={handleAlbumScan} onError={handleAlbumError}>
            <button className="w-full flex items-center justify-center gap-3 py-3 rounded-lg bg-white/20 hover:bg-white/30 active:bg-white/40 transition-colors backdrop-blur-sm">
              <ImageIcon className="h-5 w-5 text-white" />
              <span className="text-white font-medium">从相册选择</span>
            </button>
          </QRImageUpload>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="absolute bottom-24 left-4 right-4 z-20 p-4 rounded-lg bg-destructive/90 backdrop-blur-sm">
          <p className="text-sm text-white text-center">{error}</p>
        </div>
      )}
    </div>,
    document.body
  )
}
