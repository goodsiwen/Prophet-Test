const express = require('express');
const cors = require('cors');
require('dotenv').config();

const bettingRoutes = require('./routes/betting');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 请求日志中间件
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// // 快速初始化接口 (便于测试)
// app.post('/api/platform/initialize', async (req, res) => {
//   try {
//     const ProphetService = require('./services/prophetService');
    
//     const result = await ProphetService.initializePlatform({
//       platformFeeRate: req.body.platformFeeRate || 500,
//       creatorRewardRate: req.body.creatorRewardRate || 300
//     });

//     res.json({
//       success: true,
//       message: '平台初始化成功',
//       data: result,
//       redirect: '使用 /api/betting/platform/* 接口获取更多平台功能'
//     });
//   } catch (error) {
//     console.error('快速初始化错误:', error);
//     res.status(500).json({
//       success: false,
//       message: error.message
//     });
//   }
// });

// 健康检查
app.get('/api/betting/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    //wallet: wallet.publicKey.toString(),
    network: process.env.SOLANA_NETWORK || 'devnet',
    //programId: programId.toString()
  });
});


// 路由
app.use('/api/betting', bettingRoutes);

// 根路径
app.get('/', (req, res) => {
  res.json({
    message: 'Prophet Betting API Server',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/betting/health',
      initialize:'POST /api/platform/initialize',
      createCard: 'POST /api/betting/prediction-card',
      getCard: 'GET /api/betting/prediction-cards/:cardId',
      placeBet: 'POST /api/betting/bet',
      getUserBet: 'GET /api/betting/bets/:cardId/:userPublicKey',
      getBalance: 'GET /api/betting/balance/:publicKey',
      cards: 'GET /api/betting/cards'
    }
  });
});

// 错误处理中间件
app.use((error, req, res, next) => {
  console.error('服务器错误:', error);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// 404 处理
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在'
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 Prophet Betting API Server 启动成功`);
  console.log(`📡 服务地址: http://localhost:${PORT}`);
  console.log(`🌍 环境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⛓️  Solana 网络: ${process.env.SOLANA_NETWORK || 'devnet'}`);
});

module.exports = app;