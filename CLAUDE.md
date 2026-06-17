# 2FA 工具 - Claude 项目指令

> 本项目是一个自托管、端到端加密、可同步的 Web 端 TOTP 两步验证工具。
> 请严格遵守本文档的指令与约定。

---

## 一、项目概况

**项目目标**：做一个手机浏览器可访问的 2FA（TOTP）管理工具，解决主流 Authenticator 迁移难、同步难、换设备丢数据的痛点。

**核心特性**：
- 端到端加密（明文密钥永不离开浏览器）
- 可同步（Git / WebDAV / Local 存储）
- 响应式（PC + 移动端）
- 离线可用（PWA）
- 部署灵活（支持多种存储方式）

**技术栈**：React + Vite + shadcn/ui + Tailwind CSS + Go + IndexedDB

---

## 二、开发环境约定

### 2.1 终端与命令

- 开发环境：**Windows + PowerShell**
- **所有命令示例必须使用 PowerShell 语法**（不要给 Bash/Zsh 命令）
- 路径分隔符：使用 `/` 或 `\`（PowerShell 两者都支持，但优先 `/`）

### 2.2 沟通语言

- **所有回复、注释、文档使用中文**
- 代码中的变量名、函数名使用英文（符合编程规范）

### 2.3 开发流程：先确认再动手

**强制原则**：讨论后不直接开发，先总结方案、询问是否开始，得到明确同意后才动手。

- ❌ **禁止**：讨论完立刻写代码、边讨论边开发、自行判断"应该可以开始了"
- ✅ **正确做法**：
  1. 讨论技术方案、UI 设计、功能细节
  2. 总结成清晰的任务清单或实现方案
  3. **明确问"是否可以开始开发？"**
  4. 等待用户回复"可以"或"开始"后，再调用工具、写代码
  5. 如果用户补充了新想法或提出疑问，回到步骤 1

**原因**：用户可能还有补充问题、突然想到其他需求、或需要时间思考，抢跑会导致返工。

---

## 三、代码规范

### 3.1 封装与复用

**强制原则**：能封装的一律封装，减少冗余代码，提高可维护性。

- 重复逻辑 ≥2 处出现 → 立即提取成函数/组件/hook
- 相关逻辑聚合成模块（如 `crypto/`、`totp/`、`sync/`）
- 工具函数放 `utils/`，类型定义放 `types/`
- React 组件：逻辑用 hook 提取，UI 和逻辑分离

### 3.2 重构与删除

**强制原则**：需要重构就在原函数上重构；无用代码/文件立即删除，不留冗余。

- ❌ **禁止**：注释掉旧代码、添加 `_old`/`_backup` 后缀、创建 `deprecated/` 目录
- ✅ **正确做法**：
  - 重构 → 直接改原函数/文件
  - 删除 → 直接删文件（git 保留历史，无需备份）
  - 重命名 → 同时更新所有引用

### 3.2.5 Go 类型定义规范

**强制原则**：避免类型重复定义，统一类型来源，严格遵守 Go 类型约束。

- **类型定义唯一性**：
  - ❌ **禁止**在多个模块重复定义相同的业务类型（如 `Account`）
  - ✅ 业务类型定义在其领域模块（如 `totp/types.ts`），其他模块通过 import 引用
  - ✅ 共享的基础类型放在对应模块的 `types.ts`，必要时在 `index.ts` 中 re-export
  
- **类型导入优先级**：
  1. 优先从业务模块导入（如 `import type { Account } from '@/totp/types'`）
  2. 避免创建"占位类型"（如用 `algorithm: string` 代替 `algorithm: 'SHA1' | 'SHA256' | 'SHA512'`）
  3. 需要聚合时用 `export type { Account } from './totp/types'` 转发，不复制定义

- **Web Crypto API 类型兼容（TS 6.0+）**：
  - `crypto.subtle` 的参数需显式断言 `as Uint8Array<ArrayBuffer>`（SharedArrayBuffer 不兼容）
  - 示例：`crypto.subtle.importKey('raw', key as Uint8Array<ArrayBuffer>, ...)`

- **联合类型收窄**：
  - 使用 `instanceof` 或类型守卫函数，避免字符串比较（TS 不识别为类型守卫）
  - 示例：`if (otp instanceof TOTP)` 而非 `if (otp.constructor.name === 'TOTP')`

- **开发时验证**：
  - 每次重构后立即运行 `npx tsc -b --noEmit` 静态检查
  - 修复所有类型错误后再提交，不允许残留 `@ts-ignore` 或 `any`

### 3.3 注释规范

**强制要求**：

1. **关键函数必须加注释**
   - 模块导出的公共函数/类
   - 复杂算法或业务逻辑
   - 不直观的工具函数

2. **注释使用中文**
   - 所有注释统一使用中文
   - 文件编码：UTF-8（无 BOM）
   - 开发环境：PowerShell 终端

3. **注释格式**
   ```typescript
   /**
    * 函数功能描述
    * @param paramName - 参数说明
    * @returns 返回值说明
    */
   export function exampleFunction(paramName: string): ReturnType {
     // 实现逻辑的简要说明
   }
   ```

4. **简单逻辑不需要注释**
   - 变量名、函数名已自解释的代码
   - 标准的 CRUD 操作
   - 简单的条件判断

### 3.4 Go 严格模式

- 启用 `strict: true`
- 禁用 `any`（除非与外部库交互不可避免）
- 用 Zod / 自定义 type guard 处理运行时类型校验

### 3.5 命名规范

| 类型 | 格式 | 示例 |
|------|------|------|
| 组件 | PascalCase | `AccountList`, `QRScanner` |
| 函数/变量 | camelCase | `generateTOTP`, `vaultData` |
| 常量 | UPPER_SNAKE_CASE | `TOTP_PERIOD`, `AES_KEY_LENGTH` |
| 类型/接口 | PascalCase + 描述性 | `VaultData`, `StorageProvider` |
| 文件（组件） | PascalCase | `AccountList.tsx` |
| 文件（工具） | kebab-case | `crypto-utils.ts` |

---

## 四、目录结构

```
2fa/
├── web/                      # 前端（React + Vite）
│   ├── src/
│   │   ├── components/       # shadcn/ui 组件 + 自定义组件
│   │   │   └── ui/           # shadcn/ui 生成的基础组件
│   │   ├── crypto/           # 加密模块（信封加密、Argon2id）
│   │   │   ├── argon2.ts     # Argon2id 派生封装
│   │   │   ├── aes.ts        # AES-GCM 加解密封装
│   │   │   ├── envelope.ts   # 信封加密逻辑
│   │   │   ├── recovery.ts   # 恢复码生成与验证
│   │   │   └── types.ts      # 加密相关类型
│   │   ├── totp/             # TOTP 模块
│   │   │   ├── generator.ts  # 验证码生成
│   │   │   ├── parser.ts     # otpauth URI 解析
│   │   │   └── types.ts      # TOTP 账户类型
│   │   ├── storage/          # 本地存储（IndexedDB）
│   │   │   ├── db.ts         # IndexedDB 封装
│   │   │   └── vault.ts      # vault 读写操作
│   │   ├── sync/             # 同步模块
│   │   │   └── api.ts        # 调用后端 /api
│   │   ├── scanner/          # 摄像头扫码
│   │   │   └── qr-scanner.ts # qr-scanner 封装
│   │   ├── hooks/            # 自定义 React hooks
│   │   ├── utils/            # 工具函数
│   │   ├── types/            # 全局类型定义
│   │   ├── pages/            # 页面组件
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── ...
│   ├── public/
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── package.json
├── server/                   # 后端（Go）
│   ├── main.go               # HTTP 服务器入口
│   ├── go.mod
│   ├── go.sum
│   ├── .env.example          # 环境变量示例
│   └── internal/
│       ├── types/
│       │   └── types.go      # 类型定义
│       ├── config/
│       │   └── config.go     # 配置加载
│       ├── handlers/
│       │   └── handlers.go   # HTTP 路由处理
│       └── storage/
│           ├── provider.go   # StorageProvider 接口
│           ├── local.go      # Local 文件系统存储
│           ├── git.go        # Git 存储（GitHub/Gitee/Gitea）
│           ├── webdav.go     # WebDAV 存储
│           └── factory.go    # 工厂函数
├── DEVELOPMENT_PLAN.md       # 开发计划
├── PROGRESS.md               # 开发进度（实时更新）
├── CLAUDE.md                 # 本文件
└── README.md                 # 项目说明
```

---

## 五、安全要求（最高优先级）

### 5.1 加密原则

1. **明文密钥、主密码、DEK 永不离开浏览器**
   - 不能出现在网络请求、日志、localStorage
   - 仅存在于内存（运行时变量）或 IndexedDB 加密缓存

2. **端到端加密**
   - 后端只见密文（vault.json 全密文）
   - Gitea token / WebDAV 密码仅存后端环境变量

3. **KDF 必须用 Argon2id**
   - 不使用 PBKDF2（弱，易 GPU 破解）
   - 参数建议：内存 64MiB、迭代 3 轮、并行度 1（可按设备调整）

4. **AES-256-GCM**
   - 用 Web Crypto API 原生实现
   - 每次加密生成随机 nonce（96 位）
   - 验证 GCM 认证标签防篡改

### 5.2 敏感数据处理

- 恢复码：仅在创建保险库时生成一次，仅显示一次，不持久化
- 自动锁定：无操作 N 分钟后自动上锁，清空内存密钥
- 错误处理：不要在错误信息中泄露敏感信息（如密钥前几位）

### 5.3 HTTPS 强制

- 摄像头 API (`getUserMedia`) 仅在 HTTPS / localhost 可用
- 生产部署必须配 HTTPS（Cloudflare 自带，自建服务器用 Let's Encrypt）

---

## 六、开发流程约定

### 6.1 阶段推进

按 `DEVELOPMENT_PLAN.md` 第五章"开发阶段"顺序推进：

1. **阶段 0**：项目骨架
2. **阶段 1**：加密核心（命门，先做扎实）
3. **阶段 2**：TOTP 核心
4. **阶段 3**：界面（响应式）
5. **阶段 4**：扫码与导入导出
6. **阶段 5**：后端与同步
7. **阶段 6**：PWA 与打磨

**每完成一个阶段的任务，立即更新 `PROGRESS.md`**。

### 6.2 任务完成标准

一个任务算"完成"必须满足：

- ✅ 代码实现且通过测试（关键模块需单元测试）
- ✅ 无冗余代码/文件
- ✅ 符合封装规范（无重复逻辑）
- ✅ `PROGRESS.md` 已更新状态为"✅ 已完成"

### 6.3 优先级

1. **安全性 > 功能完整性 > 用户体验 > 开发速度**
2. 加密模块出问题 → 立即停止，优先修复
3. 其他模块有 bug → 权衡影响面再决定修或绕

---

## 七、依赖管理

### 7.1 前端核心依赖

```json
{
  "dependencies": {
    "react": "^18.x",
    "react-dom": "^18.x",
    "otpauth": "^9.x",
    "qr-scanner": "^1.x",
    "qrcode": "^1.x",
    "hash-wasm": "^4.x"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "latest",
    "vite": "latest",
    "typescript": "latest",
    "tailwindcss": "latest",
    "vite-plugin-pwa": "latest"
  }
}
```

### 7.2 后端核心依赖

Go 标准库 + Chi Router

```bash
cd server
go mod init github.com/yourusername/2fa
go get github.com/go-chi/chi/v5
```

### 7.3 shadcn/ui 组件

**不是 npm 依赖**，用 CLI 复制源码进项目：

```powershell
npx shadcn-ui@latest init   # 初始化
npx shadcn-ui@latest add button input card dialog   # 按需添加组件
```

---

## 八、测试要求

### 8.1 必须有单元测试的模块

- `crypto/` 全部（加密、派生、信封加密、恢复码）
- `totp/` 验证码生成与 URI 解析
- `sync/` 冲突合并逻辑

### 8.2 测试框架

- 前端：Vitest（与 Vite 配套）
- 后端：Go 标准库 `testing` 包

---

## 九、Git 提交规范

### 9.1 提交信息格式

```
<type>(<scope>): <subject>

<body>
```

**type**：
- `feat`：新功能
- `fix`：修复 bug
- `refactor`：重构（不改功能）
- `test`：测试
- `docs`：文档
- `chore`：构建/工具配置

**scope**：模块名（crypto / totp / sync / ui / server 等）

**示例**：
```
feat(crypto): 实现信封加密与恢复码生成

- Argon2id 派生密钥
- AES-GCM 加解密 DEK
- 生成高熵恢复码
```

### 9.2 提交频率

- 完成一个独立功能点 → 提交一次（不要攒太多）
- 重构 → 单独提交（与功能开发分开）

---

## 十、文档维护

### 10.1 实时更新的文档

- **`PROGRESS.md`**：每完成一个任务立即更新状态、时间戳、备注

### 10.2 阶段性更新的文档

- **`DEVELOPMENT_PLAN.md`**：架构/技术栈有重大调整时更新
- **`CLAUDE.md`**（本文件）：新增约定/规范时更新
- **`README.md`**：面向用户的使用说明，后期完善

---

## 十一、特别注意事项

### 11.1 Windows 路径问题

- Go / Vite 在 Windows 下路径分隔符用 `/` 或 `\\`（双反斜杠转义）
- 示例：`E:/gitea_data/2fa` 或 `E:\\gitea_data\\2fa`

### 11.2 shadcn/ui 组件定制

- shadcn/ui 组件复制到 `src/components/ui/` 后，可直接修改源码
- 需要调整样式/行为 → 直接改，不要覆盖样式（保持一致性）

### 11.3 Go 开发与运行

- 开发阶段先本地运行（前端：`cd web && npm run dev`，后端：`cd server && go run main.go`）
- 后端在 `server/` 目录独立，前端在 `web/` 目录独立
- 多平台编译和部署配置后续完善

---

## 十二、问题处理流程

遇到问题时的优先级：

1. **安全问题**（加密、泄露）→ 立即停止，优先修复
2. **阻塞问题**（依赖冲突、构建失败）→ 先解决再继续
3. **功能 bug**（非关键路径）→ 记录 TODO，不阻塞进度
4. **体验优化**（动画、细节）→ 最后阶段打磨

---

## 十三、与 Claude 协作约定

### 13.1 任务确认

- 每开始一个新任务前，简要说明要做什么（一句话即可）
- 完成后报告结果 + 更新 `PROGRESS.md`

### 13.2 代码解释

- 关键模块（加密、同步）添加详细中文注释
- 简单逻辑不需要逐行注释，变量名自解释即可

### 13.3 遇到不确定的选择

- 技术选型有争议 → 先列出优劣，再建议方案
- 安全相关 → 倾向保守方案

### 13.4 职责边界（重要）

**Claude 只负责开发功能，不负责运行与提交。**

- ❌ **不要运行项目**（`npm run dev`、`npm run build`、`go run main.go`、启动服务器等）—— 由用户自己运行验收
- ❌ **不要执行 git 操作**（`git add`、`git commit`、`git push` 等）—— 由用户自己提交
- ✅ **专注写代码**：实现功能、封装模块、重构、删除冗余
- ✅ 完成后更新 `PROGRESS.md`，向用户报告完成了什么，由用户自行验收

> 例外：如需确认类型/语法是否正确，可在必要时做静态检查（如 `tsc --noEmit`、`go build`），但不主动跑构建或启动服务，除非用户明确要求。

### 13.5 Go 项目配置

**环境变量加载**：
- Go 程序使用 `github.com/joho/godotenv` 自动加载 `.env` 文件
- 在 `server/` 目录下创建 `.env` 文件配置参数
- 参考 `.env.example` 查看所有可配置项

---

**本指令最后更新**：2026-06-16

**重要提示**：本文档内容为强制执行，优先级高于 Claude 的默认行为。如有冲突，以本文档为准。
