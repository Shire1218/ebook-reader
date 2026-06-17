# 墨卷 Electron 开发环境安全评估与隔离方案

## 一、开发活动影响评估

### 1.1 系统环境配置影响

| 影响项 | 影响程度 | 具体影响 | 可逆性 |
|--------|---------|---------|--------|
| **Node.js 安装** | 中 | 添加系统 PATH、环境变量 | ✅ 完全可逆 |
| **npm 全局包** | 低 | 用户目录下安装全局包 | ✅ 完全可逆 |
| **项目依赖** | 无 | 仅项目目录内 node_modules | ✅ 完全可逆 |
| **Electron 缓存** | 低 | 用户目录缓存（~500MB） | ✅ 完全可逆 |
| **构建工具** | 低 | Vite、TypeScript 等本地依赖 | ✅ 完全可逆 |

#### 详细分析

**Node.js 安装影响：**
```
安装位置：C:\Program Files\nodejs\
系统 PATH 添加：
  - C:\Program Files\nodejs\
  
环境变量添加：
  - NODE_PATH（可选）
  
磁盘占用：
  - Node.js 运行时：~80MB
  - npm 缓存：%APPDATA%\npm-cache（可清理）
```

**npm 全局包影响：**
```
安装位置：%APPDATA%\npm\
系统 PATH 添加：
  - %APPDATA%\npm\
  
可能安装的全局包：
  - electron（~200MB）
  - electron-builder（~50MB）
  - typescript（~50MB）
```

### 1.2 操作系统设置影响

| 影响项 | 影响程度 | 具体影响 | 可逆性 |
|--------|---------|---------|--------|
| **文件关联** | 高 | 注册表修改（.epub/.pdf/.txt/.mobi） | ⚠️ 需手动恢复 |
| **开始菜单快捷方式** | 低 | 添加应用快捷方式 | ✅ 完全可逆 |
| **桌面快捷方式** | 低 | 添加桌面图标 | ✅ 完全可逆 |
| **系统托盘** | 无 | 运行时临时图标 | ✅ 自动清理 |
| **注册表项** | 中 | 卸载信息、文件关联 | ⚠️ 需手动清理 |
| **防火墙规则** | 低 | 本地服务端口（3000/5174） | ✅ 自动清理 |

#### 详细分析

**文件关联注册表修改：**
```registry
Windows Registry Editor Version 5.00

; EPUB 文件关联
[HKEY_CLASSES_ROOT\.epub]
@="Inking.epub"

[HKEY_CLASSES_ROOT\Inking.epub]
@="EPUB 电子书"

[HKEY_CLASSES_ROOT\Inking.epub\shell\open\command]
@="\"C:\\Program Files\\墨卷\\墨卷.exe\" \"%1\""

; PDF/TXT/MOBI 类似...
```

**安装程序注册表项：**
```registry
[HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{app-id}]
DisplayName=墨卷
UninstallString="C:\Program Files\墨卷\unins000.exe"
InstallLocation=C:\Program Files\墨卷\
```

### 1.3 已安装软件影响

| 影响项 | 影响程度 | 具体影响 | 风险等级 |
|--------|---------|---------|---------|
| **端口占用** | 中 | 3000（后端）、5174（前端） | 🟡 低 |
| **进程冲突** | 低 | Node.js 进程、Electron 进程 | 🟢 无 |
| **杀毒软件误报** | 中 | 未签名的 exe 可能触发告警 | 🟡 中 |
| **其他开发工具** | 无 | 与 VS Code、Git 等无冲突 | 🟢 无 |

#### 端口冲突检查

```powershell
# 检查端口 3000 是否被占用
netstat -ano | findstr :3000

# 检查端口 5174 是否被占用
netstat -ano | findstr :5174

# 如果被占用，可以修改配置：
# - 后端端口：server/src/config.ts 修改 port
# - 前端端口：vite.config.ts 修改 server.port
```

### 1.4 用户数据安全评估

| 数据类型 | 存储位置 | 风险等级 | 保护措施 |
|---------|---------|---------|---------|
| **项目源代码** | `e:\chrome\book\` | 🟢 安全 | Git 版本控制 |
| **开发数据库** | 项目目录内 | 🟢 安全 | 测试数据，可删除 |
| **应用数据** | `%APPDATA%\墨卷\` | 🟡 需注意 | 与生产数据隔离 |
| **测试书籍文件** | 应用数据目录 | 🟢 安全 | 测试数据，可删除 |
| **用户配置** | `%APPDATA%\墨卷\config.json` | 🟡 需注意 | 开发配置，可重置 |

#### 数据隔离策略

```
生产环境数据：
  %APPDATA%\墨卷\
  ├── db\inking.db          # 用户真实数据
  ├── books\                # 用户书籍
  └── config.json           # 用户配置

开发环境数据（隔离）：
  %APPDATA%\墨卷-dev\       # 使用不同的 app name
  ├── db\inking.db          # 开发测试数据
  ├── books\                # 测试书籍
  └── config.json           # 开发配置
```

---

## 二、系统兼容性评估

### 2.1 当前系统环境检查

```powershell
# 系统信息检查
systeminfo | findstr /B /C:"OS Name" /C:"OS Version" /C:"System Type"

# 磁盘空间检查
wmic logicaldisk get size,freespace,caption

# 内存检查
wmic OS get FreePhysicalMemory,TotalVisibleMemorySize /Value

# Node.js 版本检查（如已安装）
node --version
npm --version

# Git 版本检查
git --version
```

### 2.2 必需软件清单

| 软件 | 版本要求 | 用途 | 是否已安装 |
|------|---------|------|-----------|
| **Node.js** | 18.x 或 20.x LTS | JavaScript 运行时 | ❓ 待检查 |
| **npm** | 9.x+ | 包管理器 | ❓ 随 Node.js 安装 |
| **Git** | 2.x+ | 版本控制 | ❓ 待检查 |
| **VS Code** | 最新版 | 代码编辑器（可选） | ❓ 待检查 |

### 2.3 可选软件清单

| 软件 | 版本要求 | 用途 | 是否必需 |
|------|---------|------|---------|
| **Visual Studio Build Tools** | 2019+ | 编译原生模块 | 仅 Windows |
| **Python** | 3.x | node-gyp 依赖 | 仅编译原生模块时 |

---

## 三、安全风险评估

### 3.1 开发过程风险

| 风险项 | 风险等级 | 影响范围 | 缓解措施 |
|--------|---------|---------|---------|
| **依赖包安全** | 🟡 中 | 项目代码 | 使用 npm audit 检查 |
| **端口暴露** | 🟢 低 | 本地网络 | 仅监听 localhost |
| **代码执行** | 🟡 中 | 开发机 | 不运行未知脚本 |
| **数据泄露** | 🟢 低 | 测试数据 | 不使用真实用户数据 |
| **系统权限** | 🟡 中 | 安装时 | 避免使用管理员权限 |

### 3.2 运行时风险

| 风险项 | 风险等级 | 影响范围 | 缓解措施 |
|--------|---------|---------|---------|
| **内存占用** | 🟡 中 | 系统性能 | 设置内存上限监控 |
| **CPU 占用** | 🟢 低 | 系统性能 | 开发时限制进程优先级 |
| **磁盘 I/O** | 🟢 低 | 系统性能 | 避免频繁大文件操作 |
| **网络请求** | 🟢 低 | 网络带宽 | 仅本地通信 |

### 3.3 安装部署风险

| 风险项 | 风险等级 | 影响范围 | 缓解措施 |
|--------|---------|---------|---------|
| **注册表修改** | 🟡 中 | 系统配置 | 安装前备份注册表 |
| **文件关联覆盖** | 🟡 中 | 其他应用 | 提供卸载清理脚本 |
| **杀毒软件误报** | 🟡 中 | 应用运行 | 添加排除目录 |
| **权限提升** | 🟡 中 | 系统安全 | 使用用户级安装 |

---

## 四、隔离措施方案

### 4.1 方案 A：用户账户隔离（推荐）

**原理**：创建专用的开发用户账户，与日常使用账户完全隔离。

**实施步骤：**

1. **创建开发账户**
```powershell
# 以管理员身份运行
net user InkingDev Password123! /add
net localgroup Users InkingDev /add

# 设置用户目录
# 用户目录：C:\Users\InkingDev\
```

2. **配置开发环境**
```powershell
# 切换到 InkingDev 账户
# 安装 Node.js（仅当前用户）
# 安装开发工具
# 克隆项目到 C:\Users\InkingDev\Projects\book\
```

3. **权限控制**
```powershell
# 开发账户权限：
# - 标准用户权限（非管理员）
# - 无法修改系统目录
# - 无法安装系统级软件
# - 可以运行开发服务器
```

**优点：**
- ✅ 完全隔离，不影响主账户
- ✅ 可以自由安装/卸载开发工具
- ✅ 测试文件关联等系统功能
- ✅ 随时可以删除整个账户

**缺点：**
- ⚠️ 需要切换账户
- ⚠️ 占用额外磁盘空间（~5GB）

### 4.2 方案 B：虚拟机隔离（最安全）

**原理**：在虚拟机中运行完整的开发环境。

**实施步骤：**

1. **安装虚拟化软件**
```
推荐：
- VirtualBox（免费）
- VMware Workstation Player（免费个人使用）
- Hyper-V（Windows Pro 内置）
```

2. **创建 Windows 虚拟机**
```
配置建议：
- CPU：2 核心
- 内存：4-8GB
- 硬盘：40-60GB
- 网络：NAT 模式
```

3. **配置开发环境**
```
在虚拟机中：
- 安装 Node.js
- 安装 Git
- 安装 VS Code
- 克隆项目
- 安装依赖
```

**优点：**
- ✅ 完全隔离，零风险
- ✅ 可以随意测试系统级功能
- ✅ 支持快照和回滚
- ✅ 不影响宿主系统

**缺点：**
- ⚠️ 性能开销（10-20%）
- ⚠️ 占用额外磁盘空间（~20GB）
- ⚠️ 需要 Windows 许可证

### 4.3 方案 C：Docker 容器隔离（部分隔离）

**原理**：使用 Docker 容器运行开发环境（仅限后端）。

**实施步骤：**

1. **安装 Docker Desktop**
```
下载：https://www.docker.com/products/docker-desktop
要求：Windows 10/11 Pro 或 Home（WSL 2）
```

2. **创建开发容器**
```dockerfile
# Dockerfile.dev
FROM node:20-slim

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm install

# 复制源代码
COPY . .

# 暴露端口
EXPOSE 3000 5174

# 启动开发服务器
CMD ["npm", "run", "dev:all"]
```

3. **运行容器**
```bash
docker build -f Dockerfile.dev -t inking-dev .
docker run -p 3000:3000 -p 5174:5174 -v ${PWD}:/app -it inking-dev
```

**优点：**
- ✅ 环境一致性
- ✅ 快速启动/销毁
- ✅ 不影响系统配置

**缺点：**
- ⚠️ 仅适用于后端开发
- ⚠️ Electron 桌面应用无法在容器中运行
- ⚠️ 需要 Docker Desktop（资源占用）

### 4.4 方案 D：目录隔离（最简单）

**原理**：在同一系统中使用独立目录，避免全局安装。

**实施步骤：**

1. **项目目录结构**
```
e:\chrome\book\                    # 项目根目录
├── .env.development               # 开发环境变量
├── .electron-cache\               # Electron 缓存（项目内）
├── node_modules\                  # 项目依赖（本地）
├── data-dev\                      # 开发数据目录
│   ├── db\                        # 开发数据库
│   ├── books\                     # 测试书籍
│   └── config.json                # 开发配置
└── ...
```

2. **环境变量配置**
```bash
# .env.development
ELECTRON_USER_DATA_PATH=./data-dev
PORT=3000
VITE_PORT=5174
NODE_ENV=development
```

3. **本地安装 Electron**
```bash
# 仅项目内安装，不全局安装
npm install --save-dev electron

# 使用 npx 运行
npx electron .
```

4. **应用数据隔离**
```typescript
// electron/main.ts - 修改应用数据路径
import { app } from 'electron';
import path from 'path';

// 开发环境使用独立的数据目录
if (process.env.NODE_ENV === 'development') {
  const devDataPath = path.join(__dirname, '../data-dev');
  app.setPath('userData', devDataPath);
}
```

**优点：**
- ✅ 无需额外配置
- ✅ 不占用额外空间
- ✅ 快速切换
- ✅ 易于清理

**缺点：**
- ⚠️ 无法测试文件关联等系统功能
- ⚠️ 无法测试安装程序
- ⚠️ 隔离程度有限

### 4.5 隔离方案对比

| 方案 | 隔离程度 | 实施难度 | 资源占用 | 推荐场景 |
|------|---------|---------|---------|---------|
| **用户账户隔离** | ⭐⭐⭐⭐ | 中 | 中 | 需要测试系统功能 |
| **虚拟机隔离** | ⭐⭐⭐⭐⭐ | 高 | 高 | 最高安全要求 |
| **Docker 容器** | ⭐⭐⭐ | 中 | 中 | 仅后端开发 |
| **目录隔离** | ⭐⭐ | 低 | 低 | 快速开发迭代 |

**推荐方案**：
- **开发阶段**：方案 D（目录隔离）+ 方案 A（用户账户隔离）
- **测试阶段**：方案 A（用户账户隔离）或方案 B（虚拟机）
- **部署测试**：方案 B（虚拟机）

---

## 五、回滚方案

### 5.1 系统还原点

**创建还原点：**

```powershell
# 以管理员身份运行 PowerShell

# 启用系统保护（如果未启用）
Enable-ComputerRestore -Drive "C:\"

# 创建还原点
Checkpoint-Computer -Description "墨卷开发前" -RestorePointType "MODIFY_SETTINGS"

# 查看还原点
Get-ComputerRestorePoint
```

**恢复还原点：**

```powershell
# 方法 1：命令行恢复
# 以管理员身份运行
rstrui.exe

# 方法 2：图形界面
# 控制面板 -> 系统 -> 系统保护 -> 系统还原
```

### 5.2 注册表备份

**备份注册表：**

```powershell
# 备份文件关联相关注册表
reg export "HKEY_CLASSES_ROOT\.epub" "%USERPROFILE%\Desktop\backup_epub.reg" /y
reg export "HKEY_CLASSES_ROOT\.pdf" "%USERPROFILE%\Desktop\backup_pdf.reg" /y
reg export "HKEY_CLASSES_ROOT\.txt" "%USERPROFILE%\Desktop\backup_txt.reg" /y
reg export "HKEY_CLASSES_ROOT\.mobi" "%USERPROFILE%\Desktop\backup_mobi.reg" /y

# 备份卸载信息
reg export "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall" "%USERPROFILE%\Desktop\backup_uninstall.reg" /y
```

**恢复注册表：**

```powershell
# 双击 .reg 文件导入
# 或命令行导入
reg import "%USERPROFILE%\Desktop\backup_epub.reg"
```

### 5.3 环境变量备份

**备份环境变量：**

```powershell
# 导出系统环境变量
[System.Environment]::GetEnvironmentVariable("PATH", "Machine") | Out-File "%USERPROFILE%\Desktop\backup_system_path.txt"

# 导出用户环境变量
[System.Environment]::GetEnvironmentVariable("PATH", "User") | Out-File "%USERPROFILE%\Desktop\backup_user_path.txt"
```

**恢复环境变量：**

```powershell
# 读取备份
$newPath = Get-Content "%USERPROFILE%\Desktop\backup_user_path.txt"

# 恢复
[System.Environment]::SetEnvironmentVariable("PATH", $newPath, "User")
```

### 5.4 清理脚本

**开发环境清理脚本：**

```powershell
# cleanup_dev_environment.ps1
# 以管理员身份运行

Write-Host "开始清理墨卷开发环境..." -ForegroundColor Yellow

# 1. 卸载 Node.js（如果是为开发安装的）
# $nodeUninstall = (Get-WmiObject -Class Win32_Product | Where-Object { $_.Name -like "*Node.js*" }).IdentifyingNumber
# if ($nodeUninstall) {
#     Write-Host "卸载 Node.js..."
#     Start-Process msiexec.exe -ArgumentList "/x $nodeUninstall /quiet" -Wait
# }

# 2. 清理 npm 缓存
Write-Host "清理 npm 缓存..."
npm cache clean --force

# 3. 清理 Electron 缓存
Write-Host "清理 Electron 缓存..."
Remove-Item -Recurse -Force "$env:APPDATA\electron" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$env:APPDATA\墨卷" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$env:APPDATA\墨卷-dev" -ErrorAction SilentlyContinue

# 4. 清理项目依赖
Write-Host "清理项目依赖..."
Remove-Item -Recurse -Force "e:\chrome\book\node_modules" -ErrorAction SilentlyContinue

# 5. 清理环境变量（如果需要）
# $currentPath = [System.Environment]::GetEnvironmentVariable("PATH", "User")
# $newPath = ($currentPath -split ";" | Where-Object { $_ -notlike "*nodejs*" -and $_ -notlike "*npm*" }) -join ";"
# [System.Environment]::SetEnvironmentVariable("PATH", $newPath, "User")

# 6. 清理注册表（如果需要）
# reg delete "HKEY_CLASSES_ROOT\.epub" /f
# reg delete "HKEY_CLASSES_ROOT\Inking.epub" /f

Write-Host "清理完成！" -ForegroundColor Green
```

**应用卸载清理脚本：**

```powershell
# cleanup_app.ps1
# 清理已安装的墨卷应用

Write-Host "开始清理墨卷应用..." -ForegroundColor Yellow

# 1. 运行卸载程序
$uninstallExe = "C:\Program Files\墨卷\unins000.exe"
if (Test-Path $uninstallExe) {
    Write-Host "运行卸载程序..."
    Start-Process $uninstallExe -ArgumentList "/VERYSILENT" -Wait
}

# 2. 清理残留文件
Write-Host "清理残留文件..."
Remove-Item -Recurse -Force "C:\Program Files\墨卷" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$env:APPDATA\墨卷" -ErrorAction SilentlyContinue

# 3. 清理注册表
Write-Host "清理注册表..."
reg delete "HKEY_CLASSES_ROOT\.epub" /f 2>$null
reg delete "HKEY_CLASSES_ROOT\.pdf" /f 2>$null
reg delete "HKEY_CLASSES_ROOT\.txt" /f 2>$null
reg delete "HKEY_CLASSES_ROOT\.mobi" /f 2>$null
reg delete "HKEY_CLASSES_ROOT\Inking.epub" /f 2>$null
reg delete "HKEY_CLASSES_ROOT\Inking.pdf" /f 2>$null
reg delete "HKEY_CLASSES_ROOT\Inking.txt" /f 2>$null
reg delete "HKEY_CLASSES_ROOT\Inking.mobi" /f 2>$null

# 4. 清理快捷方式
Write-Host "清理快捷方式..."
Remove-Item "$env:USERPROFILE\Desktop\墨卷.lnk" -ErrorAction SilentlyContinue
Remove-Item "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\墨卷" -Recurse -ErrorAction SilentlyContinue

Write-Host "清理完成！" -ForegroundColor Green
```

---

## 六、开发前检查清单

### 6.1 系统环境检查

```powershell
# 创建检查脚本：check_environment.ps1

Write-Host "=== 墨卷开发环境检查 ===" -ForegroundColor Cyan

# 1. 操作系统检查
Write-Host "`n[1/8] 操作系统检查" -ForegroundColor Yellow
$os = Get-WmiObject -Class Win32_OperatingSystem
Write-Host "  系统: $($os.Caption)"
Write-Host "  版本: $($os.Version)"
Write-Host "  架构: $($os.OSArchitecture)"

# 2. 磁盘空间检查
Write-Host "`n[2/8] 磁盘空间检查" -ForegroundColor Yellow
$disk = Get-WmiObject -Class Win32_LogicalDisk -Filter "DeviceID='C:'"
$freeGB = [math]::Round($disk.FreeSpace / 1GB, 2)
Write-Host "  C 盘剩余空间: ${freeGB} GB"
if ($freeGB -lt 10) {
    Write-Host "  ⚠️ 警告：磁盘空间不足 10GB" -ForegroundColor Red
}

# 3. 内存检查
Write-Host "`n[3/8] 内存检查" -ForegroundColor Yellow
$memory = Get-WmiObject -Class Win32_OperatingSystem
$totalGB = [math]::Round($memory.TotalVisibleMemorySize / 1MB, 2)
$freeGB = [math]::Round($memory.FreePhysicalMemory / 1MB, 2)
Write-Host "  总内存: ${totalGB} GB"
Write-Host "  可用内存: ${freeGB} GB"
if ($totalGB -lt 8) {
    Write-Host "  ⚠️ 警告：内存不足 8GB" -ForegroundColor Yellow
}

# 4. Node.js 检查
Write-Host "`n[4/8] Node.js 检查" -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "  Node.js 版本: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  ❌ Node.js 未安装" -ForegroundColor Red
    Write-Host "  下载地址: https://nodejs.org/" -ForegroundColor Cyan
}

# 5. npm 检查
Write-Host "`n[5/8] npm 检查" -ForegroundColor Yellow
try {
    $npmVersion = npm --version
    Write-Host "  npm 版本: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "  ❌ npm 未安装" -ForegroundColor Red
}

# 6. Git 检查
Write-Host "`n[6/8] Git 检查" -ForegroundColor Yellow
try {
    $gitVersion = git --version
    Write-Host "  $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "  ❌ Git 未安装" -ForegroundColor Red
    Write-Host "  下载地址: https://git-scm.com/" -ForegroundColor Cyan
}

# 7. 端口检查
Write-Host "`n[7/8] 端口检查" -ForegroundColor Yellow
$port3000 = netstat -ano | findstr :3000
$port5174 = netstat -ano | findstr :5174
if ($port3000) {
    Write-Host "  ⚠️ 端口 3000 已被占用" -ForegroundColor Yellow
    Write-Host "  $port3000"
} else {
    Write-Host "  端口 3000: 可用" -ForegroundColor Green
}
if ($port5174) {
    Write-Host "  ⚠️ 端口 5174 已被占用" -ForegroundColor Yellow
    Write-Host "  $port5174"
} else {
    Write-Host "  端口 5174: 可用" -ForegroundColor Green
}

# 8. 杀毒软件检查
Write-Host "`n[8/8] 杀毒软件检查" -ForegroundColor Yellow
$antivirus = Get-WmiObject -Namespace "root\SecurityCenter2" -Class AntiVirusProduct
if ($antivirus) {
    Write-Host "  检测到杀毒软件: $($antivirus.displayName)"
    Write-Host "  ⚠️ 建议：将项目目录添加到排除列表" -ForegroundColor Yellow
} else {
    Write-Host "  未检测到杀毒软件" -ForegroundColor Green
}

Write-Host "`n=== 检查完成 ===" -ForegroundColor Cyan
```

### 6.2 备份检查清单

- [ ] 创建系统还原点
- [ ] 备份注册表（文件关联相关）
- [ ] 备份环境变量（PATH）
- [ ] 备份重要数据（如果有）
- [ ] 记录当前系统状态（截图或文档）

### 6.3 隔离措施检查清单

- [ ] 选择隔离方案（用户账户/虚拟机/目录隔离）
- [ ] 配置隔离环境
- [ ] 测试隔离环境可用性
- [ ] 准备回滚脚本

### 6.4 开发环境准备检查清单

- [ ] 安装 Node.js（推荐 20.x LTS）
- [ ] 安装 Git
- [ ] 安装 VS Code（可选）
- [ ] 克隆项目代码
- [ ] 安装项目依赖（`npm install`）
- [ ] 配置环境变量（`.env.development`）
- [ ] 测试开发服务器启动（`npm run dev:all`）

---

## 七、实施建议

### 7.1 推荐实施顺序

1. **第一阶段：环境准备（1 小时）**
   - 运行系统检查脚本
   - 创建系统还原点
   - 备份注册表和环境变量
   - 选择并配置隔离方案

2. **第二阶段：基础开发（2-3 天）**
   - 使用目录隔离方案
   - 开发核心功能
   - 不涉及系统级功能

3. **第三阶段：系统功能测试（1-2 天）**
   - 切换到用户账户隔离或虚拟机
   - 测试文件关联
   - 测试安装程序
   - 测试系统托盘等原生功能

4. **第四阶段：部署测试（1 天）**
   - 在虚拟机中测试安装包
   - 验证安装/卸载流程
   - 验证文件关联
   - 验证清理脚本

### 7.2 风险控制建议

1. **渐进式开发**
   - 先开发不涉及系统功能的部分
   - 逐步引入系统级功能
   - 每引入一个新功能就测试一次

2. **频繁备份**
   - 每天创建系统还原点
   - 重要操作前手动备份
   - 保留多个还原点

3. **文档记录**
   - 记录所有系统修改
   - 记录所有安装的软件
   - 记录所有环境变量修改

4. **及时清理**
   - 不再需要的依赖及时卸载
   - 测试数据定期清理
   - 开发完成后执行完整清理

### 7.3 应急预案

**如果系统出现问题：**

1. **立即停止开发**
2. **评估问题严重程度**
   - 轻微：不影响日常使用 → 继续开发，计划修复
   - 中等：影响部分功能 → 使用还原点恢复
   - 严重：系统无法正常使用 → 立即恢复还原点
3. **执行回滚**
   - 使用系统还原点
   - 使用注册表备份
   - 运行清理脚本
4. **分析问题原因**
   - 查看操作记录
   - 定位问题根源
   - 调整开发方案
5. **重新开始**
   - 在隔离环境中继续
   - 避免重复问题

---

## 八、总结

### 8.1 影响评估总结

| 影响类型 | 影响程度 | 可逆性 | 风险等级 |
|---------|---------|--------|---------|
| 系统环境配置 | 中 | ✅ 完全可逆 | 🟢 低 |
| 操作系统设置 | 中 | ⚠️ 需手动恢复 | 🟡 中 |
| 已安装软件 | 低 | ✅ 无影响 | 🟢 低 |
| 用户数据 | 低 | ✅ 隔离保护 | 🟢 低 |

### 8.2 推荐方案

**开发环境配置：**
- **隔离方案**：目录隔离（开发）+ 用户账户隔离（测试）
- **备份策略**：每日还原点 + 关键操作前手动备份
- **清理策略**：开发完成后执行完整清理脚本

**安全保障措施：**
1. ✅ 系统还原点（随时可恢复）
2. ✅ 注册表备份（文件关联可恢复）
3. ✅ 环境变量备份（PATH 可恢复）
4. ✅ 数据隔离（开发/生产分离）
5. ✅ 清理脚本（一键清理）

### 8.3 最终建议

**可以安全开始开发**，理由如下：

1. **影响可控**：所有修改都是可逆的
2. **隔离充分**：多层隔离方案可选
3. **回滚容易**：系统还原点 + 备份 + 清理脚本
4. **风险较低**：开发活动不涉及系统核心组件

**建议立即执行：**
1. 运行环境检查脚本
2. 创建系统还原点
3. 配置目录隔离
4. 开始开发

**注意事项：**
- 测试系统功能时使用用户账户隔离或虚拟机
- 定期创建还原点
- 保留所有备份文件直到项目完成
- 开发完成后执行完整清理
