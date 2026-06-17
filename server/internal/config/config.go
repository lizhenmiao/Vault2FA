package config

import (
	"fmt"
	"os"

	"github.com/lizhenmiao/vault2fa/internal/logger"
)

// StorageType 存储类型
type StorageType string

const (
	StorageTypeLocal  StorageType = "local"
	StorageTypeGit    StorageType = "git"
	StorageTypeWebDAV StorageType = "webdav"
)

// Config 应用配置
type Config struct {
	Port        string
	StorageType StorageType
	Local       *LocalConfig
	Git         *GitConfig
	WebDAV      *WebDAVConfig
}

// LocalConfig Local 存储配置
type LocalConfig struct {
	DataDir string
}

// GitConfig Git 存储配置
type GitConfig struct {
	APIURL string
	Token  string
	Repo   string
}

// WebDAVConfig WebDAV 存储配置
type WebDAVConfig struct {
	URL      string
	Username string
	Password string
	Path     string
}

// Load 从环境变量加载配置
func Load() (*Config, error) {
	logger.Info("[Config] 开始加载配置...")

	cfg := &Config{
		Port: getEnv("PORT", "3000"),
	}

	logger.Info("[Config] 服务端口: %s", cfg.Port)

	storageType := getEnv("STORAGE_TYPE", "local")
	cfg.StorageType = StorageType(storageType)

	logger.Info("[Config] 存储类型: %s", cfg.StorageType)

	switch cfg.StorageType {
	case StorageTypeLocal:
		dataDir := getEnv("LOCAL_DATA_DIR", "./data")
		cfg.Local = &LocalConfig{
			DataDir: dataDir,
		}
		logger.Info("[Config] Local 数据目录: %s", dataDir)

	case StorageTypeGit:
		apiURL := os.Getenv("GIT_API_URL")
		token := os.Getenv("GIT_TOKEN")
		repo := os.Getenv("GIT_REPO")

		if apiURL == "" || token == "" || repo == "" {
			logger.Error("[Config] Git 配置不完整")
			return nil, fmt.Errorf("Git 存储需要配置 GIT_API_URL, GIT_TOKEN, GIT_REPO")
		}

		cfg.Git = &GitConfig{
			APIURL: apiURL,
			Token:  token,
			Repo:   repo,
		}
		logger.Info("[Config] Git API: %s", apiURL)
		logger.Info("[Config] Git Repo: %s", repo)
		logger.Info("[Config] Git Token: %s...", token[:min(10, len(token))])

	case StorageTypeWebDAV:
		url := os.Getenv("WEBDAV_URL")
		username := os.Getenv("WEBDAV_USERNAME")
		password := os.Getenv("WEBDAV_PASSWORD")

		if url == "" || username == "" || password == "" {
			logger.Error("[Config] WebDAV 配置不完整")
			return nil, fmt.Errorf("WebDAV 存储需要配置 WEBDAV_URL, WEBDAV_USERNAME, WEBDAV_PASSWORD")
		}

		path := getEnv("WEBDAV_PATH", "/2fa-vault")

		cfg.WebDAV = &WebDAVConfig{
			URL:      url,
			Username: username,
			Password: password,
			Path:     path,
		}
		logger.Info("[Config] WebDAV URL: %s", url)
		logger.Info("[Config] WebDAV Username: %s", username)
		logger.Info("[Config] WebDAV Path: %s", path)

	default:
		logger.Error("[Config] 不支持的存储类型: %s", storageType)
		return nil, fmt.Errorf("不支持的存储类型: %s", storageType)
	}

	logger.Info("[Config] 配置加载完成")
	return cfg, nil
}

// min 返回两个整数中的较小值
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// getEnv 获取环境变量，如果不存在则返回默认值
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
