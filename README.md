# Prophet Betting API

Prophet Platform 的 NodeJS API 服务，提供押注功能的 REST 接口。

## 🚀 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 配置环境变量
复制 `.env.example` 到 `.env` 并配置：
```bash
cp .env.example .env
```

### 3. 启动开发服务器
```bash
npm run dev
```

### 4. 运行测试
```bash
npm test
```

## 📡 API 接口

### 健康检查
```
GET /api/betting/health
```

### 创建预测卡
```
POST /api/betting/prediction-cards
Content-Type: application/json

{
  "assetSymbol": "BTC",
  "currentPrice": "50000000000",
  "deadline": 1703980800,
  "minBetAmount": "10000000",
  "imageUrl": "https://example.com/btc.png",
  "description": "BTC price prediction"
}
```

### 获取预测卡信息
```
GET /api/betting/prediction-cards/:cardId
```

### 进行押注
```
POST /api/betting/bets
Content-Type: application/json

{
  "cardId": "1703894400000",
  "predictedPrice": "55000000000",
  "betAmount": "50000000",
  "userPublicKey": "11111111111111111111111111111112"
}
```

### 获取用户押注信息
```
GET /api/betting/bets/:cardId/:userPublicKey
```

### 获取账户余额
```
GET /api/betting/balance/:publicKey
```

## 🧪 VS Code 开发流程

### 1. 安装推荐扩展
- REST Client
- Thunder Client
- Jest Runner

### 2. 创建测试请求文件
创建 `requests.http` 文件：

```http
### 健康检查
GET http://localhost:3000/api/betting/health

### 创建预测卡
POST http://localhost:3000/api/betting/prediction-cards
Content-Type: application/json

{
  "assetSymbol": "BTC",
  "currentPrice": "50000000000",
  "deadline": 1703980800,
  "minBetAmount": "10000000",
  "imageUrl": "https://bitcoin.org/img/icons/opengraph.png",
  "description": "BTC price prediction test"
}

### 获取预测卡
GET http://localhost:3000/api/betting/prediction-cards/1703894400000
```

### 3. 调试配置



## 其他
##### 创建新钱包
solana-keygen new --outfile ~/.config/solana/id.json

##### 查看钱包地址
solana-keygen pubkey ~/.config/solana/id.json

##### 获取私钥数组
cat ~/.config/solana/id.json


# 安装依赖
npm install axios colors

# 运行所有测试
node test-api.js

# 运行单个测试 (已经测试通过)
node test-api.js health
node test-api.js initializePlatform    # 系统初始化，仅可调用一次
node test-api.js createPredictionCard
node test-api.js placeBet
node test-api.js getPredictionCards
node test-api.js getActiveCards