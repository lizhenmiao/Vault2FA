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

// GitProvider Git 存储（支持 GitHub / Gitee / Gitea）
//
// 适用场景：多设备同步、历史版本管理
// 优点：Git 自带版本控制、可跨设备
// 缺点：需要配置 Git 仓库 + Token
//
// API 兼容性：
//   - GitHub: https://api.github.com
//   - Gitee: https://gitee.com/api/v5
//   - Gitea: https://your-gitea.com/api/v1
//
// 文件结构（单用户模式）：
//
//	仓库根目录/
//	  └── vault.json  # 固定文件名
type GitProvider struct {
	apiURL    string
	token     string
	repo      string
	vaultFile string
	client    *http.Client
}

// gitFileResponse Git API 文件响应
type gitFileResponse struct {
	Content string `json:"content"` // Base64 编码的内容
	SHA     string `json:"sha"`     // Git SHA（版本号）
}

// gitUpdateRequest Git API 更新请求
type gitUpdateRequest struct {
	Message string `json:"message"`
	Content string `json:"content"` // Base64 编码
	SHA     string `json:"sha,omitempty"`
}

// gitUpdateResponse Git API 更新响应
type gitUpdateResponse struct {
	Content struct {
		SHA string `json:"sha"`
	} `json:"content"`
}

// NewGitProvider 创建 Git 存储提供者
func NewGitProvider(apiURL, token, repo string) (*GitProvider, error) {
	logger.Info("[Git] 初始化 Git 存储提供者")
	logger.Info("[Git] API URL: %s", apiURL)
	logger.Info("[Git] Repo: %s", repo)
	logger.Info("[Git] Token: %s...", token[:min(10, len(token))])

	return &GitProvider{
		apiURL:    strings.TrimSuffix(apiURL, "/"),
		token:     token,
		repo:      repo,
		vaultFile: "vault.json",
		client:    &http.Client{Timeout: 30 * time.Second},
	}, nil
}

// Exists 检查是否有 vault 数据
func (p *GitProvider) Exists() (bool, error) {
	url := fmt.Sprintf("%s/repos/%s/contents/%s", p.apiURL, p.repo, p.vaultFile)

	logger.Info("[Git] 检查 vault 是否存在: %s", url)

	req, err := http.NewRequest("GET", url, nil)  // 改为 GET
	if err != nil {
		logger.Error("[Git] 创建请求失败: %v", err)
		return false, fmt.Errorf("创建 HTTP 请求失败: %w", err)
	}

	// 设置完整的 token
	req.Header.Set("Authorization", "token "+p.token)
	req.Header.Set("Accept", "application/vnd.github.v3+json")

	// 日志中只显示 token 前缀
	logger.Info("[Git] Authorization: token %s...", p.token[:min(10, len(p.token))])

	resp, err := p.client.Do(req)
	if err != nil {
		logger.Error("[Git] 请求失败: %v", err)
		return false, nil // 网络错误视为不存在
	}
	defer resp.Body.Close()

	logger.Info("[Git] 响应状态: %d", resp.StatusCode)
	exists := resp.StatusCode == http.StatusOK
	logger.Info("[Git] vault 存在: %v", exists)

	return exists, nil
}

// Get 获取 vault
func (p *GitProvider) Get(username, loginHash string) (*types.VaultResponse, error) {
	url := fmt.Sprintf("%s/repos/%s/contents/%s", p.apiURL, p.repo, p.vaultFile)

	logger.Info("[Git] GET vault: %s", url)
	logger.Info("[Git] loginHash 前缀: %s...", loginHash[:min(8, len(loginHash))])

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		logger.Error("[Git] 创建请求失败: %v", err)
		return nil, fmt.Errorf("创建 HTTP 请求失败: %w", err)
	}

	req.Header.Set("Authorization", "token "+p.token)
	req.Header.Set("Accept", "application/vnd.github.v3+json")

	logger.Info("[Git] 发送 GET 请求...")
	resp, err := p.client.Do(req)
	if err != nil {
		logger.Error("[Git] HTTP 请求失败: %v", err)
		return nil, fmt.Errorf("HTTP 请求失败: %w", err)
	}
	defer resp.Body.Close()

	logger.Info("[Git] 响应状态: %d", resp.StatusCode)

	if resp.StatusCode == http.StatusNotFound {
		logger.Info("[Git] vault 不存在 (404)")
		return nil, nil
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		logger.Error("[Git] API 错误: %d %s", resp.StatusCode, string(body))
		return nil, fmt.Errorf("Git API 请求失败: %d %s", resp.StatusCode, string(body))
	}

	var fileResp gitFileResponse
	if err := json.NewDecoder(resp.Body).Decode(&fileResp); err != nil {
		logger.Error("[Git] 解析 JSON 失败: %v", err)
		return nil, fmt.Errorf("解析 JSON 响应失败: %w", err)
	}

	logger.Info("[Git] 获取到文件, SHA: %s", fileResp.SHA[:min(8, len(fileResp.SHA))])

	// 解码 Base64 内容
	content, err := base64.StdEncoding.DecodeString(fileResp.Content)
	if err != nil {
		logger.Error("[Git] Base64 解码失败: %v", err)
		return nil, fmt.Errorf("Base64 解码失败: %w", err)
	}

	logger.Info("[Git] 解码后内容大小: %d bytes", len(content))

	// 解析 JSON
	var storedData vaultFileData
	if err := json.Unmarshal(content, &storedData); err != nil {
		logger.Error("[Git] 解析 vault JSON 失败: %v", err)
		return nil, fmt.Errorf("解析 vault JSON 失败: %w", err)
	}

	// 鉴权：校验 loginHash
	if storedData.Vault.LoginHash != loginHash {
		logger.Info("[Git] loginHash 不匹配，拒绝访问")
		return nil, nil
	}

	logger.Info("[Git] loginHash 验证通过，返回 vault")

	return &types.VaultResponse{
		Vault:   storedData.Vault,
		Version: fileResp.SHA,
	}, nil
}

// Put 保存 vault
func (p *GitProvider) Put(username, loginHash string, vault *types.EncryptedVault, oldVersion string) (string, error) {
	logger.Info("[Git] PUT vault, oldVersion: %s", oldVersion)
	logger.Info("[Git] loginHash 前缀: %s...", loginHash[:min(8, len(loginHash))])

	// 如果有旧版本，额外鉴权：确保 loginHash 匹配
	if oldVersion != "" {
		logger.Info("[Git] 验证旧版本存在性...")
		existing, err := p.Get(username, loginHash)
		if err != nil {
			logger.Error("[Git] 验证失败: %v", err)
			return "", err
		}
		if existing == nil {
			logger.Error("[Git] 旧版本不存在或 loginHash 不匹配")
			return "", fmt.Errorf("未授权：loginHash 不匹配或 vault 不存在")
		}
		logger.Info("[Git] 旧版本验证通过")
	} else {
		logger.Info("[Git] 首次创建 vault（无旧版本验证）")
	}

	// 包装数据结构
	data := vaultFileData{
		Vault:     *vault,
		UpdatedAt: time.Now().UTC().Format(time.RFC3339),
	}

	jsonData, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		logger.Error("[Git] 序列化 JSON 失败: %v", err)
		return "", fmt.Errorf("序列化 vault JSON 失败: %w", err)
	}

	logger.Info("[Git] JSON 大小: %d bytes", len(jsonData))

	// Base64 编码
	content := base64.StdEncoding.EncodeToString(jsonData)

	// 构建请求体
	reqBody := gitUpdateRequest{
		Message: fmt.Sprintf("Update vault at %s", time.Now().UTC().Format(time.RFC3339)),
		Content: content,
		SHA:     oldVersion,
	}

	reqData, err := json.Marshal(reqBody)
	if err != nil {
		logger.Error("[Git] 序列化请求失败: %v", err)
		return "", fmt.Errorf("序列化请求 JSON 失败: %w", err)
	}

	url := fmt.Sprintf("%s/repos/%s/contents/%s", p.apiURL, p.repo, p.vaultFile)
	logger.Info("[Git] PUT 请求: %s", url)

	req, err := http.NewRequest("PUT", url, bytes.NewReader(reqData))
	if err != nil {
		logger.Error("[Git] 创建请求失败: %v", err)
		return "", fmt.Errorf("创建 HTTP 请求失败: %w", err)
	}

	req.Header.Set("Authorization", "token "+p.token)
	req.Header.Set("Accept", "application/vnd.github.v3+json")
	req.Header.Set("Content-Type", "application/json")

	logger.Info("[Git] 发送 PUT 请求...")
	resp, err := p.client.Do(req)
	if err != nil {
		logger.Error("[Git] HTTP 请求失败: %v", err)
		return "", fmt.Errorf("HTTP 请求失败: %w", err)
	}
	defer resp.Body.Close()

	logger.Info("[Git] 响应状态: %d", resp.StatusCode)

	// 422 错误：文件已存在但前端认为是首次创建（换浏览器场景）
	if resp.StatusCode == 422 && oldVersion == "" {
		logger.Info("[Git] 422 错误且无旧版本，尝试获取现有 SHA 并重试...")
		body, _ := io.ReadAll(resp.Body)
		logger.Info("[Git] 422 响应: %s", string(body))

		// 获取现有文件的 SHA
		existing, err := p.Get(username, loginHash)
		if err != nil {
			logger.Error("[Git] 获取现有 vault 失败: %v", err)
			return "", fmt.Errorf("文件已存在但无法获取现有版本: %w", err)
		}
		if existing == nil {
			logger.Error("[Git] loginHash 不匹配，无权访问")
			return "", fmt.Errorf("未授权：loginHash 不匹配")
		}

		logger.Info("[Git] 获取到现有 SHA，使用更新模式重试...")
		// 递归调用，带上正确的 oldVersion
		return p.Put(username, loginHash, vault, existing.Version)
	}

	if resp.StatusCode == http.StatusConflict {
		logger.Error("[Git] 冲突: vault 已被其他客户端修改")
		return "", fmt.Errorf("冲突：vault 已被其他客户端修改")
	}

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		logger.Error("[Git] API 错误: %d %s", resp.StatusCode, string(body))
		return "", fmt.Errorf("Git API 请求失败: %d %s", resp.StatusCode, string(body))
	}

	var updateResp gitUpdateResponse
	if err := json.NewDecoder(resp.Body).Decode(&updateResp); err != nil {
		logger.Error("[Git] 解析响应失败: %v", err)
		return "", fmt.Errorf("解析 JSON 响应失败: %w", err)
	}

	logger.Info("[Git] 保存成功, 新 SHA: %s", updateResp.Content.SHA[:min(8, len(updateResp.Content.SHA))])

	return updateResp.Content.SHA, nil
}

