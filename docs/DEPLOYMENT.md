# ClawPay 部署文档

## 目录

1. [环境要求](#环境要求)
2. [拉取代码](#拉取代码)
3. [数据库部署](#数据库部署)
4. [后端部署](#后端部署)
5. [前端部署](#前端部署)
6. [Nginx 配置](#nginx-配置)
7. [部署检查清单](#部署检查清单)

---

## 环境要求

### 服务器要求

| 组件 | 最低配置 | 推荐配置 |
|------|---------|---------|
| CPU | 2核 | 4核 |
| 内存 | 4GB | 8GB |
| 磁盘 | 40GB | 100GB |
| 系统 | Ubuntu 20.04+ / CentOS 7+ | Ubuntu 22.04 |

### 软件要求

| 软件 | 版本 | 用途 |
|------|-----|------|
| Git | 2.0+ | 代码拉取 |
| Go | 1.21+ | 后端编译 |
| Node.js | 18+ | 前端编译 |
| PostgreSQL | 14+ | 数据库 |
| Nginx | 1.18+ | 反向代理 |
| PM2 | 5.0+ | 进程管理 |

### 安装依赖软件

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y git curl wget

# 安装 Go 1.21
wget https://go.dev/dl/go1.21.0.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.21.0.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
source ~/.bashrc

# 安装 Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 安装 PM2
sudo npm install -g pm2

# 安装 PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# 安装 Nginx
sudo apt install -y nginx
```

---

## 拉取代码

### 1. 创建项目目录

```bash
sudo mkdir -p /opt/clawpay
sudo chown $USER:$USER /opt/clawpay
cd /opt/clawpay
```

### 2. 克隆代码仓库

```bash
git clone https://github.com/26dos/ClawPay.git .
```

### 3. 查看项目结构

```bash
ls -la
# 应该看到：
# - backend/      后端代码
# - frontend/     前端代码
# - contracts/    智能合约
# - docs/         文档
```

---

## 数据库部署

### 1. 启动 PostgreSQL 服务

```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 2. 创建数据库和用户

```bash
sudo -u postgres psql

# 在 psql 中执行
CREATE USER clawpay WITH PASSWORD 'your-secure-password';
CREATE DATABASE clawpay OWNER clawpay;
GRANT ALL PRIVILEGES ON DATABASE clawpay TO clawpay;
\q
```

### 3. 导入表结构

```bash
cd /opt/clawpay
psql -h localhost -U clawpay -d clawpay -f backend/migrations/001_init.sql
```

### 4. 从开发环境导入数据（可选）

如果需要导入开发环境的数据：

```bash
# 在开发机器上导出
pg_dump -h localhost -U jiangdanhui -d clawpay > clawpay_backup.sql

# 传输到测试服务器
scp clawpay_backup.sql user@test-server:/opt/clawpay/

# 在测试服务器上导入
psql -h localhost -U clawpay -d clawpay < /opt/clawpay/clawpay_backup.sql
```

---

## 后端部署

### 1. 进入后端目录

```bash
cd /opt/clawpay/backend
```

### 2. 创建环境配置文件

```bash
cat > .env << 'EOF'
# 数据库配置
DATABASE_URL=postgres://clawpay:your-secure-password@localhost:5432/clawpay?sslmode=disable

# 服务配置
PORT=8080

# JWT 密钥 (请修改为安全的随机字符串)
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# 区块链配置
BSC_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545

# 合约地址 (BSC Testnet)
USD1_ADDRESS=0x8b4C6b67976D9863FD56f6fFF140e501d838a758
DID_REGISTRY_ADDRESS=0x0071cA34341557Db09Eb976db947d9Cb1F06Ada8
REPUTATION_ADDRESS=0xBB78F645C565bCbB3d4a30A7398b61f7968e60b2
ESCROW_ADDRESS=0x2987782FD00274b6d5Ce235a4cf38c8e36fb0f52
EOF
```

### 3. 编译后端

```bash
# 下载依赖
go mod download

# 编译二进制文件
go build -o clawpay-server cmd/server/main.go

# 验证编译成功
ls -la clawpay-server
```

### 4. 创建日志目录

```bash
mkdir -p logs
```

### 5. 后台启动（使用 nohup）

```bash
# 后台启动
nohup ./clawpay-server > logs/server.log 2>&1 &

# 查看进程
ps aux | grep clawpay-server

# 查看日志
tail -f logs/server.log
```

### 6. 使用 Systemd 管理（推荐）

创建服务文件：

```bash
sudo cat > /etc/systemd/system/clawpay-backend.service << 'EOF'
[Unit]
Description=ClawPay Backend API
After=network.target postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/clawpay/backend
ExecStart=/opt/clawpay/backend/clawpay-server
Restart=always
RestartSec=5
Environment=GIN_MODE=release

[Install]
WantedBy=multi-user.target
EOF
```

启动服务：

```bash
# 重载 systemd
sudo systemctl daemon-reload

# 启动服务
sudo systemctl start clawpay-backend

# 设置开机自启
sudo systemctl enable clawpay-backend

# 查看状态
sudo systemctl status clawpay-backend

# 查看日志
sudo journalctl -u clawpay-backend -f
```

### 7. 验证后端运行

```bash
curl http://localhost:8080/api/v1/health
# 应返回 {"status":"ok"}
```

---

## 前端部署

### 1. 进入前端目录

```bash
cd /opt/clawpay/frontend
```

### 2. 安装依赖

```bash
npm install
```

### 3. 创建生产环境配置

```bash
cat > .env.production << 'EOF'
# API 地址（根据实际情况修改）
NEXT_PUBLIC_API_URL=http://YOUR_SERVER_IP:8080/api/v1

# WalletConnect Project ID（可选，用于 WalletConnect）
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your-walletconnect-project-id

# 合约地址 (BSC Testnet)
NEXT_PUBLIC_USD1_ADDRESS=0x8b4C6b67976D9863FD56f6fFF140e501d838a758
NEXT_PUBLIC_DID_REGISTRY_ADDRESS=0x0071cA34341557Db09Eb976db947d9Cb1F06Ada8
NEXT_PUBLIC_REPUTATION_ADDRESS=0xBB78F645C565bCbB3d4a30A7398b61f7968e60b2
NEXT_PUBLIC_DYNAMIC_PRICING_ADDRESS=0x28dBC4F5d362A3778F5492f1623C1777e8b24529
NEXT_PUBLIC_INSURANCE_POOL_ADDRESS=0x8E0Ea2482196e4CcFDdB601E007BCa9AFe71Df75
NEXT_PUBLIC_ESCROW_ADDRESS=0x2987782FD00274b6d5Ce235a4cf38c8e36fb0f52
EOF
```

> 注意：将 `YOUR_SERVER_IP` 替换为测试服务器的实际 IP 地址或域名

### 4. 编译前端

```bash
npm run build
```

### 5. 使用 PM2 启动

```bash
# 启动前端服务
pm2 start npm --name "clawpay-frontend" -- start

# 查看状态
pm2 status

# 查看日志
pm2 logs clawpay-frontend

# 保存 PM2 配置
pm2 save

# 设置开机自启
pm2 startup
```

### 6. 验证前端运行

```bash
curl http://localhost:3000
# 应返回 HTML 内容
```

---

## Nginx 配置

### 1. 创建 Nginx 配置文件

```bash
sudo cat > /etc/nginx/sites-available/clawpay << 'EOF'
# 前端配置
server {
    listen 80;
    server_name YOUR_DOMAIN_OR_IP;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # API 代理
    location /api/ {
        proxy_pass http://127.0.0.1:8080/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CORS headers
        add_header Access-Control-Allow-Origin * always;
        add_header Access-Control-Allow-Methods 'GET, POST, PUT, DELETE, OPTIONS' always;
        add_header Access-Control-Allow-Headers 'Authorization, Content-Type' always;
        
        if ($request_method = 'OPTIONS') {
            return 204;
        }
    }
}
EOF
```

> 注意：将 `YOUR_DOMAIN_OR_IP` 替换为实际的域名或 IP 地址

### 2. 启用配置

```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/clawpay /etc/nginx/sites-enabled/

# 删除默认配置（可选）
sudo rm /etc/nginx/sites-enabled/default

# 测试配置
sudo nginx -t

# 重载 Nginx
sudo systemctl reload nginx
```

### 3. 开放防火墙端口

```bash
# Ubuntu (ufw)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# CentOS (firewalld)
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=443/tcp
sudo firewall-cmd --reload
```

---

## 部署检查清单

### 服务状态检查

```bash
# 检查 PostgreSQL
sudo systemctl status postgresql

# 检查后端
sudo systemctl status clawpay-backend
# 或
ps aux | grep clawpay-server

# 检查前端
pm2 status

# 检查 Nginx
sudo systemctl status nginx
```

### 端口检查

```bash
# 查看监听端口
sudo netstat -tlnp | grep -E '(3000|8080|80)'

# 或使用 ss
sudo ss -tlnp | grep -E '(3000|8080|80)'
```

### 功能验证

- [ ] PostgreSQL 服务运行正常
- [ ] 数据库表结构已导入
- [ ] 后端 API 可访问：`curl http://localhost:8080/api/v1/health`
- [ ] 前端页面可访问：`curl http://localhost:3000`
- [ ] Nginx 代理正常
- [ ] 浏览器访问正常
- [ ] MetaMask 可连接

---

## 常用运维命令

### 服务管理

```bash
# 后端
sudo systemctl start clawpay-backend
sudo systemctl stop clawpay-backend
sudo systemctl restart clawpay-backend

# 前端
pm2 start clawpay-frontend
pm2 stop clawpay-frontend
pm2 restart clawpay-frontend

# Nginx
sudo systemctl reload nginx
sudo systemctl restart nginx
```

### 日志查看

```bash
# 后端日志
sudo journalctl -u clawpay-backend -f
# 或
tail -f /opt/clawpay/backend/logs/server.log

# 前端日志
pm2 logs clawpay-frontend

# Nginx 日志
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 代码更新

```bash
cd /opt/clawpay

# 拉取最新代码
git pull origin master

# 重新编译后端
cd backend
go build -o clawpay-server cmd/server/main.go
sudo systemctl restart clawpay-backend

# 重新编译前端
cd ../frontend
npm install
npm run build
pm2 restart clawpay-frontend
```

---

## 快速部署脚本

将以下脚本保存为 `deploy.sh`，一键部署：

```bash
#!/bin/bash
set -e

echo "=== ClawPay 部署脚本 ==="

# 变量配置
PROJECT_DIR="/opt/clawpay"
DB_USER="clawpay"
DB_PASS="your-secure-password"
DB_NAME="clawpay"

# 1. 拉取代码
echo ">>> 拉取代码..."
cd $PROJECT_DIR
git pull origin master

# 2. 编译后端
echo ">>> 编译后端..."
cd $PROJECT_DIR/backend
go build -o clawpay-server cmd/server/main.go

# 3. 重启后端
echo ">>> 重启后端..."
sudo systemctl restart clawpay-backend

# 4. 编译前端
echo ">>> 编译前端..."
cd $PROJECT_DIR/frontend
npm install
npm run build

# 5. 重启前端
echo ">>> 重启前端..."
pm2 restart clawpay-frontend

echo "=== 部署完成 ==="
```

使用方法：

```bash
chmod +x deploy.sh
./deploy.sh
```
