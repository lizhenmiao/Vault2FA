# 多阶段构建 Dockerfile

# 阶段 1: 构建前端
FROM node:20-alpine AS frontend-builder

WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# 阶段 2: 构建后端
FROM golang:alpine AS backend-builder

WORKDIR /app/server
COPY server/go.mod server/go.sum ./

# 设置 GOTOOLCHAIN 允许自动下载需要的 Go 版本
ENV GOTOOLCHAIN=auto
RUN go mod download

COPY server/ ./
COPY --from=frontend-builder /app/web/dist ./static

RUN go build -o vault2fa main.go

# 阶段 3: 运行时镜像
FROM alpine:latest

# 安装 CA 证书（HTTPS 请求需要）
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

# 复制二进制文件
COPY --from=backend-builder /app/server/vault2fa .

# 创建数据目录和日志目录
RUN mkdir -p /app/data /app/logs

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# 运行
CMD ["./vault2fa"]

