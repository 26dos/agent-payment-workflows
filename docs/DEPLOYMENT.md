# ClawPay 部署文档

## 目录

1. [环境要求](#环境要求)
2. [后端部署](#后端部署)
3. [前端部署](#前端部署)
4. [数据库部署](#数据库部署)
5. [Nginx 配置](#nginx-配置)

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
| Go | 1.21+ | 后端编译 |
| Node.js | 18+ | 前端编译 |
| PostgreSQL | 14+ | 数据库 |
| Nginx | 1.18+ | 反向代理 |

---

## 后端部署

### 1. 编译二进制文件

在开发机器上执行：

```bash
cd /path/to/ClawPay/backend

# Linux 目标服务器
GOOS=linux GOARCH=amd64 go build -o clawpay-server cmd/server/main.go

# 或者在目标服务器上编译
go build -o clawpay-server cmd/server/main.go
```

### 2. 准备配置文件

创建 `.env` 文件：

```bash
# 数据库配置
DATABASE_URL=postgres://username:password@localhost:5432/clawpay?sslmode=disable

# 服务配置
PORT=8080

# JWT 密钥 (生产环境请更换)
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# 区块链配置
BSC_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545

# 合约地址 (BSC Testnet)
USD1_ADDRESS=0x8b4C6b67976D9863FD56f6fFF140e501d838a758
DID_REGISTRY_ADDRESS=0x0071cA34341557Db09Eb976db947d9Cb1F06Ada8
REPUTATION_ADDRESS=0xBB78F645C565bCbB3d4a30A7398b61f7968e60b2
ESCROW_ADDRESS=0x2987782FD00274b6d5Ce235a4cf38c8e36fb0f52
```

### 3. 上传到服务器

```bash
# 创建目录
ssh user@server "mkdir -p /opt/clawpay/backend"

# 上传文件
scp clawpay-server user@server:/opt/clawpay/backend/
scp .env user@server:/opt/clawpay/backend/
```

### 4. 创建 Systemd 服务

在服务器上创建 `/etc/systemd/system/clawpay-backend.service`：

```ini
[Unit]
Description=ClawPay Backend API
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/clawpay/backend
ExecStart=/opt/clawpay/backend/clawpay-server
Restart=always
RestartSec=5
Environment=GIN_MODE=release

[Install]
WantedBy=multi-user.target
```

### 5. 启动服务

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

### 6. 后台启动（不使用 Systemd）

```bash
cd /opt/clawpay/backend

# 使用 nohup 后台运行
nohup ./clawpay-server > logs/server.log 2>&1 &

# 或使用 screen
screen -S clawpay-backend
./clawpay-server
# Ctrl+A, D 退出 screen
```

---

## 前端部署

### 1. 编译前端

在开发机器上执行：

```bash
cd /path/to/ClawPay/frontend

# 安装依赖
npm install

# 创建生产环境配置
cat > .env.production << EOF
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api/v1
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your-walletconnect-project-id

# 合约地址
NEXT_PUBLIC_USD1_ADDRESS=0x8b4C6b67976D9863FD56f6fFF140e501d838a758
NEXT_PUBLIC_DID_REGISTRY_ADDRESS=0x0071cA34341557Db09Eb976db947d9Cb1F06Ada8
NEXT_PUBLIC_REPUTATION_ADDRESS=0xBB78F645C565bCbB3d4a30A7398b61f7968e60b2
NEXT_PUBLIC_DYNAMIC_PRICING_ADDRESS=0x28dBC4F5d362A3778F5492f1623C1777e8b24529
NEXT_PUBLIC_INSURANCE_POOL_ADDRESS=0x8E0Ea2482196e4CcFDdB601E007BCa9AFe71Df75
NEXT_PUBLIC_ESCROW_ADDRESS=0x2987782FD00274b6d5Ce235a4cf38c8e36fb0f52
EOF

# 编译
npm run build

# 导出静态文件（如果使用 static export）
# npm run export
```

### 2. 上传到服务器

```bash
# 创建目录
ssh user@server "mkdir -p /opt/clawpay/frontend"

# 上传编译后的文件
scp -r .next user@server:/opt/clawpay/frontend/
scp -r public user@server:/opt/clawpay/frontend/
scp package.json user@server:/opt/clawpay/frontend/
scp next.config.js user@server:/opt/clawpay/frontend/
```

### 3. 服务器端安装依赖

```bash
cd /opt/clawpay/frontend
npm install --production
```

### 4. 使用 PM2 管理 Next.js

```bash
# 安装 PM2
npm install -g pm2

# 启动
pm2 start npm --name "clawpay-frontend" -- start

# 保存配置
pm2 save

# 设置开机自启
pm2 startup
```

---

## 数据库部署

### 1. 安装 PostgreSQL

```bash
# Ubuntu
sudo apt update
sudo apt install postgresql postgresql-contrib

# CentOS
sudo yum install postgresql-server postgresql-contrib
sudo postgresql-setup initdb
sudo systemctl start postgresql
```

### 2. 创建数据库和用户

```bash
sudo -u postgres psql

CREATE USER clawpay WITH PASSWORD 'your-secure-password';
CREATE DATABASE clawpay OWNER clawpay;
GRANT ALL PRIVILEGES ON DATABASE clawpay TO clawpay;
\q
```

### 3. 导入表结构

```bash
# 使用迁移文件
psql -h localhost -U clawpay -d clawpay -f /opt/clawpay/backend/migrations/001_init.sql
```

### 4. 导出/导入数据

从开发环境导出数据：

```bash
# 导出表结构和数据
pg_dump -h localhost -U jiangdanhui -d clawpay > clawpay_backup.sql

# 仅导出数据（表已存在时）
pg_dump -h localhost -U jiangdanhui -d clawpay --data-only > clawpay_data.sql
```

导入到测试环境：

```bash
# 导入完整备份
psql -h localhost -U clawpay -d clawpay < clawpay_backup.sql

# 或仅导入数据
psql -h localhost -U clawpay -d clawpay < clawpay_data.sql
```

---

## Nginx 配置

### 1. 安装 Nginx

```bash
sudo apt install nginx
```

### 2. 配置文件

创建 `/etc/nginx/sites-available/clawpay`：

```nginx
# 前端配置
server {
    listen 80;
    server_name clawpay.yourdomain.com;

    # 重定向到 HTTPS（生产环境建议启用）
    # return 301 https://$server_name$request_uri;

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
}

# 后端 API 配置
server {
    listen 80;
    server_name api.clawpay.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CORS headers
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods 'GET, POST, PUT, DELETE, OPTIONS';
        add_header Access-Control-Allow-Headers 'Authorization, Content-Type';
        
        if ($request_method = 'OPTIONS') {
            return 204;
        }
    }
}
```

### 3. 启用配置

```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/clawpay /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重载 Nginx
sudo systemctl reload nginx
```

### 4. 配置 SSL（可选但推荐）

```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d clawpay.yourdomain.com -d api.clawpay.yourdomain.com
```

---

## 部署检查清单

- [ ] PostgreSQL 服务运行正常
- [ ] 数据库表结构已导入
- [ ] 后端服务启动成功
- [ ] 前端服务启动成功
- [ ] Nginx 配置正确
- [ ] 防火墙开放 80/443 端口
- [ ] API 接口可访问
- [ ] 前端页面可访问
- [ ] MetaMask 可连接

---

## 常用命令

```bash
# 查看后端日志
sudo journalctl -u clawpay-backend -f

# 重启后端
sudo systemctl restart clawpay-backend

# 查看前端日志
pm2 logs clawpay-frontend

# 重启前端
pm2 restart clawpay-frontend

# 查看 Nginx 错误日志
sudo tail -f /var/log/nginx/error.log
```
