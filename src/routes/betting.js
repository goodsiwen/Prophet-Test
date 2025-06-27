const express = require('express');
const ProphetService = require('../services/prophetService');
const { wallet } = require('../config/solana');

const router = express.Router();

/**
 * 初始化平台
 * POST /api/betting/platform/initialize
 */
router.post('/platform/initialize', async (req, res) => {
  try {
    const { platformFeeRate, creatorRewardRate } = req.body;

    // 验证参数
    if (platformFeeRate !== undefined && (platformFeeRate < 0 || platformFeeRate > 10000)) {
      return res.status(400).json({
        success: false,
        message: '平台费率必须在 0-10000 之间 (基点)'
      });
    }

    if (creatorRewardRate !== undefined && (creatorRewardRate < 0 || creatorRewardRate > 10000)) {
      return res.status(400).json({
        success: false,
        message: '创建者奖励率必须在 0-10000 之间 (基点)'
      });
    }

    const result = await ProphetService.initializePlatform({
      platformFeeRate,
      creatorRewardRate
    });

    res.json({
      success: true,
      message: '平台初始化成功',
      data: result
    });
  } catch (error) {
    console.error('初始化平台错误:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});


/**
 * 创建预测卡
 * POST /api/betting/prediction-cards
 */
router.post('/prediction-cards', async (req, res) => {
  try {
    const {
      assetSymbol,
      currentPrice,
      deadline,
      minBetAmount,
      imageUrl,
      description
    } = req.body;

    // 生成唯一的卡片 ID
    const cardId = Date.now();

    const result = await ProphetService.createPredictionCard({
      cardId,
      assetSymbol,
      currentPrice,
      deadline,
      minBetAmount,
      imageUrl,
      description
    });

    res.json({
      success: true,
      message: '预测卡创建成功',
      data: result
    });
  } catch (error) {
    console.error('创建预测卡错误:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 获取预测卡信息
 * GET /api/betting/prediction-cards/:cardId
 */
router.get('/prediction-cards/:cardId', async (req, res) => {
  try {
    const { cardId } = req.params;
    const card = await ProphetService.getPredictionCard(cardId);

    res.json({
      success: true,
      data: card
    });
  } catch (error) {
    console.error('获取预测卡错误:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 进行押注
 * POST /api/betting/bets
 */
router.post('/bets', async (req, res) => {
  try {
    const { cardId, predictedPrice, betAmount, userPublicKey } = req.body;

    // 验证必需参数
    if (!cardId || !predictedPrice || !betAmount || !userPublicKey) {
      return res.status(400).json({
        success: false,
        message: '缺少必需参数: cardId, predictedPrice, betAmount, userPublicKey'
      });
    }

    const result = await ProphetService.placeBet({
      cardId,
      predictedPrice,
      betAmount,
      userPublicKey
    });

    res.json({
      success: true,
      message: '押注成功',
      data: result
    });
  } catch (error) {
    console.error('押注错误:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 获取用户押注信息
 * GET /api/betting/bets/:cardId/:userPublicKey
 */
router.get('/bets/:cardId/:userPublicKey', async (req, res) => {
  try {
    const { cardId, userPublicKey } = req.params;
    const bet = await ProphetService.getUserBet(cardId, userPublicKey);

    res.json({
      success: true,
      data: bet
    });
  } catch (error) {
    console.error('获取用户押注错误:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 获取账户余额
 * GET /api/betting/balance/:publicKey
 */
router.get('/balance/:publicKey', async (req, res) => {
  try {
    const { publicKey } = req.params;
    const balance = await ProphetService.getBalance(publicKey);

    res.json({
      success: true,
      data: {
        publicKey,
        balance,
        balanceSOL: balance / 1e9 // 转换为 SOL
      }
    });
  } catch (error) {
    console.error('获取余额错误:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 健康检查
 * GET /api/betting/health
 */
router.get('/health', async (req, res) => {
  try {
    const walletBalance = await ProphetService.getBalance(wallet.publicKey.toString());
    
    res.json({
      success: true,
      message: 'Prophet Betting API 运行正常',
      data: {
        timestamp: new Date().toISOString(),
        wallet: wallet.publicKey.toString(),
        balance: walletBalance,
        balanceSOL: walletBalance / 1e9
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '服务异常',
      error: error.message
    });
  }
});

module.exports = router;