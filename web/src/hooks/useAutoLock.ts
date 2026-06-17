import { useEffect, useRef } from 'react'

/**
 * 自动锁定 hook
 *
 * 监测用户活动，在无操作一段时间后触发回调
 *
 * @param onTimeout - 超时回调函数
 * @param timeoutMinutes - 超时时间（分钟），默认 5
 * @param enabled - 是否启用，默认 true
 */
export function useAutoLock(
  onTimeout: () => void,
  timeoutMinutes: number = 5,
  enabled: boolean = true
) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const resetTimer = () => {
    if (!enabled) return

    // 清除旧定时器
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // 设置新定时器
    timeoutRef.current = setTimeout(() => {
      onTimeout()
    }, timeoutMinutes * 60 * 1000)
  }

  useEffect(() => {
    if (!enabled) {
      // 如果禁用，清除定时器
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      return
    }

    // 监听用户活动事件
    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
    ]

    const handleActivity = () => {
      resetTimer()
    }

    // 初始化定时器
    resetTimer()

    // 添加事件监听
    events.forEach((event) => {
      document.addEventListener(event, handleActivity, true)
    })

    // 清理
    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity, true)
      })
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [enabled, timeoutMinutes, onTimeout])
}
