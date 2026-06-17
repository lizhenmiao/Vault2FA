.PHONY: help dev build build-frontend build-backend clean install test

# 默认目标
help:
	@echo "可用命令："
	@echo "  make install        - 安装依赖（前端 + 后端）"
	@echo "  make dev            - 开发模式运行说明"
	@echo "  make build          - 构建生产版本（前端 + 后端）"
	@echo "  make build-frontend - 仅构建前端"
	@echo "  make build-backend  - 仅构建后端"
	@echo "  make clean          - 清理构建产物"
	@echo "  make test           - 运行测试"

# 安装依赖
install:
	@echo "==> 安装前端依赖..."
	cd web && npm install
	@echo "==> 安装后端依赖..."
	cd server && go mod download
	@echo "✓ 依赖安装完成"

# 开发模式
dev:
	@echo "==> 开发模式（需要分别启动前后端）"
	@echo "前端: cd web && npm run dev"
	@echo "后端: cd server && go run main.go"

# 构建前端
build-frontend:
	@echo "==> 构建前端..."
	cd web && npm run build
	@echo "==> 复制静态文件到 server/static..."
	rm -rf server/static
	cp -r web/dist server/static
	@echo "✓ 前端构建完成: server/static/"

# 构建后端（生产模式，嵌入静态文件）
build-backend: build-frontend
	@echo "==> 构建后端（嵌入静态文件）..."
	mkdir -p dist
	cd server && go build -o ../dist/vault2fa main.go
	@echo "✓ 后端构建完成: dist/vault2fa"

# 构建完整项目
build: clean build-backend
	@echo "✓ 构建完成: dist/vault2fa"

# 清理构建产物
clean:
	@echo "==> 清理构建产物..."
	rm -rf web/dist
	rm -rf server/static
	rm -rf dist
	rm -rf server/logs
	rm -rf server/data
	@echo "✓ 清理完成"

# 运行测试
test:
	@echo "==> 运行前端测试..."
	cd web && npm run test
	@echo "==> 运行后端测试..."
	cd server && go test ./...
	@echo "✓ 测试完成"

