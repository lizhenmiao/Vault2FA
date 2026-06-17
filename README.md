# Vault2FA - 两步验证保险库

[![CI](https://github.com/lizhenmiao/vault2fa/actions/workflows/ci.yml/badge.svg)](https://github.com/lizhenmiao/vault2fa/actions/workflows/ci.yml)
[![Release](https://github.com/lizhenmiao/vault2fa/actions/workflows/release.yml/badge.svg)](https://github.com/lizhenmiao/vault2fa/actions/workflows/release.yml)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> 自托管、端到端加密、可同步的 Web 端 TOTP 两步验证管理器

解决 Google Authenticator、Microsoft Authenticator 等工具的痛点：
- ❌ 无法同步，换手机数据丢失
- ❌ 迁移困难
- ❌ 依赖第三方服务

## ✨ 特性

- 🔐 **端到端加密** - Argon2id + AES-256-GCM，明文密钥永不离开浏览器
- 🔄 **跨设备同步** - 数据加密存储到你的 Git 仓库或 WebDAV
- 📱 **响应式设计** - PC + 移动端完美适配
- 📴 **离线可用** - PWA 支持，可添加到主屏幕
- 📷 **摄像头扫码** - 快速添加账户
- 🔒 **自动锁定** - 无操作自动上锁
- 🔑 **恢复码** - 忘记密码可用恢复码重置

## 🛠️ 技术栈

**前端：** React + Vite + TypeScript + Tailwind CSS + shadcn/ui  
**加密：** hash-wasm (Argon2id) + Web Crypto API (AES-GCM)  
**TOTP：** otpauth  
**后端：** Go 1.21+ (Chi Router)

---

## 📦 快速开始

### 方式 1：使用构建脚本（推荐）

项目提供了跨平台的构建脚本，方便快速上手。

#### 安装依赖

```bash
# Linux / macOS
make install

# Windows (PowerShell)
.\build.ps1 install
```

#### 开发模式

```bash
# 前端（终端 1）
cd web && npm run dev

# 后端（终端 2）
cd server
cp .env.example .env  # 首次运行需要配置
go run main.go
```

或查看开发模式说明：
```bash
make dev          # Linux / macOS
.\build.ps1 dev   # Windows
```

#### 本地构建测试

```bash
# Linux / macOS
make build

# Windows (PowerShell)
.\build.ps1 build
```

构建产物：`dist/2fa` 或 `dist/2fa.exe`（单一二进制文件，已嵌入静态文件）

#### 清理构建产物

```bash
# Linux / macOS
make clean

# Windows (PowerShell)
.\build.ps1 clean
```

#### 运行测试

```bash
# Linux / macOS
make test

# Windows (PowerShell)
.\build.ps1 test
```

---

### 方式 2：手动运行（不使用构建脚本）

**前端：**
```bash
cd web
npm install
npm run dev
```

访问 `http://localhost:5555`

**后端：**
```bash
cd server
# 复制配置文件
cp .env.example .env
# 编辑 .env 配置存储方式（见下方"存储配置"）

# 运行
go run main.go
```

后端运行在 `http://localhost:3000`

前端会自动代理 `/api` 请求到后端（已在 `vite.config.ts` 配置）。

---

### 方式 3：单文件部署（VPS / 本地服务器）

适合直接在 VPS 或本地服务器上运行。

#### 下载预编译的二进制文件

从 [Releases](https://github.com/lizhenmiao/vault2fa/releases) 页面下载对应平台的二进制文件：

- `vault2fa-linux-amd64` - Linux AMD64
- `vault2fa-linux-arm64` - Linux ARM64
- `vault2fa-freebsd-amd64` - FreeBSD AMD64
- `vault2fa-freebsd-arm64` - FreeBSD ARM64
- `vault2fa-windows-amd64.exe` - Windows AMD64
- `vault2fa-darwin-amd64` - macOS Intel
- `vault2fa-darwin-arm64` - macOS Apple Silicon

#### Linux / macOS 部署

```bash
# 1. 下载二进制文件（以 Linux AMD64 为例）
wget https://github.com/lizhenmiao/vault2fa/releases/latest/download/vault2fa-linux-amd64
chmod +x vault2fa-linux-amd64
mv vault2fa-linux-amd64 vault2fa

# 2. 创建配置文件
cat > .env << 'EOF'
# 服务器端口
PORT=3000

# 存储类型：local / git / webdav
STORAGE_TYPE=local

# Local 存储配置
LOCAL_DATA_DIR=./data

# 如果使用 Git 存储，取消注释并配置：
# STORAGE_TYPE=git
# GIT_API_URL=https://api.github.com
# GIT_TOKEN=your_github_token
# GIT_REPO=username/vault2fa-data

# 如果使用 WebDAV 存储，取消注释并配置：
# STORAGE_TYPE=webdav
# WEBDAV_URL=https://dav.jianguoyun.com/dav
# WEBDAV_USERNAME=your_email@example.com
# WEBDAV_PASSWORD=your_password
# WEBDAV_PATH=/vault2fa
EOF

# 3. 直接运行
./vault2fa

# 或后台运行（使用 nohup）
nohup ./vault2fa &

# 或使用 systemd（推荐生产环境）
```

**日志位置**：
- 应用日志：`./logs/YYYY-MM-DD.log`（按天分割）
- 控制台输出：同时打印到终端

#### Windows 部署

```powershell
# 1. 下载 vault2fa-windows-amd64.exe 并重命名为 vault2fa.exe

# 2. 在同目录下创建 .env 文件（使用记事本或 VS Code）
# 内容参考上方 Linux 示例

# 3. 双击运行 vault2fa.exe
# 或在 PowerShell 中运行：
.\vault2fa.exe
```

#### 使用 systemd 管理（Linux 推荐）

```bash
# 1. 创建 systemd 服务文件
sudo nano /etc/systemd/system/vault2fa.service
```

内容：
```ini
[Unit]
Description=Vault2FA - TOTP Vault Service
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/path/to/vault2fa
ExecStart=/path/to/vault2fa/vault2fa
Restart=on-failure
RestartSec=5s

# 环境变量（也可以使用 EnvironmentFile）
Environment="PORT=3000"
Environment="STORAGE_TYPE=local"
Environment="LOCAL_DATA_DIR=/path/to/vault2fa/data"

[Install]
WantedBy=multi-user.target
```

```bash
# 2. 启动服务
sudo systemctl daemon-reload
sudo systemctl enable vault2fa
sudo systemctl start vault2fa

# 3. 查看状态
sudo systemctl status vault2fa

# 4. 查看日志
sudo journalctl -u vault2fa -f
```

#### 反向代理 + HTTPS（Nginx）

```nginx
server {
    listen 80;
    server_name vault2fa.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name vault2fa.example.com;

    ssl_certificate /etc/letsencrypt/live/vault2fa.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vault2fa.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

### 方式 4：Docker 部署（推荐生产环境）

**Docker 镜像地址**：`ghcr.io/lizhenmiao/vault2fa:latest`

**支持平台**：
- `linux/amd64` - x86_64 架构
- `linux/arm64` - ARM64 架构（如树莓派）

**前提条件：**
- 已安装 Docker 和 Docker Compose

**快速启动（无需克隆项目）：**

```bash
# 1. 创建数据目录
mkdir -p vault2fa/data vault2fa/logs
cd vault2fa

# 2. 创建 docker-compose.yml
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  vault2fa:
    image: ghcr.io/lizhenmiao/vault2fa:latest
    container_name: vault2fa
    ports:
      - "3000:3000"
    environment:
      - STORAGE_TYPE=local
      - LOCAL_DATA_DIR=/app/data
      - PORT=3000
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    restart: unless-stopped
EOF

# 3. 启动服务
docker-compose up -d

# 4. 查看日志
docker-compose logs -f
```

**完整配置步骤：**

1. **克隆项目（可选）**
```bash
git clone https://github.com/lizhenmiao/vault2fa.git
cd vault2fa
```

2. **配置环境变量**

编辑 `docker-compose.yml`，根据你选择的存储方式配置环境变量。

**Local 存储示例：**
```yaml
environment:
  - STORAGE_TYPE=local
  - LOCAL_DATA_DIR=/app/data
  - PORT=3000
volumes:
  - ./data:/app/data
  - ./logs:/app/logs
```

**Git 存储示例：**
```yaml
environment:
  - STORAGE_TYPE=git
  - GIT_API_URL=https://api.github.com
  - GIT_TOKEN=ghp_xxxxxxxxxxxx
  - GIT_REPO=username/2fa-vault
  - PORT=3000
```

3. **启动**
```bash
docker-compose up -d
```

4. **访问**

打开浏览器访问 `http://localhost:3000`

**常用命令**：
```bash
# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down

# 重启服务
docker-compose restart

# 查看容器状态
docker-compose ps
```

**数据持久化**：
- `./data` - Local 存储模式的数据目录
- `./logs` - 后端日志文件（按天分割）

**注意事项**：
- CA 证书已内置在镜像中，用于后端访问 Git API 和 WebDAV 的 HTTPS 请求
- 如需外部 HTTPS 访问，请使用 Nginx 反向代理并配置 SSL 证书
- 容器内二进制文件已嵌入前端静态文件，无 Node.js 运行时

---

## 🗄️ 存储配置

本项目支持三种后端存储方式，通过 `STORAGE_TYPE` 环境变量选择。

### 1. Local 本地存储（推荐单机部署）

数据存储在服务器文件系统。

```bash
STORAGE_TYPE=local
LOCAL_DATA_DIR=./data
```

**优点：** 最简单、最快、无需额外配置  
**缺点：** 单机不跨设备

---

### 2. Git 存储（支持 GitHub / Gitee / Gitea）

数据存储在 Git 仓库，支持历史版本、跨设备同步。

#### GitHub 配置

```bash
STORAGE_TYPE=git
GIT_API_URL=https://api.github.com
GIT_TOKEN=ghp_xxxxxxxxxxxx
GIT_REPO=username/2fa-vault
```

**获取 GitHub Token：**
1. 登录 GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token → 勾选 `repo` 权限
3. 复制 token（只显示一次）

**创建私有仓库：**
1. GitHub → New repository
2. Repository name: `2fa-vault`
3. ✅ Private
4. Create repository

---

#### Gitee 配置

```bash
STORAGE_TYPE=git
GIT_API_URL=https://gitee.com/api/v5
GIT_TOKEN=your_gitee_token
GIT_REPO=username/2fa-vault
```

---

#### Gitea 配置

```bash
STORAGE_TYPE=git
GIT_API_URL=https://gitea.example.com/api/v1
GIT_TOKEN=your_gitea_token
GIT_REPO=username/2fa-vault
```

**优点：** Git 自带版本控制、可跨设备  
**缺点：** 需要配置 Git 仓库 + Token

---

### 3. WebDAV 存储

数据存储在 WebDAV 服务（坚果云、NextCloud 等）。

```bash
STORAGE_TYPE=webdav
WEBDAV_URL=https://dav.jianguoyun.com/dav/
WEBDAV_USERNAME=your-email@example.com
WEBDAV_PASSWORD=your-app-password
WEBDAV_PATH=/2fa-vault
```

**坚果云配置：**
1. 登录坚果云 → 账户信息 → 安全选项 → 添加应用
2. 生成应用密码（不是登录密码）
3. WebDAV 地址：`https://dav.jianguoyun.com/dav/`

**优点：** 兼容性广、易迁移  
**缺点：** 需要 WebDAV 服务

---

## 📊 存储方式对比

| 方案 | 适用场景 | 优点 | 缺点 |
|------|----------|------|------|
| **Local** | VPS 单机部署 | 最简单、最快 | 单机不跨设备 |
| **Git** | 多设备同步、要历史版本 | 版本控制、跨设备 | 需配置仓库 |
| **WebDAV** | 已有网盘（坚果云/NextCloud） | 兼容性广 | 需 WebDAV 服务 |

---

## 🏗️ 架构说明

### 端到端加密 + 双密钥派生

```
用户输入「登录密码」
  ↓ Argon2id(password, salt=SHA256(username))
派生两个密钥
  ├─ 加密密钥（前端用，解密 vault）
  └─ 登录哈希（后端用，鉴权）

前端（浏览器）
  ↓ 用加密密钥解密本地数据
  ↓ 调用 /api/vault（带 loginHash 鉴权）
后端（Go 服务器）
  ↓ 校验 loginHash
  ↓ 根据 STORAGE_TYPE 选择存储
Local / Git / WebDAV
```

**安全保障：**
- 加密密钥永不离开浏览器，后端无法解密
- 后端只存储密文 vault
- loginHash 无法反推出加密密钥（单向哈希）

### 目录结构

```
2fa/
├── web/                    # 前端（React + Vite）
│   ├── src/
│   │   ├── crypto/        # 加密模块
│   │   ├── totp/          # TOTP 模块
│   │   ├── storage/       # IndexedDB
│   │   ├── sync/          # 后端同步
│   │   ├── components/    # UI 组件
│   │   ├── pages/         # 页面
│   │   └── hooks/         # React Hooks
│   └── package.json
│
└── server/                 # 后端（Go）
    ├── main.go            # 入口
    ├── go.mod
    └── internal/
        ├── types/         # 类型定义
        ├── config/        # 配置加载
        ├── handlers/      # HTTP 路由
        └── storage/       # 存储实现
            ├── local.go   # Local 文件系统
            ├── git.go     # Git 存储
            └── webdav.go  # WebDAV 存储
```

---

## 📖 使用说明

### 首次使用

1. **创建保险库**
   - 输入用户名（唯一标识，用于派生加密密钥）
   - 输入登录密码（建议 16+ 字符）
   - **保存恢复码**（纸质或密码管理器保管，只显示一次）

2. **添加 TOTP 账户**
   - 扫码：点击"添加账户" → "相机图标" → 扫描二维码
   - 手动：输入发行方、标签、密钥

3. **查看验证码**
   - 实时刷新，倒计时进度条
   - 点击"复制"按钮快速复制

### 跨设备同步

在另一台设备上：
1. 访问你的 2FA 工具地址
2. 输入**相同的用户名和登录密码**
3. 自动从后端同步所有账户

### 忘记密码

使用恢复码重置：
1. 解锁页面 → 点击"忘记密码？"
2. 输入恢复码 + 新登录密码
3. 重置成功，使用新密码登录

---

## ❓ 常见问题

**Q：为什么不用 Google Authenticator？**  
A：Google Authenticator 无法同步，换手机后数据丢失。

**Q：数据存在哪里？**  
A：本地存在浏览器 IndexedDB，同步时加密存储到你选择的后端（Local / Git / WebDAV）。

**Q：后端能看到我的密钥吗？**  
A：不能。后端只存储加密后的 vault，加密密钥永不离开浏览器。

**Q：忘记登录密码怎么办？**  
A：使用恢复码重置（创建保险库时生成，仅显示一次）。

**Q：支持哪些 TOTP 算法？**  
A：支持 SHA1 / SHA256 / SHA512，6/8 位数字，任意周期（默认 30 秒）。

**Q：可以导入 Google Authenticator 的数据吗？**  
A：可以。Google Authenticator 导出的二维码是标准 otpauth URI，直接扫码导入。

**Q：摄像头扫码不工作？**  
A：浏览器安全限制，摄像头 API 仅在 HTTPS 或 localhost 可用。

**Q：同步失败怎么办？**  
A：检查：
- Git 存储：Token 是否有 `repo` 权限、仓库路径格式（`username/repo`）
- WebDAV 存储：坚果云是否用应用密码（不是登录密码）
- Local 存储：数据目录是否有写权限
- 查看后端日志

---

## 🔧 构建脚本说明

项目提供了跨平台的构建脚本，简化开发和构建流程。

### Makefile（Linux / macOS）

| 命令 | 说明 |
|------|------|
| `make install` | 安装前端和后端依赖 |
| `make dev` | 显示开发模式说明 |
| `make build` | 构建生产版本（前端 + 后端） |
| `make build-frontend` | 仅构建前端 |
| `make build-backend` | 仅构建后端（自动先构建前端） |
| `make clean` | 清理所有构建产物 |
| `make test` | 运行前端和后端测试 |

### build.ps1（Windows PowerShell）

| 命令 | 说明 |
|------|------|
| `.\build.ps1 install` | 安装前端和后端依赖 |
| `.\build.ps1 dev` | 显示开发模式说明 |
| `.\build.ps1 build` | 构建生产版本（前端 + 后端） |
| `.\build.ps1 build-frontend` | 仅构建前端 |
| `.\build.ps1 build-backend` | 仅构建后端（自动先构建前端） |
| `.\build.ps1 clean` | 清理所有构建产物 |
| `.\build.ps1 test` | 运行前端和后端测试 |

### 构建说明

**开发模式**：
- 前端：`npm run dev` - 启动开发服务器（热重载）
- 后端：`go run main.go` - 自动使用外部静态文件目录 `../web/dist`

**生产构建**：
- `make build` 或 `.\build.ps1 build` - 自动执行以下步骤：
  1. 清理旧的构建产物
  2. 构建前端（`npm run build` → `web/dist/`）
  3. 构建后端（`go build` - 自动嵌入 `web/dist/` 到二进制文件）
  4. 输出单一二进制文件：`dist/2fa` 或 `dist/2fa.exe`

**多平台编译**：
- 由 GitHub Actions 自动完成，无需手动构建
- 每次 push tag 时自动构建 5 个平台的二进制文件
- 平台列表：
  - Linux AMD64
  - Linux ARM64
  - Windows AMD64
  - macOS AMD64 (Intel)
  - macOS ARM64 (Apple Silicon)

**如何发布新版本**：

1. 确保代码已提交并推送到 GitHub
2. 创建并推送标签：
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
3. GitHub Actions 自动触发构建和发布
4. 构建完成后，在 Releases 页面查看下载链接

**CI/CD 说明**：
- `ci.yml` - 每次 push 或 PR 时自动运行测试和构建
- `release.yml` - 推送 tag 时自动构建多平台二进制并发布 Release

---

## 📄 许可

MIT License

---

## 🙏 致谢

- [hash-wasm](https://github.com/Daninet/hash-wasm) - Argon2id 实现
- [otpauth](https://github.com/hectorm/otpauth) - TOTP 库
- [shadcn/ui](https://ui.shadcn.com/) - UI 组件库
- [Chi](https://github.com/go-chi/chi) - Go HTTP 路由
