package storage

import (
	"fmt"

	"github.com/lizhenmiao/vault2fa/internal/config"
	"github.com/lizhenmiao/vault2fa/internal/logger"
)

// NewProvider 根据配置创建存储提供者
func NewProvider(cfg *config.Config) (Provider, error) {
	logger.Info("[Factory] 创建存储提供者: %s", cfg.StorageType)

	switch cfg.StorageType {
	case config.StorageTypeLocal:
		if cfg.Local == nil {
			logger.Error("[Factory] Local 配置为空")
			return nil, fmt.Errorf("Local 配置为空")
		}
		logger.Info("[Factory] 创建 Local 存储提供者")
		return NewLocalProvider(cfg.Local.DataDir)

	case config.StorageTypeGit:
		if cfg.Git == nil {
			logger.Error("[Factory] Git 配置为空")
			return nil, fmt.Errorf("Git 配置为空")
		}
		logger.Info("[Factory] 创建 Git 存储提供者")
		return NewGitProvider(cfg.Git.APIURL, cfg.Git.Token, cfg.Git.Repo)

	case config.StorageTypeWebDAV:
		if cfg.WebDAV == nil {
			logger.Error("[Factory] WebDAV 配置为空")
			return nil, fmt.Errorf("WebDAV 配置为空")
		}
		logger.Info("[Factory] 创建 WebDAV 存储提供者")
		return NewWebDAVProvider(cfg.WebDAV.URL, cfg.WebDAV.Username, cfg.WebDAV.Password, cfg.WebDAV.Path)

	default:
		logger.Error("[Factory] 不支持的存储类型: %s", cfg.StorageType)
		return nil, fmt.Errorf("不支持的存储类型: %s", cfg.StorageType)
	}
}
