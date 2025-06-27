// const request = require('supertest');
// const app = require('../src/app');

// describe('Prophet Betting API Tests', () => {
//   let testCardId;
//   const testUserPublicKey = '51L9b87SYtPNApoHgJEyqsiRAA5X4yKobxeQcNH9D7Ce'; // 示例公钥

//   // 测试健康检查
//   test('GET /api/betting/health - 健康检查', async () => {
//     const response = await request(app)
//       .get('/api/betting/health')
//       .expect(200);

//     expect(response.body.success).toBe(true);
//     expect(response.body.data).toHaveProperty('wallet');
//     expect(response.body.data).toHaveProperty('balance');
//   });

//   // 测试创建预测卡
//   test('POST /api/betting/prediction-cards - 创建预测卡', async () => {
//     const cardData = {
//       assetSymbol: 'BTC',
//       currentPrice: '50000000000', // 50,000 USD in micro-USD
//       deadline: Math.floor(Date.now() / 1000) + 3600, // 1小时后
//       minBetAmount: '10000000', // 0.01 SOL
//       imageUrl: 'https://bitcoin.org/img/icons/opengraph.png',
//       description: 'BTC price prediction test'
//     };

//     const response = await request(app)
//       .post('/api/betting/prediction-cards')
//       .send(cardData)
//       .expect(200);

//     expect(response.body.success).toBe(true);
//     expect(response.body.data).toHaveProperty('cardId');
//     expect(response.body.data).toHaveProperty('txHash');
    
//     testCardId = response.body.data.cardId;
//   });

//   // 测试获取预测卡
//   test('GET /api/betting/prediction-cards/:cardId - 获取预测卡', async () => {
//     if (!testCardId) {
//       console.log('跳过测试：没有可用的测试卡片ID');
//       return;
//     }

//     const response = await request(app)
//       .get(`/api/betting/prediction-cards/${testCardId}`)
//       .expect(200);

//     expect(response.body.success).toBe(true);
//     expect(response.body.data).toHaveProperty('id');
//     expect(response.body.data).toHaveProperty('assetSymbol');
//     expect(response.body.data.assetSymbol).toBe('BTC');
//   });

//   // 测试获取余额
//   test('GET /api/betting/balance/:publicKey - 获取余额', async () => {
//     const response = await request(app)
//       .get(`/api/betting/balance/${testUserPublicKey}`)
//       .expect(200);

//     expect(response.body.success).toBe(true);
//     expect(response.body.data).toHaveProperty('balance');
//     expect(response.body.data).toHaveProperty('balanceSOL');
//   });

//   // 测试押注 (这个可能会失败，因为需要实际的区块链交互)
//   test.skip('POST /api/betting/bets - 进行押注', async () => {
//     if (!testCardId) {
//       console.log('跳过测试：没有可用的测试卡片ID');
//       return;
//     }

//     const betData = {
//       cardId: testCardId,
//       predictedPrice: '55000000000', // 55,000 USD
//       betAmount: '50000000', // 0.05 SOL
//       userPublicKey: testUserPublicKey
//     };

//     const response = await request(app)
//       .post('/api/betting/bets')
//       .send(betData)
//       .expect(200);

//     expect(response.body.success).toBe(true);
//     expect(response.body.data).toHaveProperty('txHash');
//   });

//   // 测试错误处理
//   test('GET /api/betting/prediction-cards/invalid - 错误处理', async () => {
//     const response = await request(app)
//       .get('/api/betting/prediction-cards/invalid')
//       .expect(500);

//     expect(response.body.success).toBe(false);
//     expect(response.body).toHaveProperty('message');
//   });

//   // 测试 404
//   test('GET /api/invalid - 404处理', async () => {
//     const response = await request(app)
//       .get('/api/invalid')
//       .expect(404);

//     expect(response.body.success).toBe(false);
//     expect(response.body.message).toBe('接口不存在');
//   });
// });