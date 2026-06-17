package types

// KdfConfig KDF（密钥派生函数）配置
type KdfConfig struct {
	Algo        string `json:"algo"`        // 算法名称（argon2id）
	MemKiB      int    `json:"memKiB"`      // 内存成本（KiB）
	Iterations  int    `json:"iterations"`  // 迭代次数
	Parallelism int    `json:"parallelism"` // 并行度
}

// WrappedKey 包裹的密钥
type WrappedKey struct {
	Salt  *string `json:"salt,omitempty"` // Base64 编码的盐值（恢复码分支才有）
	Nonce string  `json:"nonce"`          // Base64 编码的 nonce
	Ct    string  `json:"ct"`             // Base64 编码的密文（加密后的 DEK）
}

// EncryptedVault 加密的保险库（存储格式，v2）
type EncryptedVault struct {
	Version     int    `json:"version"`     // 格式版本号（当前为 2）
	Username    string `json:"username"`    // 明文用户名
	Kdf         KdfConfig `json:"kdf"`      // KDF 配置
	LoginHash   string `json:"loginHash"`   // Base64 登录哈希（后端鉴权用）
	WrappedKeys struct {
		Password WrappedKey `json:"password"` // 登录密码分支
		Recovery WrappedKey `json:"recovery"` // 恢复码分支
	} `json:"wrappedKeys"`
	Vault struct {
		Nonce string `json:"nonce"` // Base64 编码的 nonce
		Ct    string `json:"ct"`    // Base64 编码的密文
	} `json:"vault"`
	UpdatedAt string `json:"updatedAt"` // ISO 8601 时间戳
}

// VaultResponse vault 响应
type VaultResponse struct {
	Vault   EncryptedVault `json:"vault"`   // 加密的 vault
	Version string         `json:"version"` // 版本号
}

// StorageProvider 存储提供者接口
type StorageProvider interface {
	// Exists 检查是否有任何 vault 数据（单用户模式）
	Exists() (bool, error)

	// Get 获取用户的加密 vault
	// username - 用户名
	// loginHash - 登录哈希（用于鉴权和标识）
	// 返回 vault 数据和版本号；不存在返回 nil
	Get(username, loginHash string) (*VaultResponse, error)

	// Put 保存用户的加密 vault
	// username - 用户名
	// loginHash - 登录哈希
	// vault - 加密的 vault 数据
	// oldVersion - 旧版本号（用于乐观锁，首次保存传空字符串）
	// 返回新版本号
	// 冲突时返回 error（包含 "Conflict" 字符串）
	Put(username, loginHash string, vault *EncryptedVault, oldVersion string) (string, error)
}
