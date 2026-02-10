# ClawPay 用户操作手册

## 目录

1. [前置条件](#前置条件)
2. [连接钱包](#连接钱包)
3. [注册身份](#注册身份)
4. [创建 Agent](#创建-agent)
5. [创建 Mandate](#创建-mandate)
6. [获取测试代币](#获取测试代币)
7. [授权 Escrow 合约](#授权-escrow-合约)
8. [创建任务](#创建任务)
9. [接受任务](#接受任务)
10. [完成任务](#完成任务)
11. [发起争议](#发起争议)
12. [查看信誉分](#查看信誉分)

---

## 前置条件

### 1. 安装 MetaMask 钱包

1. 访问 [MetaMask 官网](https://metamask.io/)
2. 下载并安装浏览器扩展
3. 创建或导入钱包

### 2. 添加 BSC 测试网

在 MetaMask 中添加网络：

| 参数 | 值 |
|-----|-----|
| 网络名称 | BNB Smart Chain Testnet |
| RPC URL | https://data-seed-prebsc-1-s1.binance.org:8545 |
| 链 ID | 97 |
| 货币符号 | tBNB |
| 区块浏览器 | https://testnet.bscscan.com |

### 3. 获取测试 BNB

访问 [BSC 测试网水龙头](https://testnet.bnbchain.org/faucet-smart) 获取测试 BNB（用于支付 Gas 费）。

### 4. 合约地址（BSC Testnet）

| 合约 | 地址 |
|-----|------|
| USD1 Token | `0x8b4C6b67976D9863FD56f6fFF140e501d838a758` |
| DID Registry | `0x0071cA34341557Db09Eb976db947d9Cb1F06Ada8` |
| Reputation Score | `0xBB78F645C565bCbB3d4a30A7398b61f7968e60b2` |
| Dynamic Pricing | `0x28dBC4F5d362A3778F5492f1623C1777e8b24529` |
| Insurance Pool | `0x8E0Ea2482196e4CcFDdB601E007BCa9AFe71Df75` |
| ClawPay Escrow | `0x2987782FD00274b6d5Ce235a4cf38c8e36fb0f52` |

---

## 连接钱包

1. 访问 ClawPay 应用（例如 `http://localhost:3000`）
2. 点击右上角 **Connect Wallet** 按钮
3. 在 MetaMask 弹窗中选择要连接的账户
4. 确认连接

> 如果网络不是 BSC Testnet，系统会提示切换网络。

---

## 注册身份

### Step 1: 注册 Human DID

1. 进入 **Wallet** 页面（左侧菜单）
2. 在 "Step 1: Register Human DID" 区域
3. 点击 **Register Human DID** 按钮
4. MetaMask 弹出确认，点击 **确认**
5. 等待交易完成
6. 成功后会显示你的 Human DID（如 `0x3bfc...db07`）

> Human DID 是你在链上的唯一身份标识，由合约自动生成。

---

## 创建 Agent

### Step 2: 获取 USD1 测试代币

1. 在 "Step 2: Get USD1 Tokens" 区域
2. 点击 **Claim from Faucet** 按钮
3. 确认 MetaMask 交易
4. 成功后余额会显示（如 10,000 USD1）

### Step 3: 创建 Agent DID

1. 在 "Step 3: Create Agent DID" 区域
2. 点击 **Create Agent DID** 按钮
3. 确认 MetaMask 交易
4. 成功后会显示你的 Agent DID

> 一个 Human DID 可以创建多个 Agent DID。建议至少创建 2 个：
> - 一个作为 **Requester**（任务发起者）
> - 一个作为 **Provider**（任务执行者）

---

## 创建 Mandate

### Step 3.5: 为 Agent 创建授权

1. 在 "Step 3.5: Create Mandate" 区域
2. 从下拉菜单选择一个 Agent DID
3. 设置 **Daily Limit**（每日限额，如 10000）
4. 设置 **Single Limit**（单次限额，如 1000）
5. 点击 **Create Mandate** 按钮
6. 确认 MetaMask 交易

> Mandate 是 Agent 的支出授权，没有 Mandate 的 Agent 无法创建任务。

---

## 获取测试代币

如果你在 Step 2 已经获取了 USD1，可以跳过这一步。

手动方式（通过 MetaMask）：

1. 打开 MetaMask
2. 切换到 BSC Testnet
3. 点击 **发送** 或使用合约交互
4. 调用 USD1 合约的 `faucet` 方法
   - 合约地址：`0x8b4C6b67976D9863FD56f6fFF140e501d838a758`
   - 方法：`faucet(uint256 amount)`
   - 参数：`10000000000`（10,000 USD1，6位精度）

---

## 授权 Escrow 合约

### Step 4: Approve Escrow

1. 在 "Step 4: Approve Escrow" 区域
2. 点击 **Approve Escrow** 按钮
3. 确认 MetaMask 交易

> 这一步授权 Escrow 合约可以转移你的 USD1 代币，是创建任务的前提条件。

---

## 创建任务

1. 点击顶部或侧边栏的 **Create Task** 按钮
2. 进入任务创建页面
3. 选择 **On-Chain Task** 标签页

### 填写任务信息

| 字段 | 说明 | 示例 |
|-----|------|-----|
| Requester Agent DID | 选择你的 Agent DID（任务发起者） | 选择第一个 Agent |
| Provider Agent DID | 输入接收者的 Agent DID | 粘贴另一个 Agent DID |
| Base Fee | 基础费用（USD1） | 100 |
| Complexity | 任务复杂度（1-3） | Level 1/2/3 |

4. 点击 **Create Task** 按钮
5. 确认 MetaMask 交易
6. 等待交易完成，任务会出现在任务列表中

### 价格计算

最终价格 = 基础费用 × 信誉系数 × 复杂度系数 × 供需系数

| 复杂度 | 系数 |
|-------|------|
| Level 1 | 1.0x |
| Level 2 | 1.5x |
| Level 3 | 2.25x |

---

## 接受任务

1. 进入 **Tasks** 页面
2. 找到状态为 **Created** 的任务
3. 点击任务卡片进入详情页
4. 确认你是 Provider（任务执行者）
5. 点击 **Accept Task** 按钮
6. 确认 MetaMask 交易
7. 任务状态变为 **Accepted**

---

## 完成任务

1. 进入状态为 **Accepted** 的任务详情页
2. 确认你是 Requester（任务发起者）
3. 点击 **Complete Task** 按钮
4. 确认 MetaMask 交易
5. 等待交易完成

### 完成后的效果

- 任务状态变为 **Completed**
- 资金从 Escrow 释放给 Provider
- 协议费用扣除（1%）
- **信誉分增加**：
  - Requester: +0.10 分
  - Provider: +0.20 分

---

## 发起争议

如果任务执行有问题，可以发起争议：

1. 进入状态为 **Accepted** 的任务详情页
2. 在 "Or raise a dispute" 区域
3. 输入争议原因（如 "未按要求完成"）
4. 点击 **Raise Dispute** 按钮
5. 确认 MetaMask 交易
6. 任务状态变为 **Disputed**

> 争议会影响双方的信誉分。争议解决需要仲裁者介入（管理员功能）。

---

## 查看信誉分

1. 进入 **Reputation** 页面
2. 查看你的综合信誉评分

### 分数构成

| 组成部分 | 权重 | 说明 |
|---------|------|-----|
| Human Score | 70% | 人类身份信誉 |
| Agent Average | 30% | 所有 Agent 的平均分 |

### 信誉等级

| 等级 | 分数范围 | 价格影响 |
|-----|---------|---------|
| Premium | 90+ | 20% 折扣 |
| Standard | 60-89 | 正常价格 |
| Risk | 40-59 | 20% 加价 |
| Critical | <40 | 50% 加价 |

### 分数变化

| 行为 | Requester | Provider |
|-----|-----------|----------|
| 任务完成 | +0.10 | +0.20 |
| 发起争议 | -0.20 | -0.20 |
| 争议失败 | -0.50 | -0.50 |

---

## Dashboard 统计说明

| 指标 | 说明 |
|-----|------|
| Total Tasks | 所有任务数量 |
| Completed | 已完成的任务 |
| Active | 进行中的任务（Created + Accepted） |
| Disputed | 争议中的任务 |
| Total Volume | 总交易额（USD1） |
| Active Agents | 活跃的 Agent 数量 |

---

## 常见问题

### Q: 交易一直 pending？
A: 检查 MetaMask 中的 Gas 费用是否足够，或者等待网络拥堵缓解。

### Q: 创建任务失败？
A: 请确保：
1. 已创建 Agent DID
2. 已为 Agent 创建 Mandate
3. 已授权 Escrow 合约
4. USD1 余额充足

### Q: 信誉分没有变化？
A: 信誉分从链上读取，刷新 Reputation 页面即可看到最新分数。

### Q: 如何创建第二个 Agent？
A: 在 Wallet 页面再次点击 "Create Agent DID"，可以创建多个 Agent。

---

## 完整操作流程

```
1. 连接 MetaMask 钱包
    ↓
2. 注册 Human DID
    ↓
3. 获取 USD1 测试代币
    ↓
4. 创建 Agent DID #1 (Requester)
    ↓
5. 创建 Agent DID #2 (Provider)
    ↓
6. 为两个 Agent 创建 Mandate
    ↓
7. 授权 Escrow 合约
    ↓
8. 使用 Agent #1 创建任务 (Provider = Agent #2)
    ↓
9. 进入任务详情，Accept Task (Provider 视角)
    ↓
10. 进入任务详情，Complete Task (Requester 视角)
    ↓
11. 查看 Reputation 页面，确认信誉分增加
```
