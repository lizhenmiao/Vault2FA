package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/lizhenmiao/vault2fa/internal/logger"
	"github.com/lizhenmiao/vault2fa/internal/storage"
	"github.com/lizhenmiao/vault2fa/internal/types"
)

// Handler HTTP 路由处理器
type Handler struct {
	storage storage.Provider
}

// New 创建处理器
func New(storage storage.Provider) *Handler {
	return &Handler{storage: storage}
}

// GetVaultExists 处理 GET /api/vault/exists
func (h *Handler) GetVaultExists(w http.ResponseWriter, r *http.Request) {
	logger.Info("收到请求: GET /api/vault/exists")

	exists, err := h.storage.Exists()
	if err != nil {
		logger.Error("查询 vault 是否存在失败: %v", err)
		respondJSON(w, map[string]string{"error": "服务器内部错误"}, http.StatusInternalServerError)
		return
	}

	logger.Info("vault 存在状态: %v", exists)
	respondJSON(w, map[string]bool{"exists": exists}, http.StatusOK)
}

// GetVault 处理 GET /api/vault
func (h *Handler) GetVault(w http.ResponseWriter, r *http.Request) {
	logger.Info("收到请求: GET /api/vault")

	// 解析 Authorization header
	auth := r.Header.Get("Authorization")
	if !strings.HasPrefix(auth, "Bearer ") {
		logger.Info("请求被拒绝: 缺少 Bearer token")
		respondJSON(w, map[string]string{"error": "未授权"}, http.StatusUnauthorized)
		return
	}

	loginHash := strings.TrimPrefix(auth, "Bearer ")
	if loginHash == "" {
		logger.Info("请求被拒绝: Bearer token 为空")
		respondJSON(w, map[string]string{"error": "无效的授权头"}, http.StatusUnauthorized)
		return
	}

	logger.Info("尝试获取 vault, loginHash 前缀: %s...", loginHash[:min(8, len(loginHash))])

	// 获取 vault
	result, err := h.storage.Get("", loginHash)
	if err != nil {
		logger.Error("拉取 vault 失败: %v", err)
		respondJSON(w, map[string]string{"error": "服务器内部错误"}, http.StatusInternalServerError)
		return
	}

	if result == nil {
		logger.Info("vault 不存在")
		respondJSON(w, map[string]string{"error": "Vault 不存在"}, http.StatusNotFound)
		return
	}

	logger.Info("成功返回 vault, version: %s", result.Version)
	respondJSON(w, result, http.StatusOK)
}

// PutVault 处理 PUT /api/vault
func (h *Handler) PutVault(w http.ResponseWriter, r *http.Request) {
	logger.Info("收到请求: PUT /api/vault")

	// 解析 Authorization header
	auth := r.Header.Get("Authorization")
	if !strings.HasPrefix(auth, "Bearer ") {
		logger.Info("请求被拒绝: 缺少 Bearer token")
		respondJSON(w, map[string]string{"error": "未授权"}, http.StatusUnauthorized)
		return
	}

	loginHash := strings.TrimPrefix(auth, "Bearer ")
	if loginHash == "" {
		logger.Info("请求被拒绝: Bearer token 为空")
		respondJSON(w, map[string]string{"error": "无效的授权头"}, http.StatusUnauthorized)
		return
	}

	logger.Info("尝试保存 vault, loginHash 前缀: %s...", loginHash[:min(8, len(loginHash))])

	// 解析请求体
	var body struct {
		Vault   *types.EncryptedVault `json:"vault"`
		Version *string               `json:"version"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		logger.Error("解析请求体失败: %v", err)
		respondJSON(w, map[string]string{"error": "无效的请求体"}, http.StatusBadRequest)
		return
	}

	if body.Vault == nil {
		logger.Error("请求体缺少 vault 数据")
		respondJSON(w, map[string]string{"error": "缺少 vault 数据"}, http.StatusBadRequest)
		return
	}

	oldVersion := ""
	if body.Version != nil {
		oldVersion = *body.Version
		logger.Info("期望的旧版本: %s", oldVersion)
	} else {
		logger.Info("首次创建 vault（无旧版本）")
	}

	// 保存 vault
	newVersion, err := h.storage.Put("", loginHash, body.Vault, oldVersion)
	if err != nil {
		logger.Error("推送 vault 失败: %v", err)

		if strings.Contains(err.Error(), "Conflict") {
			respondJSON(w, map[string]string{"error": "冲突：vault 已被修改"}, http.StatusConflict)
			return
		}

		respondJSON(w, map[string]string{"error": "服务器内部错误"}, http.StatusInternalServerError)
		return
	}

	logger.Info("成功保存 vault, 新版本: %s", newVersion)
	respondJSON(w, map[string]string{"version": newVersion}, http.StatusOK)
}

// HealthCheck 处理 GET /health
func (h *Handler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, map[string]string{"status": "ok"}, http.StatusOK)
}

// respondJSON 返回 JSON 响应
func respondJSON(w http.ResponseWriter, data interface{}, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(data); err != nil {
		logger.Error("编码 JSON 响应失败: %v", err)
	}
}

