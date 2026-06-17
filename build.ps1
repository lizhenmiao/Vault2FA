# 2FA 构建脚本 (PowerShell)

param(
    [string]$Target = "build"
)

function Show-Help {
    Write-Host "可用命令："
    Write-Host "  .\build.ps1 install        - 安装依赖（前端 + 后端）"
    Write-Host "  .\build.ps1 dev            - 开发模式说明"
    Write-Host "  .\build.ps1 build          - 构建生产版本（前端 + 后端）"
    Write-Host "  .\build.ps1 build-frontend - 仅构建前端"
    Write-Host "  .\build.ps1 build-backend  - 仅构建后端"
    Write-Host "  .\build.ps1 clean          - 清理构建产物"
    Write-Host "  .\build.ps1 test           - 运行测试"
}

function Install-Dependencies {
    Write-Host "==> 安装前端依赖..." -ForegroundColor Green
    Set-Location web
    npm install
    Set-Location ..

    Write-Host "==> 安装后端依赖..." -ForegroundColor Green
    Set-Location server
    go mod download
    Set-Location ..

    Write-Host "✓ 依赖安装完成" -ForegroundColor Green
}

function Show-Dev {
    Write-Host "==> 开发模式（需要分别启动前后端）" -ForegroundColor Yellow
    Write-Host "前端: cd web && npm run dev"
    Write-Host "后端: cd server && go run main.go"
}

function Build-Frontend {
    Write-Host "==> 构建前端..." -ForegroundColor Green
    Set-Location web
    npm run build
    Set-Location ..

    Write-Host "==> 复制静态文件到 server/static..." -ForegroundColor Green
    if (Test-Path "server/static") {
        Remove-Item -Recurse -Force "server/static"
    }
    Copy-Item -Recurse "web/dist" "server/static"

    Write-Host "✓ 前端构建完成: server/static/" -ForegroundColor Green
}

function Build-Backend {
    Build-Frontend
    Write-Host "==> 构建后端（嵌入静态文件）..." -ForegroundColor Green

    if (!(Test-Path "dist")) {
        New-Item -ItemType Directory -Path "dist" | Out-Null
    }

    Set-Location server
    go build -o ../dist/vault2fa.exe main.go
    Set-Location ..

    Write-Host "✓ 后端构建完成: dist/vault2fa.exe" -ForegroundColor Green
}

function Build-All {
    Clean-Build
    Build-Backend
    Write-Host "✓ 构建完成: dist/vault2fa.exe" -ForegroundColor Green
}

function Clean-Build {
    Write-Host "==> 清理构建产物..." -ForegroundColor Yellow

    if (Test-Path "web/dist") {
        Remove-Item -Recurse -Force "web/dist"
    }
    if (Test-Path "server/static") {
        Remove-Item -Recurse -Force "server/static"
    }
    if (Test-Path "dist") {
        Remove-Item -Recurse -Force "dist"
    }
    if (Test-Path "server/logs") {
        Remove-Item -Recurse -Force "server/logs"
    }
    if (Test-Path "server/data") {
        Remove-Item -Recurse -Force "server/data"
    }

    Write-Host "✓ 清理完成" -ForegroundColor Green
}

function Run-Tests {
    Write-Host "==> 运行前端测试..." -ForegroundColor Green
    Set-Location web
    npm run test
    Set-Location ..

    Write-Host "==> 运行后端测试..." -ForegroundColor Green
    Set-Location server
    go test ./...
    Set-Location ..

    Write-Host "✓ 测试完成" -ForegroundColor Green
}

# 主逻辑
switch ($Target) {
    "install" { Install-Dependencies }
    "dev" { Show-Dev }
    "build" { Build-All }
    "build-frontend" { Build-Frontend }
    "build-backend" { Build-Backend }
    "clean" { Clean-Build }
    "test" { Run-Tests }
    "help" { Show-Help }
    default { Show-Help }
}

