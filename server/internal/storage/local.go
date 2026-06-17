package storage

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/lizhenmiao/vault2fa/internal/logger"
	"github.com/lizhenmiao/vault2fa/internal/types"
)

// LocalProvider Local 本地文件系统存储
//
// 适用场景：VPS 单机部署，数据存储在服务器文件系统
// 优点：最简单、性能最好、无需额外服务
// 缺点：单机不跨设备（除非挂载共享 volume）
//
// 文件结构（单用户模式）：
//
//	data/2fa/
//	  └── vault.json  # 固定文件名
type LocalProvider struct {
	dataDir   string
	vaultFile string
}

// vaultFile 存储格式
type vaultFileData struct {
	Vault     types.EncryptedVault `json:"vault"`
	UpdatedAt string               `json:"updatedAt"`
}

// NewLocalProvider 创建 Local 存储提供者
func NewLocalProvider(dataDir string) (*LocalProvider, error) {
	logger.Info("[Local] 初始化 Local 存储提供者, 数据目录: %s", dataDir)

	// 确保数据目录存在
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		logger.Error("[Local] 创建数据目录失败: %v", err)
		return nil, fmt.Errorf("创建本地数据目录失败: %w", err)
	}

	vaultFile := filepath.Join(dataDir, "vault.json")
	logger.Info("[Local] vault 文件路径: %s", vaultFile)

	return &LocalProvider{
		dataDir:   dataDir,
		vaultFile: vaultFile,
	}, nil
}

// Exists 检查是否有 vault 数据（单用户模式）
func (p *LocalProvider) Exists() (bool, error) {
	logger.Info("[Local] 检查 vault 是否存在: %s", p.vaultFile)

	_, err := os.Stat(p.vaultFile)
	if os.IsNotExist(err) {
		logger.Info("[Local] vault 不存在")
		return false, nil
	}
	if err != nil {
		logger.Error("[Local] 检查文件失败: %v", err)
		return false, err
	}

	logger.Info("[Local] vault 存在")
	return true, nil
}

// Get 获取用户的 vault
func (p *LocalProvider) Get(username, loginHash string) (*types.VaultResponse, error) {
	logger.Info("[Local] GET vault: %s", p.vaultFile)
	logger.Info("[Local] loginHash 前缀: %s...", loginHash[:min(8, len(loginHash))])

	// 检查文件是否存在
	stat, err := os.Stat(p.vaultFile)
	if os.IsNotExist(err) {
		logger.Info("[Local] vault 不存在")
		return nil, nil
	}
	if err != nil {
		logger.Error("[Local] 读取文件信息失败: %v", err)
		return nil, fmt.Errorf("读取文件元信息失败: %w", err)
	}

	logger.Info("[Local] 文件存在, 大小: %d bytes, 修改时间: %s", stat.Size(), stat.ModTime())

	// 读取文件内容
	data, err := os.ReadFile(p.vaultFile)
	if err != nil {
		logger.Error("[Local] 读取文件失败: %v", err)
		return nil, fmt.Errorf("读取本地 vault 文件失败: %w", err)
	}

	logger.Info("[Local] 读取到 %d bytes", len(data))

	// 解析 JSON
	var fileData vaultFileData
	if err := json.Unmarshal(data, &fileData); err != nil {
		logger.Error("[Local] 解析 JSON 失败: %v", err)
		return nil, fmt.Errorf("解析 vault JSON 失败: %w", err)
	}

	// 鉴权：校验 loginHash
	if fileData.Vault.LoginHash != loginHash {
		logger.Info("[Local] loginHash 不匹配，拒绝访问")
		return nil, nil
	}

	logger.Info("[Local] loginHash 验证通过")

	// 使用文件的 mtime 作为版本号
	version := fmt.Sprintf("%d", stat.ModTime().UnixMilli())

	logger.Info("[Local] 返回 vault, version: %s", version)

	return &types.VaultResponse{
		Vault:   fileData.Vault,
		Version: version,
	}, nil
}

// Put 保存用户的 vault
func (p *LocalProvider) Put(username, loginHash string, vault *types.EncryptedVault, oldVersion string) (string, error) {
	logger.Info("[Local] PUT vault: %s", p.vaultFile)
	logger.Info("[Local] oldVersion: %s", oldVersion)
	logger.Info("[Local] loginHash 前缀: %s...", loginHash[:min(8, len(loginHash))])

	// 并发控制：检查 oldVersion
	if oldVersion != "" {
		logger.Info("[Local] 验证版本冲突...")
		stat, err := os.Stat(p.vaultFile)
		if err != nil && !os.IsNotExist(err) {
			logger.Error("[Local] 读取文件信息失败: %v", err)
			return "", fmt.Errorf("读取文件元信息失败: %w", err)
		}

		if err == nil {
			currentVersion := fmt.Sprintf("%d", stat.ModTime().UnixMilli())
			logger.Info("[Local] 当前版本: %s, 期望版本: %s", currentVersion, oldVersion)

			if currentVersion != oldVersion {
				logger.Error("[Local] 版本冲突")
				return "", fmt.Errorf("冲突：vault 已被其他客户端修改")
			}

			// 额外鉴权：读取现有 vault，确保 loginHash 匹配
			logger.Info("[Local] 验证 loginHash...")
			data, err := os.ReadFile(p.vaultFile)
			if err != nil {
				logger.Error("[Local] 读取文件失败: %v", err)
				return "", fmt.Errorf("读取本地 vault 文件失败: %w", err)
			}

			var fileData vaultFileData
			if err := json.Unmarshal(data, &fileData); err != nil {
				logger.Error("[Local] 解析 JSON 失败: %v", err)
				return "", fmt.Errorf("解析 vault JSON 失败: %w", err)
			}

			if fileData.Vault.LoginHash != loginHash {
				logger.Error("[Local] loginHash 不匹配")
				return "", fmt.Errorf("未授权：loginHash 不匹配")
			}

			logger.Info("[Local] 验证通过")
		}
	} else {
		logger.Info("[Local] 首次创建 vault（无版本验证）")
	}

	// 写入文件
	fileData := vaultFileData{
		Vault:     *vault,
		UpdatedAt: time.Now().UTC().Format(time.RFC3339),
	}

	data, err := json.MarshalIndent(fileData, "", "  ")
	if err != nil {
		logger.Error("[Local] 序列化 JSON 失败: %v", err)
		return "", fmt.Errorf("序列化 vault JSON 失败: %w", err)
	}

	logger.Info("[Local] 写入 %d bytes", len(data))

	if err := os.WriteFile(p.vaultFile, data, 0600); err != nil {
		logger.Error("[Local] 写入文件失败: %v", err)
		return "", fmt.Errorf("写入本地 vault 文件失败: %w", err)
	}

	logger.Info("[Local] 写入成功")

	// 返回新版本号（写入后的 mtime）
	stat, err := os.Stat(p.vaultFile)
	if err != nil {
		logger.Error("[Local] 读取文件信息失败: %v", err)
		return "", fmt.Errorf("读取文件元信息失败: %w", err)
	}

	newVersion := fmt.Sprintf("%d", stat.ModTime().UnixMilli())
	logger.Info("[Local] 新版本: %s", newVersion)

	return newVersion, nil
}

