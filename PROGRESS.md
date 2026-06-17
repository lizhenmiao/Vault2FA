# Vault2FA - 开发进度与架构文档

> **项目简介**：自托管、端到端加密、可同步的 Web 端 TOTP 两步验证工具
> 
> **最后更新**：2026-06-16

---

## 📊 项目信息

- **项目启动时间**：2026-06-12
- **当前状态**：✅ **已完成** - 功能完整，构建系统就绪
- **最后更新**：2026-06-16
- **技术栈**：
  - 前端：React + Vite + TypeScript + Tailwind CSS + shadcn/ui
  - 后端：Go 1.21+ (标准库 + Chi Router)
- **核心特性**：
  - ✅ 端到端加密（Argon2id + AES-256-GCM）
  - ✅ 双密钥派生（登录密码分支 + 恢复码分支）
  - ✅ 多存储支持（Local / Git / WebDAV）
  - ✅ 后端优先同步
  - ✅ PWA 离线支持
  - ✅ 响应式设计
  - ✅ 按天分割日志
  - ✅ 单一二进制部署（静态文件嵌入）

---

## 🏗️ 项目架构

```
2fa/
├── web/                    # 前端（React + Vite）
│   ├── src/
│   │   ├── main.tsx        # 入口文件
│   │   ├── App.tsx         # 路由配置
│   │   ├── pages/          # 页面组件
│   │   ├── components/     # UI 组件
│   │   ├── crypto/         # 加密模块
│   │   ├── totp/           # TOTP 生成
│   │   ├── storage/        # IndexedDB
│   │   ├── sync/           # 后端同步
│   │   ├── hooks/          # 自定义 Hooks
│   │   └── scanner/        # 二维码扫描
│   ├── public/
│   └── dist/               # 构建产物
│
└── server/                 # 后端（Go）
    ├── main.go             # 入口文件
    ├── go.mod              # Go 模块定义
    └── internal/
        ├── types/          # 类型定义
        ├── config/         # 配置加载
        ├── handlers/       # HTTP 路由
        └── storage/        # 存储实现
```

---

## 📁 前端文件清单

### 1. 入口与路由

#### `web/src/main.tsx`
- **功能**：应用入口，挂载 React 根组件
- **依赖**：React 18、React DOM
- **作用**：初始化 React 应用，注册 Service Worker（PWA）

#### `web/src/App.tsx`
- **功能**：根组件，配置路由
- **路由列表**：
  - `/` - 重定向到 /unlock
  - `/unlock` - 解锁保险库
  - `/create` - 创建保险库
  - `/vault` - 保险库主界面
  - `/settings` - 设置页面
  - `/reset-password` - 重置密码（恢复码）
- **作用**：管理页面导航，提供全局布局

---

### 2. 页面组件（`web/src/pages/`）

#### `UnlockPage.tsx`
- **功能**：解锁保险库页面
- **流程**：
  1. 检查后端是否有 vault（`GET /api/vault/exists`）
  2. 有 → 输入登录密码解锁
  3. 无 → 跳转到创建页面
- **关键逻辑**：
  - 使用登录密码 + KDF 派生加密密钥和 loginHash
  - 用 loginHash 从后端拉取加密的 vault
  - 用加密密钥解密 vault
  - 解密成功 → 存入 IndexedDB，跳转到 /vault

#### `CreateVaultPage.tsx`
- **功能**：创建保险库页面
- **流程**：
  1. 输入用户名 + 登录密码
  2. 生成随机 DEK（数据加密密钥）
  3. 生成恢复码（24 位高熵）
  4. 双分支包裹 DEK：
     - 登录密码分支：`Argon2id(password) → wrap(DEK)`
     - 恢复码分支：`Argon2id(recoveryCode) → wrap(DEK)`
  5. 用 DEK 加密空账户列表
  6. 推送到后端（`PUT /api/vault`）
  7. **显示恢复码弹窗**（撒花动画）
- **安全要点**：恢复码只显示一次，不持久化

#### `VaultPage.tsx`
- **功能**：保险库主界面（账户列表 + TOTP 显示）
- **核心功能**：
  - 显示所有账户，每 30 秒刷新 TOTP
  - 搜索账户（按名称、发行者）
  - 添加账户（手动输入 / 扫码）
  - 编辑账户
  - 删除账户
  - 导出单个账户二维码
  - 自动锁定（无操作 N 分钟）
  - 手动同步（拉取/推送后端）
- **同步策略**：
  - 解锁时：拉取后端最新数据
  - 任何修改：立即推送后端
  - 手动同步：强制拉取 + 推送

#### `SettingsPage.tsx`
- **功能**：设置页面
- **设置项**：
  - 自动锁定时间（分钟）
  - 存储方式显示（只读）
  - 退出登录
- **作用**：用户偏好管理

#### `ResetPasswordPage.tsx`
- **功能**：使用恢复码重置登录密码
- **流程**：
  1. 输入恢复码
  2. 输入新登录密码
  3. 用恢复码解密 vault，获取 DEK
  4. 用新密码重新包裹 DEK（生成新的登录密码分支）
  5. 推送到后端
  6. 跳转到 /unlock 重新登录
- **安全要点**：恢复码分支不变，只更新登录密码分支

---

### 3. UI 组件（`web/src/components/`）

#### `AddAccountDialog.tsx`
- **功能**：添加账户对话框
- **输入项**：账户名称、密钥（Base32）、发行者（可选）、算法、周期、位数
- **集成**：支持扫码输入（调用 `QRScannerFullscreen`）

#### `EditAccountDialog.tsx`
- **功能**：编辑账户对话框
- **可编辑**：账户名称、发行者、算法、周期、位数
- **不可编辑**：密钥（安全考虑）

#### `DeleteAccountDialog.tsx`
- **功能**：删除账户确认对话框
- **作用**：防止误删

#### `ExportQRDialog.tsx`
- **功能**：导出单个账户为二维码
- **格式**：`otpauth://totp/...`
- **作用**：方便迁移到其他设备

#### `QRScannerFullscreen.tsx`
- **功能**：全屏二维码扫描器
- **实现**：调用摄像头，识别 `otpauth://` URI
- **依赖**：`qr-scanner` 库

#### `QRImageUpload.tsx`
- **功能**：上传二维码图片解析
- **实现**：读取图片文件，解析二维码内容
- **作用**：替代摄像头扫码

#### `RecoveryCodeDialog.tsx`
- **功能**：恢复码显示弹窗
- **特性**：
  - 撒花动画（庆祝创建成功）
  - 半透明背景遮罩
  - 隐藏关闭按钮（强制用户确认）
  - "复制并前往..." 按钮
- **作用**：确保用户妥善保存恢复码

---

### 4. 基础 UI 组件（`web/src/components/ui/`）

shadcn/ui 生成的基础组件：
- `Button.tsx` - 按钮
- `Card.tsx` - 卡片容器
- `Input.tsx` - 输入框
- `Label.tsx` - 表单标签
- `BaseModal.tsx` - 模态框基础组件

---

### 5. 加密模块（`web/src/crypto/`）

#### `argon2.ts`
- **功能**：Argon2id 密钥派生
- **实现**：调用 `hash-wasm` 库
- **参数**：内存 64MiB、迭代 3 轮、并行度 1
- **输出**：32 字节原始密钥（Uint8Array）

#### `aes.ts`
- **功能**：AES-256-GCM 加解密
- **实现**：Web Crypto API
- **特性**：
  - 随机 nonce（96 位）
  - 认证标签防篡改
  - Base64 编码存储

#### `envelope.ts`
- **功能**：信封加密（Envelope Encryption）
- **流程**：
  1. 生成随机 DEK（256 位）
  2. 用主密钥（MEK）包裹 DEK
  3. 用 DEK 加密数据
- **优点**：支持双分支包裹（登录密码 + 恢复码）

#### `recovery.ts`
- **功能**：生成高熵恢复码
- **格式**：`XXXX-XXXX-XXXX-XXXX-XXXX-XXXX`（24 位大写字母数字）
- **熵**：~124 位（安全）

#### `derive.ts`
- **功能**：双密钥派生
- **输入**：登录密码、盐、KDF 配置
- **输出**：
  - `encryptionKey`：用于加密数据
  - `loginHash`：用于后端鉴权

#### `types.ts`
- **功能**：加密相关类型定义

---

### 6. TOTP 模块（`web/src/totp/`）

#### `generator.ts`
- **功能**：生成 TOTP 验证码
- **算法**：HMAC-SHA1/SHA256/SHA512
- **实现**：调用 `otpauth` 库
- **支持**：自定义周期、位数

#### `parser.ts`
- **功能**：解析 `otpauth://` URI
- **格式**：`otpauth://totp/Issuer:Account?secret=...&issuer=...`
- **输出**：账户对象（名称、密钥、发行者、算法等）

#### `types.ts`
- **功能**：TOTP 账户类型定义

---

### 7. 存储模块（`web/src/storage/`）

#### `db.ts`
- **功能**：IndexedDB 数据库封装
- **表结构**：
  - `vault`：存储解密后的 vault 数据（accounts + settings）
  - `cache`：存储加密的 vault（从后端拉取）
- **作用**：本地缓存，提升性能

#### `vault.ts`
- **功能**：Vault 读写操作
- **方法**：
  - `saveVault()`：保存到 IndexedDB
  - `loadVault()`：从 IndexedDB 加载
  - `clearVault()`：清空（退出登录）

#### `local.ts`
- **功能**：localStorage 工具函数
- **用途**：存储非敏感配置（如自动锁定时间）

---

### 8. 同步模块（`web/src/sync/`）

#### `api.ts`
- **功能**：后端 API 调用封装
- **接口**：
  - `GET /api/vault/exists` - 检查 vault 是否存在
  - `GET /api/vault` - 拉取 vault
  - `PUT /api/vault` - 推送 vault
- **鉴权**：`Authorization: Bearer <loginHash>`

---

### 9. 自定义 Hooks（`web/src/hooks/`）

#### `useVault.tsx`
- **功能**：Vault 状态管理
- **提供**：
  - 账户列表
  - 添加/编辑/删除账户
  - 同步方法
  - 解锁/锁定状态
- **作用**：全局状态管理

#### `useAutoLock.ts`
- **功能**：自动锁定逻辑
- **实现**：监听用户活动，无操作 N 分钟后自动锁定
- **作用**：安全保护

---

## 📁 后端文件清单

### 1. 入口文件

#### `server/main.go`
- **功能**：HTTP 服务器入口
- **流程**：
  1. 加载环境变量配置
  2. 初始化存储提供者（Local/Git/WebDAV）
  3. 初始化路由处理器
  4. 配置 Chi Router
  5. 启动 HTTP 服务器（默认端口 3000）
- **路由**：
  - `GET /api/vault/exists` - 检查 vault 是否存在
  - `GET /api/vault` - 拉取 vault
  - `PUT /api/vault` - 推送 vault
  - `GET /health` - 健康检查
  - `GET /*` - 静态文件服务（前端）
- **中间件**：
  - Logger：请求日志
  - Recoverer：恐慌恢复
  - CORS：跨域支持

---

### 2. 类型定义（`server/internal/types/`）

#### `types.go`
- **功能**：后端类型定义
- **核心类型**：
  - `KdfConfig`：KDF 配置（算法、内存、迭代次数、并行度）
  - `WrappedKey`：包裹的密钥（盐、nonce、密文）
  - `EncryptedVault`：加密的保险库（版本、用户名、KDF、loginHash、包裹的密钥、加密的 vault、更新时间）
  - `VaultResponse`：vault 响应（vault + 版本号）
  - `StorageProvider`：存储提供者接口
    - `Exists() (bool, error)` - 检查是否存在
    - `Get(username, loginHash string) (*VaultResponse, error)` - 获取 vault
    - `Put(username, loginHash string, vault *EncryptedVault, oldVersion string) (string, error)` - 保存 vault

---

### 3. 配置加载（`server/internal/config/`）

#### `config.go`
- **功能**：从环境变量加载配置
- **环境变量**：
  - `PORT`：服务器端口（默认 3000）
  - `STORAGE_TYPE`：存储类型（local / git / webdav）
  - **Local 配置**：
    - `LOCAL_DATA_DIR`：数据目录路径
  - **Git 配置**：
    - `GIT_API_URL`：Git API 地址
    - `GIT_TOKEN`：Personal Access Token
    - `GIT_REPO`：仓库路径（owner/repo）
  - **WebDAV 配置**：
    - `WEBDAV_URL`：WebDAV 服务器地址
    - `WEBDAV_USERNAME`：用户名
    - `WEBDAV_PASSWORD`：密码
    - `WEBDAV_PATH`：存储路径（默认 /2fa-vault）

---

### 4. HTTP 路由处理（`server/internal/handlers/`）

#### `handlers.go`
- **功能**：HTTP 请求处理
- **Handler 结构体**：持有 StorageProvider 实例
- **方法**：
  - `GetVaultExists(w, r)` - 处理 `GET /api/vault/exists`
    - 调用 `storage.Exists()`
    - 返回 `{exists: true/false}`
  - `GetVault(w, r)` - 处理 `GET /api/vault`
    - 解析 `Authorization: Bearer <loginHash>`
    - 调用 `storage.Get(username, loginHash)`
    - 返回 `{vault, version}`
  - `PutVault(w, r)` - 处理 `PUT /api/vault`
    - 解析请求体 `{vault, version}`
    - 调用 `storage.Put(username, loginHash, vault, oldVersion)`
    - 返回 `{version}`
    - 冲突时返回 409
  - `HealthCheck(w, r)` - 处理 `GET /health`
    - 返回 `{status: "ok"}`

---

### 5. 存储实现（`server/internal/storage/`）

#### `provider.go`
- **功能**：存储提供者接口定义
- **作用**：重新导出 `types.StorageProvider`

#### `factory.go`
- **功能**：存储提供者工厂
- **方法**：`NewProvider(cfg *config.Config) (Provider, error)`
- **作用**：根据配置创建对应的存储实现

#### `local.go`
- **功能**：Local 本地文件系统存储
- **实现**：
  - `Exists()` - 检查 `vault.json` 是否存在
  - `Get()` - 读取文件，校验 loginHash，返回 vault + mtime 作为版本号
  - `Put()` - 乐观锁（比对 mtime），写入文件
- **文件结构**：`data/2fa/vault.json`
- **版本控制**：使用文件修改时间（mtime）毫秒时间戳
- **优点**：最简单、性能最好
- **缺点**：单机不跨设备

#### `git.go`
- **功能**：Git 存储（支持 GitHub / Gitee / Gitea）
- **实现**：
  - `Exists()` - `HEAD` 请求检查文件
  - `Get()` - `GET` 请求获取文件，Base64 解码
  - `Put()` - `PUT` 请求更新文件，Base64 编码，传 SHA 做乐观锁
- **API**：Git Contents API（`/repos/{owner}/{repo}/contents/{path}`）
- **版本控制**：使用 Git SHA
- **优点**：Git 自带版本控制、可跨设备
- **缺点**：需要配置 Git 仓库 + Token

#### `webdav.go`
- **功能**：WebDAV 存储（支持坚果云 / NextCloud）
- **实现**：
  - `Exists()` - `HEAD` 请求检查文件
  - `Get()` - `GET` 请求获取文件
  - `Put()` - `PUT` 请求上传文件，使用 `If-Match` 做乐观锁
- **认证**：Basic Auth
- **版本控制**：使用 ETag
- **优点**：兼容性广、易迁移
- **缺点**：需要 WebDAV 服务

---

## 🔐 安全设计

### 1. 端到端加密

- **加密算法**：AES-256-GCM
- **密钥派生**：Argon2id（内存 64MiB、迭代 3 轮）
- **明文密钥永不离开浏览器**：
  - 登录密码 → 仅在浏览器内存
  - DEK → 仅在浏览器内存
  - 后端只存加密后的 vault

### 2. 双密钥派生

从登录密码派生两个独立的密钥：
1. **encryptionKey**：用于加密数据
2. **loginHash**：用于后端鉴权

优点：后端无法解密数据（只有 loginHash，没有 encryptionKey）

### 3. 双分支包裹 DEK

- **登录密码分支**：日常解锁
- **恢复码分支**：忘记密码时恢复

任一分支都能解开 DEK，两个分支独立。

### 4. 乐观锁

防止并发修改冲突：
- Local：比对 mtime
- Git：比对 SHA
- WebDAV：比对 ETag

---

## 🔄 同步策略

### 后端优先

- **解锁时**：优先从后端拉取最新数据
- **任何修改**：立即推送后端
- **IndexedDB**：仅作为缓存，提升性能

### 冲突处理

- 检测到版本号不匹配 → 返回 409 Conflict
- 前端提示用户手动解决冲突

---

## ✅ 已完成功能

### 前端
- ✅ 创建保险库
- ✅ 解锁保险库（登录密码）
- ✅ 重置密码（恢复码）
- ✅ 添加账户（手动 / 扫码）
- ✅ 编辑账户
- ✅ 删除账户
- ✅ TOTP 生成（30 秒自动刷新）
- ✅ 搜索账户
- ✅ 导出单个账户二维码
- ✅ 自动锁定
- ✅ 手动同步
- ✅ 退出登录
- ✅ PWA 支持

### 后端
- ✅ Local 存储
- ✅ Git 存储（GitHub / Gitee / Gitea）
- ✅ WebDAV 存储（坚果云 / NextCloud）
- ✅ API 接口（exists / get / put / health）
- ✅ CORS 支持
- ✅ 日志中间件
- ✅ 恐慌恢复

---

## 📝 待完成（后续优化）

- ⏸️ 静态文件嵌入（embed）编译问题
- ⏸️ 构建脚本（Makefile / Dockerfile / GitHub Actions）
- ⏸️ 多平台二进制打包
- ⏸️ 单元测试
- ⏸️ 性能优化
- ⏸️ 错误处理增强

---

**项目已 100% 功能完成，可以开始本地测试！** 🎉

---

## 🆕 最新更新（2026-06-16）

### 1. 日志系统
- ✅ 创建 `internal/logger/logger.go` - 统一日志管理
- ✅ 按天分割日志文件（格式：`YYYY-MM-DD.log`）
- ✅ 同时输出到控制台和文件
- ✅ 自动轮转（每天凌晨检查）
- ✅ 日志目录：`server/logs/`

### 2. 静态文件嵌入
- ✅ 生产模式：静态文件嵌入到二进制（`static_prod.go`）
- ✅ 开发模式：使用外部目录（`static_dev.go`）
- ✅ 条件编译支持（`-tags dev`）

### 3. 构建系统
- ✅ **Makefile** - Linux/macOS 构建脚本
  - `make install` - 安装依赖
  - `make build` - 构建生产版本
  - `make release` - 多平台编译
  - `make clean` - 清理构建产物
- ✅ **build.ps1** - Windows PowerShell 构建脚本
  - 完整支持所有 make 命令
  - 彩色输出，更友好
- ✅ **Dockerfile** - 多阶段构建
  - 前端构建（Node 20）
  - 后端构建（Go 1.21）
  - 运行时镜像（Alpine）
  - 健康检查
- ✅ **docker-compose.yml** - 一键部署
  - 支持三种存储配置
  - 数据持久化
- ✅ **.dockerignore** - 优化镜像大小

### 4. 环境变量支持
- ✅ 集成 `godotenv` - 自动加载 `.env` 文件
- ✅ 创建 `server/.env.example` - 配置示例

---

## 📦 构建与部署

### 开发模式
```bash
# 前端
cd web && npm run dev

# 后端（开发模式，使用外部静态文件）
cd server && go run -tags dev main.go
```

### 生产构建
```bash
# Linux/macOS
make build

# Windows
.\build.ps1 build

# 产物：dist/2fa.exe（单一二进制文件）
```

### 多平台编译
```bash
# Linux/macOS
make release

# Windows
.\build.ps1 release

# 产物：
# - dist/2fa-linux-amd64
# - dist/2fa-linux-arm64
# - dist/2fa-windows-amd64.exe
# - dist/2fa-darwin-amd64
# - dist/2fa-darwin-arm64
```

### Docker 部署
```bash
# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

---

## ✅ 已完成功能清单

### 前端
- ✅ 创建保险库
- ✅ 解锁保险库（登录密码）
- ✅ 重置密码（恢复码）
- ✅ 添加账户（手动 / 扫码）
- ✅ 编辑账户
- ✅ 删除账户
- ✅ TOTP 生成（30 秒自动刷新）
- ✅ 搜索账户
- ✅ 导出单个账户二维码
- ✅ 自动锁定
- ✅ 手动同步
- ✅ 退出登录
- ✅ PWA 支持

### 后端
- ✅ Local 存储（文件系统）
- ✅ Git 存储（GitHub / Gitee / Gitea）
- ✅ WebDAV 存储（坚果云 / NextCloud）
- ✅ API 接口（exists / get / put / health）
- ✅ CORS 支持
- ✅ 日志中间件
- ✅ 恐慌恢复
- ✅ 按天分割日志
- ✅ 环境变量配置（.env 支持）

### 构建与部署
- ✅ 静态文件嵌入（生产模式）
- ✅ 开发/生产模式切换
- ✅ Makefile（Linux/macOS）
- ✅ PowerShell 脚本（Windows）
- ✅ Dockerfile（多阶段构建）
- ✅ docker-compose.yml
- ✅ 多平台编译支持

---

## 📝 待完成（可选优化）

### 功能增强
- ⏸️ 健康检查增强（返回详细信息）
- ⏸️ 请求限流（防止暴力破解）
- ⏸️ 详细错误码定义

### 测试
- ⏸️ 后端单元测试（storage 层）
- ⏸️ 集成测试（API 端到端）

### CI/CD
- ⏸️ GitHub Actions 自动构建
- ⏸️ 自动发布 Release

---

**项目已 100% 功能完成 + 构建系统就绪，可以直接部署使用！** 🎉

---

## 🆕 最新更新（2026-06-16 补充）

### GitHub Actions CI/CD

- ✅ **ci.yml** - 持续集成
  - 自动测试（前端 + 后端）
  - 自动构建验证
  - 触发条件：push 或 PR 到 main/master/develop 分支

- ✅ **release.yml** - 自动发布
  - 多平台编译（5 个平台）
  - 自动创建 GitHub Release
  - 自动上传二进制文件
  - 触发条件：push tag（如 `v1.0.0`）

### 构建系统优化

- ✅ 简化静态文件处理 - 合并到 `main.go`，自动判断开发/生产模式
- ✅ 移除多平台编译命令 - 交给 GitHub Actions
- ✅ Makefile 和 build.ps1 保留为本地开发工具
- ✅ README.md 完善 - 添加构建脚本说明和 CI/CD 徽章

---

**项目现已完全实现 CI/CD 自动化！** 🚀

---

## 🎯 项目重命名（2026-06-16）

**项目名从 `2fa` 更名为 `vault2fa`**

**原因**：
- ❌ `2fa` 过于通用，GitHub 上重名太多
- ❌ 不够特色，难以搜索和记忆
- ✅ `vault2fa` 突出"保险库"概念，更有辨识度

**已更新**：
- ✅ Go module 名称：`github.com/lizhenmiao/vault2fa`
- ✅ 所有 Go 文件 import 路径
- ✅ README.md 标题和示例
- ✅ GitHub Actions badge URL
- ✅ PROGRESS.md 标题

---

**项目现已准备好提交到 GitHub！** 🚀
