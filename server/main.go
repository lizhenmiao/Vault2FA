package main

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/joho/godotenv"
	"github.com/lizhenmiao/vault2fa/internal/config"
	"github.com/lizhenmiao/vault2fa/internal/handlers"
	"github.com/lizhenmiao/vault2fa/internal/logger"
	"github.com/lizhenmiao/vault2fa/internal/storage"
)

//go:embed all:static
var staticFiles embed.FS

func main() {
	// 加载 .env 文件（如果存在）
	if err := godotenv.Load(); err != nil {
		log.Println("未找到 .env 文件，使用默认配置")
	}

	// 初始化日志系统
	logDir := "./logs"
	if err := logger.Init(logDir); err != nil {
		log.Fatalf("初始化日志系统失败: %v", err)
	}
	defer logger.Close()

	// 启动日志轮转检查（每天凌晨检查一次）
	go func() {
		for {
			now := time.Now()
			// 计算到明天凌晨的时间
			next := time.Date(now.Year(), now.Month(), now.Day()+1, 0, 0, 0, 0, now.Location())
			time.Sleep(time.Until(next))
			logger.CheckRotate(logDir)
		}
	}()

	logger.Info("服务启动...")

	// 加载配置
	cfg, err := config.Load()
	if err != nil {
		logger.Error("加载配置失败: %v", err)
		os.Exit(1)
	}

	// 初始化存储
	store, err := storage.NewProvider(cfg)
	if err != nil {
		logger.Error("初始化存储失败: %v", err)
		os.Exit(1)
	}

	// 初始化处理器
	h := handlers.New(store)

	// 初始化路由
	r := chi.NewRouter()

	// 中间件
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(corsMiddleware)

	// API 路由
	r.Get("/api/vault/exists", h.GetVaultExists)
	r.Get("/api/vault", h.GetVault)
	r.Put("/api/vault", h.PutVault)
	r.Get("/health", h.HealthCheck)

	// 静态文件服务
	setupStaticFiles(r)

	// 创建 HTTP 服务器
	addr := fmt.Sprintf(":%s", cfg.Port)
	srv := &http.Server{
		Addr:    addr,
		Handler: r,
	}

	logger.Info("服务器启动在 %s", addr)
	logger.Info("存储类型: %s", cfg.StorageType)

	// 启动服务器（goroutine）
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("服务器启动失败: %v", err)
			os.Exit(1)
		}
	}()

	// 等待中断信号（Ctrl+C）
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("正在优雅关闭服务器...")

	// 设置 5 秒超时
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// 优雅关闭服务器
	if err := srv.Shutdown(ctx); err != nil {
		logger.Error("服务器关闭失败: %v", err)
	}

	logger.Info("服务器已关闭")
}

// setupStaticFiles 设置静态文件服务
// 开发模式：使用外部目录 ../web/dist
// 生产模式：使用嵌入的文件（static/ 目录）
func setupStaticFiles(r *chi.Mux) {
	// 尝试使用嵌入的文件系统
	webDist, err := fs.Sub(staticFiles, "static")
	if err == nil {
		// 成功读取嵌入文件，使用生产模式
		logger.Info("使用嵌入的静态文件（生产模式）")
		fileServer := http.FileServer(http.FS(webDist))
		r.Get("/*", func(w http.ResponseWriter, r *http.Request) {
			fileServer.ServeHTTP(w, r)
		})
		return
	}

	// 嵌入文件不存在，使用开发模式（外部目录）
	logger.Info("使用外部静态文件目录（开发模式）")
	webDistPath := filepath.Join("..", "web", "dist")
	absPath, err := filepath.Abs(webDistPath)
	if err != nil {
		logger.Info("警告：无法解析静态文件路径: %v", err)
		absPath = webDistPath
	}

	// 检查目录是否存在
	if _, err := os.Stat(absPath); os.IsNotExist(err) {
		logger.Info("警告：静态文件目录不存在: %s", absPath)
		logger.Info("提示：请先运行 'cd ../web && npm run build'")
	} else {
		logger.Info("静态文件目录: %s", absPath)
	}

	// 静态文件处理
	fileServer := http.FileServer(http.Dir(absPath))
	r.Get("/*", func(w http.ResponseWriter, r *http.Request) {
		fileServer.ServeHTTP(w, r)
	})
}

// corsMiddleware CORS 中间件
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}
