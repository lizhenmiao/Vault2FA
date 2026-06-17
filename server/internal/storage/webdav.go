package storage

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/lizhenmiao/vault2fa/internal/logger"
	"github.com/lizhenmiao/vault2fa/internal/types"
)

// WebDAVProvider WebDAV 存储
//
// 适用场景：坚果云、NextCloud 等 WebDAV 网盘
// 优点：兼容性广、易迁移
// 缺点：需要 WebDAV 服务
//
// 文件结构（单用户模式）：
//
//	/2fa-vault/
//	  └── vault.json  # 固定文件名
type WebDAVProvider struct {
	url       string
	auth      string
	basePath  string
	vaultFile string
	client    *http.Client
}

// NewWebDAVProvider 创建 WebDAV 存储提供者
func NewWebDAVProvider(url, username, password, path string) (*WebDAVProvider, error) {
	logger.Info("[WebDAV] 初始化 WebDAV 存储提供者")
	logger.Info("[WebDAV] URL: %s", url)
	logger.Info("[WebDAV] Username: %s", username)
	logger.Info("[WebDAV] Path: %s", path)

	// Basic Auth
	auth := "Basic " + base64.StdEncoding.EncodeToString([]byte(username+":"+password))

	return &WebDAVProvider{
		url:       strings.TrimSuffix(url, "/"),
		auth:      auth,
		basePath:  path,
		vaultFile: "vault.json",
		client:    &http.Client{Timeout: 30 * time.Second},
	}, nil
}

// Exists 检查是否有 vault 数据
func (p *WebDAVProvider) Exists() (bool, error) {
	url := fmt.Sprintf("%s%s/%s", p.url, p.basePath, p.vaultFile)

	logger.Info("[WebDAV] 检查 vault 是否存在: %s", url)

	req, err := http.NewRequest("HEAD", url, nil)
	if err != nil {
		logger.Error("[WebDAV] 创建请求失败: %v", err)
		return false, fmt.Errorf("创建 HTTP 请求失败: %w", err)
	}

	req.Header.Set("Authorization", p.auth)

	resp, err := p.client.Do(req)
	if err != nil {
		logger.Error("[WebDAV] 请求失败: %v", err)
		return false, nil // 网络错误视为不存在
	}
	defer resp.Body.Close()

	logger.Info("[WebDAV] 响应状态: %d", resp.StatusCode)
	exists := resp.StatusCode == http.StatusOK
	logger.Info("[WebDAV] vault 存在: %v", exists)

	return exists, nil
}

// Get 获取 vault
func (p *WebDAVProvider) Get(username, loginHash string) (*types.VaultResponse, error) {
	url := fmt.Sprintf("%s%s/%s", p.url, p.basePath, p.vaultFile)

	logger.Info("[WebDAV] GET vault: %s", url)
	logger.Info("[WebDAV] loginHash 前缀: %s...", loginHash[:min(8, len(loginHash))])

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		logger.Error("[WebDAV] 创建请求失败: %v", err)
		return nil, fmt.Errorf("创建 HTTP 请求失败: %w", err)
	}

	req.Header.Set("Authorization", p.auth)

	logger.Info("[WebDAV] 发送 GET 请求...")
	resp, err := p.client.Do(req)
	if err != nil {
		logger.Error("[WebDAV] HTTP 请求失败: %v", err)
		return nil, fmt.Errorf("HTTP 请求失败: %w", err)
	}
	defer resp.Body.Close()

	logger.Info("[WebDAV] 响应状态: %d", resp.StatusCode)

	if resp.StatusCode == http.StatusNotFound {
		logger.Info("[WebDAV] vault 不存在 (404)")
		return nil, nil
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		logger.Error("[WebDAV] 请求失败: %d %s", resp.StatusCode, string(body))
		return nil, fmt.Errorf("WebDAV 请求失败: %d %s", resp.StatusCode, string(body))
	}

	// 读取内容
	content, err := io.ReadAll(resp.Body)
	if err != nil {
		logger.Error("[WebDAV] 读取响应失败: %v", err)
		return nil, fmt.Errorf("读取 HTTP 响应失败: %w", err)
	}

	logger.Info("[WebDAV] 读取到 %d bytes", len(content))

	// 解析 JSON
	var storedData vaultFileData
	if err := json.Unmarshal(content, &storedData); err != nil {
		logger.Error("[WebDAV] 解析 JSON 失败: %v", err)
		return nil, fmt.Errorf("解析 vault JSON 失败: %w", err)
	}

	// 鉴权：校验 loginHash
	if storedData.Vault.LoginHash != loginHash {
		logger.Info("[WebDAV] loginHash 不匹配，拒绝访问")
		return nil, nil
	}

	logger.Info("[WebDAV] loginHash 验证通过")

	// 用 ETag 作为版本号
	etag := resp.Header.Get("ETag")
	if etag == "" {
		etag = fmt.Sprintf("%d", time.Now().UnixMilli())
	}

	logger.Info("[WebDAV] 返回 vault, version: %s", etag)

	return &types.VaultResponse{
		Vault:   storedData.Vault,
		Version: etag,
	}, nil
}

// Put 保存 vault
func (p *WebDAVProvider) Put(username, loginHash string, vault *types.EncryptedVault, oldVersion string) (string, error) {
	logger.Info("[WebDAV] PUT vault, oldVersion: %s", oldVersion)
	logger.Info("[WebDAV] loginHash 前缀: %s...", loginHash[:min(8, len(loginHash))])

	// 如果有旧版本，额外鉴权：确保 loginHash 匹配
	if oldVersion != "" {
		logger.Info("[WebDAV] 验证旧版本存在性...")
		existing, err := p.Get(username, loginHash)
		if err != nil {
			logger.Error("[WebDAV] 验证失败: %v", err)
			return "", err
		}
		if existing == nil {
			logger.Error("[WebDAV] 旧版本不存在或 loginHash 不匹配")
			return "", fmt.Errorf("未授权：loginHash 不匹配或 vault 不存在")
		}
		logger.Info("[WebDAV] 旧版本验证通过")
	} else {
		logger.Info("[WebDAV] 首次创建 vault（无旧版本验证）")
	}

	// 包装数据结构
	data := vaultFileData{
		Vault:     *vault,
		UpdatedAt: time.Now().UTC().Format(time.RFC3339),
	}

	jsonData, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		logger.Error("[WebDAV] 序列化 JSON 失败: %v", err)
		return "", fmt.Errorf("序列化 vault JSON 失败: %w", err)
	}

	logger.Info("[WebDAV] JSON 大小: %d bytes", len(jsonData))

	url := fmt.Sprintf("%s%s/%s", p.url, p.basePath, p.vaultFile)
	logger.Info("[WebDAV] PUT 请求: %s", url)

	req, err := http.NewRequest("PUT", url, bytes.NewReader(jsonData))
	if err != nil {
		logger.Error("[WebDAV] 创建请求失败: %v", err)
		return "", fmt.Errorf("创建 HTTP 请求失败: %w", err)
	}

	req.Header.Set("Authorization", p.auth)
	req.Header.Set("Content-Type", "application/json")

	// 如果有旧版本，用 If-Match 做乐观锁
	if oldVersion != "" {
		req.Header.Set("If-Match", oldVersion)
		logger.Info("[WebDAV] 设置 If-Match: %s", oldVersion)
	}

	logger.Info("[WebDAV] 发送 PUT 请求...")
	resp, err := p.client.Do(req)
	if err != nil {
		logger.Error("[WebDAV] HTTP 请求失败: %v", err)
		return "", fmt.Errorf("HTTP 请求失败: %w", err)
	}
	defer resp.Body.Close()

	logger.Info("[WebDAV] 响应状态: %d", resp.StatusCode)

	if resp.StatusCode == http.StatusPreconditionFailed {
		logger.Error("[WebDAV] 冲突: vault 已被其他客户端修改")
		return "", fmt.Errorf("冲突：vault 已被其他客户端修改")
	}

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusNoContent {
		body, _ := io.ReadAll(resp.Body)
		logger.Error("[WebDAV] 请求失败: %d %s", resp.StatusCode, string(body))
		return "", fmt.Errorf("WebDAV 请求失败: %d %s", resp.StatusCode, string(body))
	}

	// 返回新的 ETag 作为版本号
	newETag := resp.Header.Get("ETag")
	if newETag == "" {
		newETag = fmt.Sprintf("%d", time.Now().UnixMilli())
	}

	logger.Info("[WebDAV] 保存成功, 新 ETag: %s", newETag)

	return newETag, nil
}
