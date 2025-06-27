const express = require('express');
const router = express.Router();

// 根据环境选择服务
const USE_MOCK_MODE = process.env.USE_MOCK_MODE === 'true' || process.env.NODE_ENV === 'development';

let ProphetService = require('../services/prophetService');;

// 错误处理中间件
const handleError = (res, error, operation) => {
  console.error(`❌ ${operation} 失败:`, error.message);
  res.status(500).json({
    success: false,
    message: error.message,
    operation,
    mode: USE_MOCK_MODE ? 'simulation' : 'blockchain'
  });
};

// 成功响应中间件
const handleSuccess = (res, data, operation) => {
  console.log(`✅ ${operation} 成功`);
  res.json({
    success: true,
    data,
    operation,
    mode: USE_MOCK_MODE ? 'simulation' : 'blockchain'
  });
};

// 1. 初始化平台
router.post('/platform/initialize', async (req, res) => {
  try {
    const { platformFeeRate, creatorRewardRate } = req.body;
    
    const result = await ProphetService.initializePlatform({
      platformFeeRate: platformFeeRate || 500,
      creatorRewardRate: creatorRewardRate || 300
    });
    
    handleSuccess(res, result, 'initializePlatform');
  } catch (error) {
    handleError(res, error, 'initializePlatform');
  }
});

// 2. 获取平台信息
router.get('/platform/info', async (req, res) => {
  try {
    const result = await ProphetService.getPlatformInfo();
    handleSuccess(res, result, 'getPlatformInfo');
  } catch (error) {
    handleError(res, error, 'getPlatformInfo');
  }
});

// 3. 创建预测卡 - 修复版本
router.post('/prediction-card', async (req, res) => {
  try {
    const {
      cardId, // 🔥 新增：卡片 ID
      assetSymbol,
      currentPrice,
      deadline,
      minBetAmount,
      imageUri,
      description,
      creatorPublicKey // 🔥 新增：创建者公钥
    } = req.body;

    // 验证必需参数
    if (!cardId || !assetSymbol || !currentPrice || !deadline || !creatorPublicKey) {
      return res.status(400).json({
        success: false,
        message: '缺少必需参数: cardId, assetSymbol, currentPrice, deadline, creatorPublicKey',
        requiredFields: ['cardId', 'assetSymbol', 'currentPrice', 'deadline', 'creatorPublicKey']
      });
    }

    // 验证数据类型
    if (isNaN(cardId) || isNaN(currentPrice) || isNaN(deadline)) {
      return res.status(400).json({
        success: false,
        message: 'cardId, currentPrice, deadline 必须是数字'
      });
    }

    const result = await ProphetService.createPredictionCard({
      cardId: parseInt(cardId),
      assetSymbol,
      currentPrice: parseInt(currentPrice),
      deadline: parseInt(deadline),
      minBetAmount: parseInt(minBetAmount) || 10000000, // 默认 0.01 SOL
      imageUri: imageUri || '',
      description: description || '',
      creatorPublicKey // 🔥 传递创建者公钥
    });
    
    handleSuccess(res, result, 'createPredictionCard');
  } catch (error) {
    handleError(res, error, 'createPredictionCard');
  }
});

// 4. 进行押注
router.post('/bet', async (req, res) => {
  try {
    const {
      cardId,
      predictedPrice,
      betAmount,
      userPublicKey
    } = req.body;

    // 验证必需参数
    if (!cardId || !predictedPrice || !betAmount || !userPublicKey) {
      return res.status(400).json({
        success: false,
        message: '缺少必需参数: cardId, predictedPrice, betAmount, userPublicKey',
        requiredFields: ['cardId', 'predictedPrice', 'betAmount', 'userPublicKey']
      });
    }

    // 验证数据类型
    if (isNaN(cardId) || isNaN(predictedPrice) || isNaN(betAmount)) {
      return res.status(400).json({
        success: false,
        message: 'cardId, predictedPrice, betAmount 必须是数字'
      });
    }

    const result = await ProphetService.placeBet({
      cardId: parseInt(cardId),
      predictedPrice: parseInt(predictedPrice),
      betAmount: parseInt(betAmount),
      userPublicKey
    });
    
    handleSuccess(res, result, 'placeBet');
  } catch (error) {
    handleError(res, error, 'placeBet');
  }
});

// 5. 获取预测卡信息
router.get('/prediction-card/:cardId', async (req, res) => {
  try {
    const { cardId } = req.params;
    
    if (isNaN(cardId)) {
      return res.status(400).json({
        success: false,
        message: 'cardId 必须是数字'
      });
    }
    
    const result = await ProphetService.getPredictionCard(parseInt(cardId));
    handleSuccess(res, result, 'getPredictionCard');
  } catch (error) {
    handleError(res, error, 'getPredictionCard');
  }
});

// 6. 获取用户押注信息
router.get('/bet/:cardId/:userPublicKey', async (req, res) => {
  try {
    const { cardId, userPublicKey } = req.params;
    
    if (isNaN(cardId)) {
      return res.status(400).json({
        success: false,
        message: 'cardId 必须是数字'
      });
    }
    
    const result = await ProphetService.getUserBet(parseInt(cardId), userPublicKey);
    handleSuccess(res, result, 'getUserBet');
  } catch (error) {
    handleError(res, error, 'getUserBet');
  }
});

// 7. 获取系统状态
router.get('/system/status', async (req, res) => {
  try {
    const result = await ProphetService.getSystemStatus();
    handleSuccess(res, result, 'getSystemStatus');
  } catch (error) {
    handleError(res, error, 'getSystemStatus');
  }
});

// 8. 获取账户余额
router.get('/balance/:publicKey', async (req, res) => {
  try {
    const { publicKey } = req.params;
    const balance = await ProphetService.getBalance(publicKey);
    
    handleSuccess(res, {
      publicKey,
      balance,
      balanceSOL: balance / 1000000000 // LAMPORTS_PER_SOL
    }, 'getBalance');
  } catch (error) {
    handleError(res, error, 'getBalance');
  }
});


// ==================== 获取所有预测卡相关路由 ====================

/**
 * 🔥 获取所有预测卡（主要接口）
 * GET /api/betting/cards
 * 查询参数:
 * - limit: 限制数量 (默认: 50)
 * - offset: 偏移量 (默认: 0)
 * - includeSettled: 是否包含已结算 (默认: true)
 * - sortBy: 排序字段 (createdAt|deadline|totalPool|totalBets)
 * - sortOrder: 排序方向 (asc|desc)
 * - status: 状态过滤 (active|expired|settled|all)
 */
router.get('/cards', async (req, res) => {
  try {
    const {
      limit = 50,
      offset = 0,
      includeSettled = 'true',
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status = 'all'
    } = req.query;

    console.log('📋 获取所有预测卡');
    console.log('查询参数:', { limit, offset, includeSettled, sortBy, sortOrder, status });

    // 参数验证和转换
    const options = {
      limit: Math.min(parseInt(limit) || 50, 200), // 最大限制 200
      offset: parseInt(offset) || 0,
      includeSettled: includeSettled === 'true',
      sortBy: ['createdAt', 'deadline', 'totalPool', 'totalBets'].includes(sortBy) ? sortBy : 'createdAt',
      sortOrder: ['asc', 'desc'].includes(sortOrder) ? sortOrder : 'desc'
    };

    const result = await ProphetService.getAllPredictionCards(options);

    // 根据状态过滤
    if (status !== 'all' && result.success) {
      const now = Date.now();
      result.cards = result.cards.filter(card => {
        const deadline = parseInt(card.deadline) * 1000;
        
        switch (status) {
          case 'active':
            return !card.isSettled && now < deadline;
          case 'expired':
            return !card.isSettled && now >= deadline;
          case 'settled':
            return card.isSettled;
          default:
            return true;
        }
      });

      // 更新分页信息
      result.pagination.total = result.cards.length;
      result.pagination.hasMore = false;
    }

    res.json({
      success: true,
      data: result.cards,
      pagination: result.pagination,
      stats: result.stats,
      filters: {
        ...result.filters,
        status
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ 获取所有预测卡失败:', error);
    res.status(500).json({
      success: false,
      message: error.message,
      operation: 'getAllCards'
    });
  }
});

/**
 * 🔥 获取活跃预测卡
 * GET /api/betting/cards/active
 */
router.get('/cards/active', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    
    console.log('🎯 获取活跃预测卡');
    
    const result = await ProphetService.getActivePredictionCards(parseInt(limit));
    
    res.json({
      success: true,
      data: result.cards,
      total: result.total,
      currentTime: result.currentTime,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ 获取活跃预测卡失败:', error);
    res.status(500).json({
      success: false,
      message: error.message,
      operation: 'getActiveCards'
    });
  }
});

/**
 * 🔥 获取用户创建的预测卡
 * GET /api/betting/cards/creator/:creatorPublicKey
 */
router.get('/cards/creator/:creatorPublicKey', async (req, res) => {
  try {
    const { creatorPublicKey } = req.params;
    const { limit = 20 } = req.query;
    
    console.log('👤 获取用户创建的预测卡:', creatorPublicKey);
    
    const result = await ProphetService.getUserCreatedCards(creatorPublicKey, parseInt(limit));
    
    res.json({
      success: true,
      data: result.cards,
      total: result.total,
      creator: result.creator,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ 获取用户创建的预测卡失败:', error);
    res.status(500).json({
      success: false,
      message: error.message,
      operation: 'getUserCreatedCards'
    });
  }
});

/**
 * 🔥 搜索预测卡
 * GET /api/betting/cards/search
 * 查询参数: q (搜索关键词)
 */
router.get('/cards/search', async (req, res) => {
  try {
    const { q: query, limit = 20 } = req.query;
    
    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: '搜索关键词不能为空'
      });
    }
    
    console.log('🔍 搜索预测卡:', query);
    
    const result = await ProphetService.searchPredictionCards(query.trim(), { 
      limit: parseInt(limit) 
    });
    
    res.json({
      success: true,
      data: result.cards,
      total: result.total,
      query: result.query,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ 搜索预测卡失败:', error);
    res.status(500).json({
      success: false,
      message: error.message,
      operation: 'searchCards'
    });
  }
});

/**
 * 🔥 通过 ID 范围获取预测卡
 * GET /api/betting/cards/range/:startId/:endId
 */
router.get('/cards/range/:startId/:endId', async (req, res) => {
  try {
    const { startId, endId } = req.params;
    
    const start = parseInt(startId);
    const end = parseInt(endId);
    
    // 验证参数
    if (isNaN(start) || isNaN(end) || start < 0 || end < start) {
      return res.status(400).json({
        success: false,
        message: '无效的 ID 范围参数'
      });
    }
    
    // 限制范围大小
    if (end - start > 100) {
      return res.status(400).json({
        success: false,
        message: 'ID 范围不能超过 100'
      });
    }
    
    console.log(`📊 获取预测卡范围: ${start} - ${end}`);
    
    const result = await ProphetService.getPredictionCardsByRange(start, end);
    
    res.json({
      success: true,
      data: result.cards,
      range: result.range,
      found: result.found,
      errors: result.errors,
      errorDetails: result.errorDetails,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ 获取预测卡范围失败:', error);
    res.status(500).json({
      success: false,
      message: error.message,
      operation: 'getCardsByRange'
    });
  }
});

/**
 * 🔥 获取预测卡统计信息
 * GET /api/betting/cards/stats
 */
router.get('/cards/stats', async (req, res) => {
  try {
    console.log('📊 获取预测卡统计信息');
    
    const result = await ProphetService.getAllPredictionCards({ limit: 1000 });
    
    if (!result.success) {
      throw new Error('获取预测卡数据失败');
    }
    
    const now = Date.now();
    const cards = result.cards;
    
    // 计算详细统计
    const stats = {
      total: cards.length,
      active: cards.filter(card => !card.isSettled && now < parseInt(card.deadline) * 1000).length,
      expired: cards.filter(card => !card.isSettled && now >= parseInt(card.deadline) * 1000).length,
      settled: cards.filter(card => card.isSettled).length,
      totalPoolSOL: cards.reduce((sum, card) => sum + parseFloat(card.totalPool), 0) / 1000000000, // 转换为 SOL
      totalBets: cards.reduce((sum, card) => sum + parseInt(card.totalBets), 0),
      avgBetsPerCard: cards.length > 0 ? cards.reduce((sum, card) => sum + parseInt(card.totalBets), 0) / cards.length : 0,
      topAssets: getTopAssets(cards),
      recentActivity: getRecentActivity(cards),
      upcomingDeadlines: getUpcomingDeadlines(cards, now)
    };
    
    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ 获取预测卡统计失败:', error);
    res.status(500).json({
      success: false,
      message: error.message,
      operation: 'getCardsStats'
    });
  }
});

// ==================== 辅助函数 ====================

/**
 * 获取热门资产
 */
function getTopAssets(cards) {
  const assetCounts = {};
  cards.forEach(card => {
    assetCounts[card.assetSymbol] = (assetCounts[card.assetSymbol] || 0) + 1;
  });
  
  return Object.entries(assetCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([asset, count]) => ({ asset, count }));
}

/**
 * 获取最近活动
 */
function getRecentActivity(cards) {
  return cards
    .sort((a, b) => parseInt(b.createdAt) - parseInt(a.createdAt))
    .slice(0, 5)
    .map(card => ({
      id: card.id,
      assetSymbol: card.assetSymbol,
      createdAt: card.createdAt,
      totalBets: card.totalBets
    }));
}

/**
 * 获取即将到期的预测卡
 */
function getUpcomingDeadlines(cards, now) {
  return cards
    .filter(card => !card.isSettled && parseInt(card.deadline) * 1000 > now)
    .sort((a, b) => parseInt(a.deadline) - parseInt(b.deadline))
    .slice(0, 5)
    .map(card => ({
      id: card.id,
      assetSymbol: card.assetSymbol,
      deadline: card.deadline,
      timeLeft: parseInt(card.deadline) * 1000 - now
    }));
}


module.exports = router;