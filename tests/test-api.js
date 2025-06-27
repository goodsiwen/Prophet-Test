const axios = require('axios');
const colors = require('colors');

// 配置
const BASE_URL = 'http://localhost:3000';
const client = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// 测试结果统计
let testResults = {
  passed: 0,
  failed: 0,
  total: 0
};

// 日志函数
const log = {
  info: (msg) => console.log(`ℹ️  ${msg}`.blue),
  success: (msg) => console.log(`✅ ${msg}`.green),
  error: (msg) => console.log(`❌ ${msg}`.red),
  warning: (msg) => console.log(`⚠️  ${msg}`.yellow),
  title: (msg) => console.log(`\n🎯 ${msg}`.cyan.bold)
};

// 测试包装器
async function runTest(name, testFn) {
  testResults.total++;
  log.title(`测试: ${name}`);
  
  try {
    await testFn();
    testResults.passed++;
    log.success(`${name} - 通过`);
  } catch (error) {
    testResults.failed++;
    log.error(`${name} - 失败: ${error.message}`);
    if (error.response) {
      console.log('响应状态:', error.response.status);
      console.log('响应数据:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// 测试函数
const tests = {
  // 健康检查
  async health() {
    const response = await client.get('/api/betting/health');
    console.log('服务器状态:', JSON.stringify(response.data, null, 2));
    
    if (response.status !== 200) {
      throw new Error('服务器状态异常');
    }
  },

  // 初始化平台
  async initializePlatform() {
    const payload = {
      platformFeeRate: 500,  // 5%
      creatorRewardRate: 300 // 3%
    };
    
    const response = await client.post('/api/betting/platform/initialize', payload);
    console.log('初始化结果:', JSON.stringify(response.data, null, 2));
    
    if (!response.data.success) {
      throw new Error('平台初始化失败');
    }
  },

  // 创建预测卡
  async createPredictionCard() {
    const deadline = Math.floor(Date.now() / 1000) + 3600; // 1小时后
    
    const payload = {
      cardId: 9,
      assetSymbol: "SOL/USDT",
      currentPrice: 10000000000, // 100 USDT (scaled by 1e8)
      deadline: deadline,
      minBetAmount: 10000000, // 0.1 SOL
      imageUri: "https://cryptologos.cc/logos/solana-sol-logo.png",
      description: "SOL价格预测 - 预测1小时后SOL/USDT价格走势",
      creatorPublicKey: "51L9b87SYtPNApoHgJEyqsiRAA5X4yKobxeQcNH9D7Ce"
    };
    
    const response = await client.post('/api/betting/prediction-card', payload);
    console.log('创建结果:', JSON.stringify(response.data, null, 2));
    
    if (!response.data.success) {
      throw new Error('预测卡创建失败');
    }
  },

  // 下注
  async placeBet() {
    const payload = {
      cardId: 9,
      predictedPrice: 11000000000, // 110 USDT
      betAmount: 50000000, // 0.5 SOL
      userPublicKey: "51L9b87SYtPNApoHgJEyqsiRAA5X4yKobxeQcNH9D7Ce"
    };
    
    const response = await client.post('/api/betting/bet', payload);
    console.log('下注结果:', JSON.stringify(response.data, null, 2));
    
    if (!response.data.success) {
      throw new Error('下注失败');
    }
  },

  // 获取预测卡列表
  async getPredictionCards() {
    const response = await client.get('/api/betting/cards');
    console.log('预测卡列表:', JSON.stringify(response.data, null, 2));
    
    try {
      console.log('预测卡列表:', JSON.stringify(response.data, null, 2));
      
      // 🔥 修复判断逻辑
      if (response.data && response.data.success && response.data.data) {
        console.log('✅ getPredictionCards - 成功');
        console.log(`📊 统计信息:`);
        console.log(`   - 总数: ${response.data.stats.total}`);
        console.log(`   - 活跃: ${response.data.stats.active}`);
        console.log(`   - 已过期: ${response.data.stats.expired}`);
        console.log(`   - 已结算: ${response.data.stats.settled}`);
        console.log(`   - 总奖池: ${response.data.stats.totalPoolAll / 1000000000} SOL`);
        console.log(`   - 总押注数: ${response.data.stats.totalBetsAll}`);
        
        // 显示前5个预测卡的简要信息
        const cards = response.data.data.slice(0, 5);
        console.log(`📋 前5个预测卡:`);
        cards.forEach((card, index) => {
          console.log(`   ${index + 1}. ID: ${card.id} | ${card.assetSymbol} | 状态: ${card.isActive ? '活跃' : (card.isExpired ? '已过期' : '已结算')} | 奖池: ${card.totalPoolSOL} SOL`);
        });
        
        return true;
      } else {
        console.log('❌ getPredictionCards - 失败: 响应格式不正确');
        return false;
      } 
    } catch (error) {
      console.error('❌ getPredictionCards - 失败:', error.response?.data?.message || error.message);
      return false;
    }
  },

  async getActiveCards() {  
    try {
      console.log('🎯 测试: getActiveCards');
      
      const response = await client.get('/api/betting/cards/active');
      console.log('活跃预测卡:', JSON.stringify(response.data, null, 2));
      
      if (response.data && response.data.success && response.data.data) {
        console.log('✅ getActiveCards - 成功');
        console.log(`📊 活跃预测卡数量: ${response.data.total}`);
        
        const activeCards = response.data.data.slice(0, 3);
        console.log(`📋 前3个活跃预测卡:`);
        activeCards.forEach((card, index) => {
          console.log(`   ${index + 1}. ID: ${card.id} | ${card.assetSymbol} | 截止: ${new Date(parseInt(card.deadline) * 1000).toLocaleString()} | 奖池: ${card.totalPoolSOL} SOL`);
        });
        
        return true;
      } else {
        console.log('❌ getActiveCards - 失败: 响应格式不正确');
        return false;
      }
    } catch (error) {
      console.error('❌ getActiveCards - 失败:', error.response?.data?.message || error.message);
      return false;
    }
  },

  // // 🔥 新增：测试搜索预测卡
  // async searchCards() {
  //   try {
  //     console.log('🎯 测试: searchCards');
      
  //     const searchQuery = 'SOL';
  //     const response = await axios.get(`$/api/betting/cards/search?q=${searchQuery}&limit=10`);

  //     console.log('搜索结果:', JSON.stringify(response.data, null, 2));
      
  //     if (response.data && response.data.success && response.data.data) {
  //       console.log('✅ searchCards - 成功');
  //       console.log(`🔍 搜索 "${searchQuery}" 找到 ${response.data.total} 个结果`);
        
  //       const searchResults = response.data.data.slice(0, 3);
  //       console.log(`📋 前3个搜索结果:`);
  //       searchResults.forEach((card, index) => {
  //         console.log(`   ${index + 1}. ID: ${card.id} | ${card.assetSymbol} | ${card.description}`);
  //       });
        
  //       return true;
  //     } else {
  //       console.log('❌ searchCards - 失败: 响应格式不正确');
  //       return false;
  //     }
  //   } catch (error) {
  //     console.error('❌ searchCards - 失败:', error.response?.data?.message || error.message);
  //     return false;
  //   }
  // },


  // 获取用户下注记录
  async getUserBets() {
    // 这里使用示例地址，实际使用时需要真实地址
    const userAddress = '11111111111111111111111111111112';
    const response = await client.get(`/api/bet/user/${userAddress}`);
    console.log('用户下注记录:', JSON.stringify(response.data, null, 2));
  },

  // 结算预测
  async settlePrediction() {
    const payload = {
      cardId: 1,
      actualPrice: 10500000000 // 105 USDT
    };
    
    const response = await client.post('/api/prediction/settle', payload);
    console.log('结算结果:', JSON.stringify(response.data, null, 2));
    
    if (!response.data.success) {
      throw new Error('预测结算失败');
    }
  },

  // 分发奖励
  async distributeRewards() {
    const payload = {
      cardId: 1
    };
    
    const response = await client.post('/api/rewards/distribute', payload);
    console.log('奖励分发结果:', JSON.stringify(response.data, null, 2));
    
    if (!response.data.success) {
      throw new Error('奖励分发失败');
    }
  }
};

// 主测试函数
async function runAllTests() {
  console.log('🚀 Prophet API 测试开始'.rainbow);
  console.log('='.repeat(50));
  
  // 基础测试
  await runTest('服务器健康检查', tests.health);
  await sleep(1000);
  
  // 平台功能测试
  await runTest('初始化平台', tests.initializePlatform);
  await sleep(2000);
  
  await runTest('创建预测卡', tests.createPredictionCard);
  await sleep(2000);
  
  await runTest('用户下注', tests.placeBet);
  await sleep(2000);
  
  // 查询测试
  await runTest('获取预测卡列表', tests.getPredictionCards);
  await sleep(1000);
  
  await runTest('获取用户下注记录', tests.getUserBets);
  await sleep(1000);
  
  // 管理员功能测试（可选）
  if (process.argv.includes('--admin')) {
    log.warning('执行管理员功能测试...');
    await runTest('结算预测', tests.settlePrediction);
    await sleep(2000);
    
    await runTest('分发奖励', tests.distributeRewards);
  }
  
  // 显示测试结果
  console.log('\n' + '='.repeat(50));
  console.log('📊 测试结果统计'.bold);
  console.log(`总计: ${testResults.total}`.blue);
  console.log(`通过: ${testResults.passed}`.green);
  console.log(`失败: ${testResults.failed}`.red);
  console.log(`成功率: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`.yellow);
  
  if (testResults.failed === 0) {
    console.log('\n🎉 所有测试通过！'.green.bold);
  } else {
    console.log('\n⚠️  部分测试失败，请检查日志'.red.bold);
  }
}

// 单个测试函数
async function runSingleTest(testName) {
  if (tests[testName]) {
    await runTest(testName, tests[testName]);
  } else {
    log.error(`测试 "${testName}" 不存在`);
    console.log('可用测试:', Object.keys(tests).join(', '));
  }
}

// 工具函数
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    await runAllTests();
  } else if (args[0] === 'list') {
    console.log('可用测试:');
    Object.keys(tests).forEach(test => {
      console.log(`  - ${test}`);
    });
  } else {
    await runSingleTest(args[0]);
  }
}

// 错误处理
process.on('unhandledRejection', (error) => {
  log.error('未处理的错误:', error.message);
  process.exit(1);
});

// 运行测试
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { tests, runTest, runAllTests };