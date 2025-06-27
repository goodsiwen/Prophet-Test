const { Connection, PublicKey, Keypair, Transaction } = require('@solana/web3.js');
const { AnchorProvider, Wallet, Program } = require('@coral-xyz/anchor');
const { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } = require('@solana/spl-token');
require('dotenv').config();

// Solana 连接
const connection = new Connection(
  process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  'confirmed'
);

// 程序 ID
const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID);

// Token Metadata Program ID
const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

// 创建钱包
let wallet;
try {
  if (process.env.WALLET_PRIVATE_KEY) {
    const privateKey = JSON.parse(process.env.WALLET_PRIVATE_KEY);
    const keypair = Keypair.fromSecretKey(new Uint8Array(privateKey));
    wallet = new Wallet(keypair);
    console.log('✅ 钱包加载成功:', wallet.publicKey.toString());
  } else {
    // 如果没有私钥，创建一个临时钱包
    wallet = new Wallet(Keypair.generate());
    console.warn('⚠️  使用临时生成的钱包，请设置 WALLET_PRIVATE_KEY 环境变量');
    console.log('临时钱包地址:', wallet.publicKey.toString());
  }
} catch (error) {
  console.error('钱包初始化失败:', error.message);
  wallet = new Wallet(Keypair.generate());
}

// 创建 Provider
const provider = new AnchorProvider(connection, wallet, {
  commitment: 'confirmed',
  preflightCommitment: 'confirmed',
});

// 完整的 Prophet IDL
const IDL = {
  "version": "0.1.0",
  "name": "prophet",
  "instructions": [
    {
      "name": "initializePlatform",
      "accounts": [
        { "name": "platformConfig", "isMut": true, "isSigner": false },
        { "name": "authority", "isMut": true, "isSigner": true },
        { "name": "systemProgram", "isMut": false, "isSigner": false }
      ],
      "args": [
        { "name": "platformFeeRate", "type": "u16" },
        { "name": "creatorRewardRate", "type": "u16" }
      ]
    },
    {
      "name": "createPricePredictionCard",
      "accounts": [
        { "name": "pricePredictionCard", "isMut": true, "isSigner": false },
        { "name": "cardTreasury", "isMut": true, "isSigner": false },
        { "name": "creator", "isMut": true, "isSigner": true },
        { "name": "systemProgram", "isMut": false, "isSigner": false }
      ],
      "args": [
        { "name": "cardId", "type": "u64" },
        { "name": "assetSymbol", "type": "string" },
        { "name": "currentPrice", "type": "u64" },
        { "name": "deadline", "type": "i64" },
        { "name": "minBetAmount", "type": "u64" },
        { "name": "imageUri", "type": "string" },
        { "name": "description", "type": "string" }
      ]
    },
    {
      "name": "placePriceBet",
      "accounts": [
        { "name": "pricePredictionCard", "isMut": true, "isSigner": false },
        { "name": "userPriceBet", "isMut": true, "isSigner": false },
        { "name": "cardTreasury", "isMut": true, "isSigner": false },
        { "name": "nftMint", "isMut": true, "isSigner": false },
        { "name": "userNftAccount", "isMut": true, "isSigner": false },
        { "name": "metadataAccount", "isMut": true, "isSigner": false },
        { "name": "user", "isMut": true, "isSigner": true },
        { "name": "tokenProgram", "isMut": false, "isSigner": false },
        { "name": "associatedTokenProgram", "isMut": false, "isSigner": false },
        { "name": "metadataProgram", "isMut": false, "isSigner": false },
        { "name": "systemProgram", "isMut": false, "isSigner": false },
        { "name": "rent", "isMut": false, "isSigner": false }
      ],
      "args": [
        { "name": "cardId", "type": "u64" },
        { "name": "predictedPrice", "type": "u64" },
        { "name": "betAmount", "type": "u64" }
      ]
    },
    {
      "name": "settlePricePrediction",
      "accounts": [
        { "name": "pricePredictionCard", "isMut": true, "isSigner": false },
        { "name": "platformConfig", "isMut": false, "isSigner": false },
        { "name": "authority", "isMut": false, "isSigner": true }
      ],
      "args": [
        { "name": "cardId", "type": "u64" },
        { "name": "actualPrice", "type": "u64" }
      ]
    },
    {
      "name": "markPriceBetWinner",
      "accounts": [
        { "name": "userPriceBet", "isMut": true, "isSigner": false },
        { "name": "pricePredictionCard", "isMut": false, "isSigner": false },
        { "name": "platformConfig", "isMut": false, "isSigner": false },
        { "name": "authority", "isMut": false, "isSigner": true }
      ],
      "args": [
        { "name": "cardId", "type": "u64" }
      ]
    },
    {
      "name": "distributePricePredictionRewards",
      "accounts": [
        { "name": "pricePredictionCard", "isMut": false, "isSigner": false },
        { "name": "platformConfig", "isMut": false, "isSigner": false },
        { "name": "cardTreasury", "isMut": true, "isSigner": false },
        { "name": "winner", "isMut": true, "isSigner": false },
        { "name": "creator", "isMut": true, "isSigner": false },
        { "name": "platformTreasury", "isMut": true, "isSigner": false }
      ],
      "args": [
        { "name": "cardId", "type": "u64" }
      ]
    }
  ],
  "accounts": [
    {
      "name": "PlatformConfig",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "authority", "type": "publicKey" },
          { "name": "platformFeeRate", "type": "u16" },
          { "name": "creatorRewardRate", "type": "u16" },
          { "name": "platformTreasury", "type": "publicKey" },
          { "name": "isPaused", "type": "bool" },
          { "name": "minBetAmount", "type": "u64" },
          { "name": "maxBetAmount", "type": "u64" },
          { "name": "createdAt", "type": "i64" },
          { "name": "updatedAt", "type": "i64" },
          { "name": "bump", "type": "u8" }
        ]
      }
    },
    {
      "name": "PricePredictionCard",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "id", "type": "u64" },
          { "name": "creator", "type": "publicKey" },
          { "name": "assetSymbol", "type": "string" },
          { "name": "currentPrice", "type": "u64" },
          { "name": "deadline", "type": "i64" },
          { "name": "minBetAmount", "type": "u64" },
          { "name": "imageUri", "type": "string" },
          { "name": "description", "type": "string" },
          { "name": "totalPool", "type": "u64" },
          { "name": "totalBets", "type": "u64" },
          { "name": "isSettled", "type": "bool" },
          { "name": "actualPrice", "type": "u64" },
          { "name": "winner", "type": { "option": "publicKey" } },
          { "name": "createdAt", "type": "i64" },
          { "name": "settledAt", "type": { "option": "i64" } },
          { "name": "bump", "type": "u8" }
        ]
      }
    },
    {
      "name": "UserPriceBet",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "cardId", "type": "u64" },
          { "name": "user", "type": "publicKey" },
          { "name": "predictedPrice", "type": "u64" },
          { "name": "betAmount", "type": "u64" },
          { "name": "nftMint", "type": "publicKey" },
          { "name": "timestamp", "type": "i64" },
          { "name": "isWinner", "type": "bool" },
          { "name": "bump", "type": "u8" }
        ]
      }
    }
  ],
  "events": [
    {
      "name": "PlatformInitialized",
      "fields": [
        { "name": "authority", "type": "publicKey", "index": false },
        { "name": "platformFeeRate", "type": "u16", "index": false },
        { "name": "creatorRewardRate", "type": "u16", "index": false }
      ]
    },
    {
      "name": "PredictionCardCreated",
      "fields": [
        { "name": "cardId", "type": "u64", "index": false },
        { "name": "creator", "type": "publicKey", "index": false },
        { "name": "assetSymbol", "type": "string", "index": false },
        { "name": "currentPrice", "type": "u64", "index": false },
        { "name": "deadline", "type": "i64", "index": false }
      ]
    },
    {
      "name": "BetPlaced",
      "fields": [
        { "name": "cardId", "type": "u64", "index": false },
        { "name": "user", "type": "publicKey", "index": false },
        { "name": "predictedPrice", "type": "u64", "index": false },
        { "name": "betAmount", "type": "u64", "index": false },
        { "name": "nftMint", "type": "publicKey", "index": false }
      ]
    },
    {
      "name": "PredictionSettled",
      "fields": [
        { "name": "cardId", "type": "u64", "index": false },
        { "name": "actualPrice", "type": "u64", "index": false },
        { "name": "totalPool", "type": "u64", "index": false }
      ]
    },
    {
      "name": "WinnerMarked",
      "fields": [
        { "name": "cardId", "type": "u64", "index": false },
        { "name": "winner", "type": "publicKey", "index": false },
        { "name": "predictedPrice", "type": "u64", "index": false },
        { "name": "betAmount", "type": "u64", "index": false }
      ]
    },
    {
      "name": "RewardsDistributed",
      "fields": [
        { "name": "cardId", "type": "u64", "index": false },
        { "name": "winner", "type": "publicKey", "index": false },
        { "name": "winnerAmount", "type": "u64", "index": false },
        { "name": "creator", "type": "publicKey", "index": false },
        { "name": "creatorReward", "type": "u64", "index": false },
        { "name": "platformFee", "type": "u64", "index": false }
      ]
    }
  ],
  "errors": [
    { "code": 6000, "name": "InvalidDeadline", "msg": "截止时间无效：必须设置在未来时间" },
    { "code": 6001, "name": "InvalidBetAmount", "msg": "押注金额无效：必须大于 0" },
    { "code": 6002, "name": "CardAlreadySettled", "msg": "预测卡已结算：无法再进行操作" },
    { "code": 6003, "name": "DeadlinePassed", "msg": "截止时间已过：无法再进行押注" },
    { "code": 6004, "name": "BetTooLow", "msg": "押注金额过低：低于最低押注要求" },
    { "code": 6005, "name": "DeadlineNotReached", "msg": "截止时间未到：无法进行结算" },
    { "code": 6006, "name": "CardNotSettled", "msg": "预测卡未结算：无法分发奖励" },
    { "code": 6007, "name": "InvalidPrediction", "msg": "预测价格无效：必须大于 0" },
    { "code": 6008, "name": "InvalidActualPrice", "msg": "实际价格无效：必须大于 0" },
    { "code": 6009, "name": "InvalidPredictionType", "msg": "预测类型无效：不匹配当前操作" },
    { "code": 6010, "name": "InvalidAssetSymbol", "msg": "资产符号无效：不能为空" },
    { "code": 6011, "name": "InvalidCurrentPrice", "msg": "当前价格无效：必须大于 0" },
    { "code": 6012, "name": "FeeRateTooHigh", "msg": "费率过高：超过最大允许值" },
    { "code": 6013, "name": "StringTooLong", "msg": "字符串过长：超过最大长度限制" },
    { "code": 6014, "name": "MathOverflow", "msg": "数学运算溢出" }
  ]
};

// 创建程序实例
const program = new Program(IDL, PROGRAM_ID, provider);

// 常用常量
const CONSTANTS = {
  // 种子常量
  SEEDS: {
    PLATFORM_CONFIG: 'platform_config',
    PRICE_PREDICTION_CARD: 'price_prediction_card',
    PRICE_CARD_TREASURY: 'price_card_treasury',
    USER_PRICE_BET: 'user_price_bet',
    PRICE_BET_NFT_MINT: 'price_bet_nft_mint',
    PLATFORM_TREASURY: 'platform_treasury'
  },
  
  // 程序 ID
  PROGRAM_IDS: {
    TOKEN_PROGRAM: TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM: ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_METADATA_PROGRAM: TOKEN_METADATA_PROGRAM_ID,
    SYSTEM_PROGRAM: '11111111111111111111111111111112'
  },
  
  // 默认值
  DEFAULTS: {
    PLATFORM_FEE_RATE: 500, // 5%
    CREATOR_REWARD_RATE: 300, // 3%
    MIN_BET_AMOUNT: 10000000, // 0.01 SOL
    MAX_BET_AMOUNT: 1000000000000 // 1000 SOL
  }
};

// 初始化检查
async function initializeCheck() {
  try {
    console.log('🔗 连接 Solana 网络...');
    const version = await connection.getVersion();
    console.log('✅ Solana 连接成功, 版本:', version['solana-core']);
    
    // 检查钱包余额
    const balance = await connection.getBalance(wallet.publicKey);
    console.log('💰 钱包余额:', balance / 1e9, 'SOL');
    
    if (balance < 1e8) { // 少于 0.1 SOL
      console.warn('⚠️  钱包余额较低，可能影响交易执行');
    }
    
    console.log('🏗️  程序 ID:', PROGRAM_ID.toString());
    
    return true;
  } catch (error) {
    console.error('❌ Solana 初始化失败:', error.message);
    return false;
  }
}

// 错误处理辅助函数
function parseAnchorError(error) {
  if (error.error && error.error.errorCode) {
    const errorCode = error.error.errorCode;
    const errorInfo = IDL.errors.find(e => e.code === errorCode.code);
    
    if (errorInfo) {
      return {
        code: errorInfo.code,
        name: errorInfo.name,
        message: errorInfo.msg,
        originalError: error
      };
    }
  }
  
  return {
    code: -1,
    name: 'UnknownError',
    message: error.message || '未知错误',
    originalError: error
  };
}

// 导出配置
module.exports = {
  connection,
  wallet,
  provider,
  program,
  PROGRAM_ID,
  IDL,
  CONSTANTS,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_METADATA_PROGRAM_ID,
  initializeCheck,
  parseAnchorError
};

// 自动执行初始化检查
if (require.main !== module) {
  initializeCheck();
}