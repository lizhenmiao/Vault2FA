package logger

import (
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"time"
)

var (
	infoLogger  *log.Logger
	errorLogger *log.Logger
	logFile     *os.File
	currentDate string
)

// Init 初始化日志系统
func Init(logDir string) error {
	// 创建日志目录
	if err := os.MkdirAll(logDir, 0755); err != nil {
		return fmt.Errorf("创建日志目录失败: %w", err)
	}

	// 打开日志文件
	if err := rotateLog(logDir); err != nil {
		return err
	}

	// 创建日志记录器（同时输出到控制台和文件）
	multiWriter := io.MultiWriter(os.Stdout, logFile)
	infoLogger = log.New(multiWriter, "[INFO] ", log.LstdFlags)
	errorLogger = log.New(multiWriter, "[ERROR] ", log.LstdFlags)

	return nil
}

// rotateLog 按日期轮转日志文件
func rotateLog(logDir string) error {
	today := time.Now().Format("2006-01-02")

	// 如果是同一天且文件已打开，不需要轮转
	if currentDate == today && logFile != nil {
		return nil
	}

	// 关闭旧文件
	if logFile != nil {
		logFile.Close()
	}

	// 打开新文件
	logPath := filepath.Join(logDir, fmt.Sprintf("%s.log", today))
	file, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		return fmt.Errorf("打开日志文件失败: %w", err)
	}

	logFile = file
	currentDate = today

	return nil
}

// CheckRotate 检查是否需要轮转日志（每天调用一次）
func CheckRotate(logDir string) {
	today := time.Now().Format("2006-01-02")
	if currentDate != today {
		if err := rotateLog(logDir); err != nil {
			log.Printf("轮转日志失败: %v", err)
		}
	}
}

// Info 记录信息日志
func Info(format string, v ...interface{}) {
	if infoLogger != nil {
		infoLogger.Printf(format, v...)
	} else {
		log.Printf("[INFO] "+format, v...)
	}
}

// Error 记录错误日志
func Error(format string, v ...interface{}) {
	if errorLogger != nil {
		errorLogger.Printf(format, v...)
	} else {
		log.Printf("[ERROR] "+format, v...)
	}
}

// Close 关闭日志文件
func Close() {
	if logFile != nil {
		logFile.Close()
	}
}
