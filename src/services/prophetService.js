const { PublicKey, SystemProgram, LAMPORTS_PER_SOL, SYSVAR_RENT_PUBKEY } = require('@solana/web3.js');
const { getAssociatedTokenAddress } = require('@solana/spl-token');
const BN = require('bn.js');
const { 
  program, 
  connection, 
  wallet, 
  CONSTANTS, 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID, 
  TOKEN_METADATA_PROGRAM_ID,
  parseAnchorError 
} = require('../config/solana');

class ProphetService {
  
  /**
   * 检查程序是否可用
   */
  static checkProgramAvailability() {
    if (!program) {
      throw new Error('Anchor 程序未正确加载，请检查配置');
    }
    if (!program.account) {
      throw new Error('程序账户结构未定义，请检查 IDL');
    }
    console.log('✅ 程序检查通过');
  }

  /**
   * 获取平台配置 PDA
   */
  static getPlatformConfigPDA() {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(CONSTANTS.SEEDS.PLATFORM_CONFIG)],
      program.programId
    );
  }

  /**
   * 获取平台金库 PDA
   */
  static getPlatformTreasuryPDA() {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(CONSTANTS.SEEDS.PLATFORM_TREASURY)],
      program.programId
    );
  }

  /**
   * 初始化平台
   */
  static async initializePlatform(params) {
    const {
      platformFeeRate = CONSTANTS.DEFAULTS.PLATFORM_FEE_RATE,
      creatorRewardRate = CONSTANTS.DEFAULTS.CREATOR_REWARD_RATE
    } = params;

    console.log('🚀 开始初始化平台...');
    console.log('📊 平台费率:', platformFeeRate, '基点');
    console.log('🎁 创建者奖励率:', creatorRewardRate, '基点');

    // 检查程序可用性
    this.checkProgramAvailability();

    // 验证费率参数
    if (platformFeeRate < 0 || platformFeeRate > 10000) {
      throw new Error('平台费率必须在 0-10000 基点之间');
    }
    if (creatorRewardRate < 0 || creatorRewardRate > 10000) {
      throw new Error('创建者奖励率必须在 0-10000 基点之间');
    }

    const [platformConfigPda, platformConfigBump] = this.getPlatformConfigPDA();

    try {
      // 检查钱包余额
      const balance = await connection.getBalance(wallet.publicKey);
      console.log('💰 钱包余额:', balance / LAMPORTS_PER_SOL, 'SOL');
      
      if (balance < 0.01 * LAMPORTS_PER_SOL) {
        throw new Error('钱包余额不足，需要至少 0.01 SOL 用于交易费用');
      }

      // 检查平台是否已经初始化
      try {
        const existingPlatform = await program.account.platformConfig.fetch(platformConfigPda);
        if (existingPlatform) {
          throw new Error('平台已经初始化过了');
        }
      } catch (error) {
        // 如果账户不存在，继续初始化流程
        if (!error.message.includes('Account does not exist') && 
            !error.message.includes('平台已经初始化过了')) {
          console.log('⚠️  检查现有平台状态时出错，继续初始化:', error.message);
        }
      }

      console.log('📝 准备发送初始化交易...');
      console.log('🏗️  平台配置 PDA:', platformConfigPda.toString());
      console.log('🔑 权限地址:', wallet.publicKey.toString());
      
      const txHash = await program.methods
        .initializePlatform(
          platformFeeRate,
          creatorRewardRate
        )
        .accounts({
          platformConfig: platformConfigPda,
          authority: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log('📡 交易已发送:', txHash);
      console.log('⏳ 等待交易确认...');
      
      await connection.confirmTransaction(txHash, 'confirmed');
      console.log('✅ 交易确认成功');

      return {
        success: true,
        txHash,
        platformConfigPda: platformConfigPda.toString(),
        authority: wallet.publicKey.toString(),
        platformFeeRate,
        creatorRewardRate,
        bump: platformConfigBump,
        mode: 'blockchain'
      };
    } catch (error) {
      console.error('❌ 初始化平台失败:', error);
      
      // 解析 Anchor 错误
      const parsedError = parseAnchorError(error);
      throw new Error(`初始化平台失败: ${parsedError.message}`);
    }
  }

  /**
   * 获取平台信息
   */
  static async getPlatformInfo() {
    const [platformConfigPda] = this.getPlatformConfigPDA();
    const [platformTreasuryPda] = this.getPlatformTreasuryPDA();

    try {
      this.checkProgramAvailability();
      
      const platformConfig = await program.account.platformConfig.fetch(platformConfigPda);
      const treasuryBalance = await connection.getBalance(platformTreasuryPda);
      
      return {
        authority: platformConfig.authority.toString(),
        platformFeeRate: platformConfig.platformFeeRate.toString(),
        creatorRewardRate: platformConfig.creatorRewardRate.toString(),
        platformTreasury: platformConfig.platformTreasury.toString(),
        isPaused: platformConfig.isPaused,
        minBetAmount: platformConfig.minBetAmount.toString(),
        maxBetAmount: platformConfig.maxBetAmount.toString(),
        createdAt: platformConfig.createdAt.toString(),
        updatedAt: platformConfig.updatedAt.toString(),
        bump: platformConfig.bump,
        isInitialized: true,
        platformConfigPda: platformConfigPda.toString(),
        platformTreasuryPda: platformTreasuryPda.toString(),
        treasuryBalance,
        treasuryBalanceSOL: treasuryBalance / LAMPORTS_PER_SOL
      };
    } catch (error) {
      if (error.message.includes('Account does not exist')) {
        return {
          isInitialized: false,
          message: '平台尚未初始化',
          platformConfigPda: platformConfigPda.toString(),
          platformTreasuryPda: platformTreasuryPda.toString()
        };
      }
      
      const parsedError = parseAnchorError(error);
      throw new Error(`获取平台信息失败: ${parsedError.message}`);
    }
  }

  /**
   * 检查平台是否已初始化
   */
  static async isPlatformInitialized() {
    try {
      const [platformConfigPda] = this.getPlatformConfigPDA();
      await program.account.platformConfig.fetch(platformConfigPda);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取预测卡 PDA
   */
  static getPricePredictionCardPDA(cardId) {
    const cardIdBuffer = new BN(cardId).toArrayLike(Buffer, 'le', 8);
    
    return PublicKey.findProgramAddressSync(
      [Buffer.from(CONSTANTS.SEEDS.PRICE_PREDICTION_CARD), cardIdBuffer],
      program.programId
    );
  }

  /**
   * 获取卡片金库 PDA
   */
  static getCardTreasuryPDA(cardId) {
    const cardIdBuffer = new BN(cardId).toArrayLike(Buffer, 'le', 8);
    
    return PublicKey.findProgramAddressSync(
      [Buffer.from(CONSTANTS.SEEDS.PRICE_CARD_TREASURY), cardIdBuffer],
      program.programId
    );
  }

  /**
   * 获取用户押注 PDA
   */
  static getUserPriceBetPDA(cardId, userPublicKey) {
    const cardIdBuffer = new BN(cardId).toArrayLike(Buffer, 'le', 8);
    const userKeyBuffer = new PublicKey(userPublicKey).toBuffer();
    
    return PublicKey.findProgramAddressSync(
      [Buffer.from(CONSTANTS.SEEDS.USER_PRICE_BET), cardIdBuffer, userKeyBuffer],
      program.programId
    );
  }

  /**
   * 获取 NFT Mint PDA
   */
  static getNftMintPDA(cardId, userPublicKey) {
    const cardIdBuffer = new BN(cardId).toArrayLike(Buffer, 'le', 8);
    const userKeyBuffer = new PublicKey(userPublicKey).toBuffer();
    
    return PublicKey.findProgramAddressSync(
      [Buffer.from(CONSTANTS.SEEDS.PRICE_BET_NFT_MINT), cardIdBuffer, userKeyBuffer],
      program.programId
    );
  }

  /**
   * 获取 NFT 元数据 PDA
   */
  static getMetadataPDA(mintPublicKey) {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mintPublicKey.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );
  }

  /**
   * 🔥 新增：获取所有预测卡
   * 方法1：通过程序账户获取（推荐）
   */
  static async getAllPredictionCards(options = {}) {
    const {
      limit = 100,
      offset = 0,
      includeSettled = true,
      sortBy = 'createdAt', // 'createdAt', 'deadline', 'totalPool'
      sortOrder = 'desc' // 'asc', 'desc'
    } = options;

    console.log('📋 获取所有预测卡...');
    console.log('   - 限制:', limit);
    console.log('   - 偏移:', offset);
    console.log('   - 包含已结算:', includeSettled);

    try {
      this.checkProgramAvailability();

      // 获取所有 PricePredictionCard 账户
      const accounts = await program.account.pricePredictionCard.all();
      
      console.log(`📊 找到 ${accounts.length} 个预测卡账户`);

      // 转换账户数据
      let cards = accounts.map(account => {
        const card = account.account;
        return {
          id: card.id.toString(),
          creator: card.creator.toString(),
          assetSymbol: card.assetSymbol,
          currentPrice: card.currentPrice.toString(),
          deadline: card.deadline.toString(),
          minBetAmount: card.minBetAmount.toString(),
          imageUri: card.imageUri,
          description: card.description,
          totalPool: card.totalPool.toString(),
          totalBets: card.totalBets.toString(),
          isSettled: card.isSettled,
          actualPrice: card.actualPrice ? card.actualPrice.toString() : '0',
          winner: card.winner ? card.winner.toString() : null,
          createdAt: card.createdAt.toString(),
          settledAt: card.settledAt ? card.settledAt.toString() : null,
          bump: card.bump,
          pda: account.publicKey.toString(),
          // 🔥 添加计算字段
          deadlineDate: new Date(parseInt(card.deadline.toString()) * 1000),
          createdAtDate: new Date(parseInt(card.createdAt.toString()) * 1000),
          totalPoolSOL: parseFloat(card.totalPool.toString()) / LAMPORTS_PER_SOL,
          currentPriceFormatted: parseFloat(card.currentPrice.toString()) / 100, // 假设价格以分为单位
          isActive: !card.isSettled && Date.now() < parseInt(card.deadline.toString()) * 1000,
          isExpired: !card.isSettled && Date.now() >= parseInt(card.deadline.toString()) * 1000
        };
      });

      // 🔥 过滤条件
      if (!includeSettled) {
        cards = cards.filter(card => !card.isSettled);
      }

      // 🔥 排序
      cards.sort((a, b) => {
        let aValue, bValue;
        
        switch (sortBy) {
          case 'deadline':
            aValue = parseInt(a.deadline);
            bValue = parseInt(b.deadline);
            break;
          case 'totalPool':
            aValue = parseFloat(a.totalPool);
            bValue = parseFloat(b.totalPool);
            break;
          case 'totalBets':
            aValue = parseInt(a.totalBets);
            bValue = parseInt(b.totalBets);
            break;
          case 'createdAt':
          default:
            aValue = parseInt(a.createdAt);
            bValue = parseInt(b.createdAt);
            break;
        }

        if (sortOrder === 'asc') {
          return aValue - bValue;
        } else {
          return bValue - aValue;
        }
      });

      // 🔥 分页
      const paginatedCards = cards.slice(offset, offset + limit);

      // 🔥 统计信息
      const stats = {
        total: cards.length,
        active: cards.filter(card => card.isActive).length,
        expired: cards.filter(card => card.isExpired).length,
        settled: cards.filter(card => card.isSettled).length,
        totalPoolAll: cards.reduce((sum, card) => sum + parseFloat(card.totalPool), 0),
        totalBetsAll: cards.reduce((sum, card) => sum + parseInt(card.totalBets), 0)
      };

      console.log('📈 统计信息:', stats);

      return {
        success: true,
        cards: paginatedCards,
        pagination: {
          total: cards.length,
          limit,
          offset,
          hasMore: offset + limit < cards.length
        },
        stats,
        filters: {
          includeSettled,
          sortBy,
          sortOrder
        }
      };

    } catch (error) {
      const parsedError = parseAnchorError(error);
      throw new Error(`获取所有预测卡失败: ${parsedError.message}`);
    }
  }

  /**
   * 🔥 新增：通过 ID 范围获取预测卡（备用方法）
   */
  static async getPredictionCardsByRange(startId = 0, endId = 100) {
    console.log(`📋 获取预测卡范围: ${startId} - ${endId}`);
    
    const cards = [];
    const errors = [];

    for (let cardId = startId; cardId <= endId; cardId++) {
      try {
        const card = await this.getPredictionCard(cardId);
        cards.push(card);
      } catch (error) {
        // 跳过不存在的卡片
        if (!error.message.includes('Account does not exist')) {
          errors.push({ cardId, error: error.message });
        }
      }
    }

    console.log(`✅ 找到 ${cards.length} 个有效预测卡`);
    if (errors.length > 0) {
      console.log(`⚠️  ${errors.length} 个卡片获取失败`);
    }

    return {
      success: true,
      cards,
      range: { startId, endId },
      found: cards.length,
      errors: errors.length,
      errorDetails: errors
    };
  }

  /**
   * 🔥 新增：获取活跃预测卡（未结算且未过期）
   */
  static async getActivePredictionCards(limit = 50) {
    console.log('🎯 获取活跃预测卡...');
    
    const allCards = await this.getAllPredictionCards({
      limit: 1000, // 先获取更多数据进行过滤
      includeSettled: false
    });

    const now = Date.now();
    const activeCards = allCards.cards.filter(card => {
      const deadline = parseInt(card.deadline) * 1000;
      return !card.isSettled && now < deadline;
    });

    // 按截止时间排序（最近到期的在前）
    activeCards.sort((a, b) => parseInt(a.deadline) - parseInt(b.deadline));

    return {
      success: true,
      cards: activeCards.slice(0, limit),
      total: activeCards.length,
      currentTime: now
    };
  }

  /**
   * 🔥 新增：获取用户创建的预测卡
   */
  static async getUserCreatedCards(creatorPublicKey, limit = 50) {
    console.log('👤 获取用户创建的预测卡:', creatorPublicKey);
    
    const allCards = await this.getAllPredictionCards({
      limit: 1000
    });

    const userCards = allCards.cards.filter(card => 
      card.creator === creatorPublicKey
    );

    // 按创建时间排序（最新的在前）
    userCards.sort((a, b) => parseInt(b.createdAt) - parseInt(a.createdAt));

    return {
      success: true,
      cards: userCards.slice(0, limit),
      total: userCards.length,
      creator: creatorPublicKey
    };
  }

  /**
   * 🔥 新增：搜索预测卡
   */
  static async searchPredictionCards(query, options = {}) {
    const { limit = 20 } = options;
    
    console.log('🔍 搜索预测卡:', query);
    
    const allCards = await this.getAllPredictionCards({
      limit: 1000
    });

    const searchResults = allCards.cards.filter(card => {
      const searchText = query.toLowerCase();
      return (
        card.assetSymbol.toLowerCase().includes(searchText) ||
        card.description.toLowerCase().includes(searchText) ||
        card.id.includes(searchText)
      );
    });

    return {
      success: true,
      cards: searchResults.slice(0, limit),
      total: searchResults.length,
      query
    };
  }

  /**
   * 创建预测卡
   */
  static async createPredictionCard(params) {
    const {
      cardId,
      assetSymbol,
      currentPrice,
      deadline,
      minBetAmount,
      imageUri = '',
      description = '',
      creatorPublicKey
    } = params;

    console.log('🎯 创建预测卡...');
    console.log('🆔 卡片 ID:', cardId);
    console.log('📊 资产符号:', assetSymbol);
    console.log('💰 当前价格:', currentPrice);
    console.log('⏰ 截止时间:', new Date(deadline * 1000).toLocaleString());
    console.log('👤 创建者:', creatorPublicKey);

    // 验证创建者参数
    if (!creatorPublicKey) {
      throw new Error('创建者公钥 (creatorPublicKey) 是必需参数');
    }

    // 验证创建者公钥格式
    let creatorKey;
    try {
      creatorKey = new PublicKey(creatorPublicKey);
    } catch (error) {
      throw new Error('创建者公钥格式无效');
    }

    // 检查平台是否已初始化
    const isInitialized = await this.isPlatformInitialized();
    if (!isInitialized) {
      throw new Error('平台尚未初始化，请先初始化平台');
    }

    const [pricePredictionCardPda] = this.getPricePredictionCardPDA(cardId);
    const [cardTreasuryPda] = this.getCardTreasuryPDA(cardId);

    try {
      const txHash = await program.methods
        .createPricePredictionCard(
          new BN(cardId),
          assetSymbol,
          new BN(currentPrice),
          new BN(deadline),
          new BN(minBetAmount),
          imageUri,
          description
        )
        .accounts({
          pricePredictionCard: pricePredictionCardPda,
          cardTreasury: cardTreasuryPda,
          creator: creatorKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await connection.confirmTransaction(txHash, 'confirmed');
      console.log('✅ 预测卡创建成功');

      return {
        success: true,
        txHash,
        cardId,
        creator: creatorPublicKey,
        pricePredictionCardPda: pricePredictionCardPda.toString(),
        cardTreasuryPda: cardTreasuryPda.toString()
      };
    } catch (error) {
      const parsedError = parseAnchorError(error);
      throw new Error(`创建预测卡失败: ${parsedError.message}`);
    }
  }

  /**
   * 进行押注
   */
  static async placeBet(params) {
    const { 
      cardId, 
      predictedPrice, 
      betAmount, 
      userPublicKey
    } = params;

    console.log('💰 进行押注...');
    console.log('🆔 卡片 ID:', cardId);
    console.log('🎯 预测价格:', predictedPrice);
    console.log('💵 押注金额:', betAmount);
    console.log('👤 押注用户:', userPublicKey);

    // 验证用户参数
    if (!userPublicKey) {
      throw new Error('用户公钥 (userPublicKey) 是必需参数');
    }

    // 验证用户公钥格式
    let userKey;
    try {
      userKey = new PublicKey(userPublicKey);
    } catch (error) {
      throw new Error('用户公钥格式无效');
    }

    // 检查平台是否已初始化
    const isInitialized = await this.isPlatformInitialized();
    if (!isInitialized) {
      throw new Error('平台尚未初始化，无法进行押注');
    }

    const [pricePredictionCardPda] = this.getPricePredictionCardPDA(cardId);
    const [cardTreasuryPda] = this.getCardTreasuryPDA(cardId);
    const [userPriceBetPda] = this.getUserPriceBetPDA(cardId, userPublicKey);
    const [nftMintPda] = this.getNftMintPDA(cardId, userPublicKey);
    
    const userNftAccount = await getAssociatedTokenAddress(nftMintPda, userKey);
    const [metadataAccount] = this.getMetadataPDA(nftMintPda);

    try {
      const txHash = await program.methods
        .placePriceBet(
          new BN(cardId),
          new BN(predictedPrice),
          new BN(betAmount)
        )
        .accounts({
          pricePredictionCard: pricePredictionCardPda,
          userPriceBet: userPriceBetPda,
          cardTreasury: cardTreasuryPda,
          nftMint: nftMintPda,
          userNftAccount: userNftAccount,
          metadataAccount: metadataAccount,
          user: userKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          metadataProgram: TOKEN_METADATA_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      await connection.confirmTransaction(txHash, 'confirmed');
      console.log('✅ 押注成功');

      return {
        success: true,
        txHash,
        cardId,
        user: userPublicKey,
        userPriceBetPda: userPriceBetPda.toString(),
        nftMint: nftMintPda.toString(),
        userNftAccount: userNftAccount.toString()
      };
    } catch (error) {
      const parsedError = parseAnchorError(error);
      throw new Error(`押注失败: ${parsedError.message}`);
    }
  }

  /**
   * 获取预测卡信息
   */
  static async getPredictionCard(cardId) {
    try {
      const [pricePredictionCardPda] = this.getPricePredictionCardPDA(cardId);
      const card = await program.account.pricePredictionCard.fetch(pricePredictionCardPda);
      
      return {
        id: card.id.toString(),
        creator: card.creator.toString(),
        assetSymbol: card.assetSymbol,
        currentPrice: card.currentPrice.toString(),
        deadline: card.deadline.toString(),
        minBetAmount: card.minBetAmount.toString(),
        imageUri: card.imageUri,
        description: card.description,
        totalPool: card.totalPool.toString(),
        totalBets: card.totalBets.toString(),
        isSettled: card.isSettled,
        actualPrice: card.actualPrice.toString(),
        winner: card.winner ? card.winner.toString() : null,
        createdAt: card.createdAt.toString(),
        settledAt: card.settledAt ? card.settledAt.toString() : null,
        bump: card.bump,
        pda: pricePredictionCardPda.toString()
      };
    } catch (error) {
      const parsedError = parseAnchorError(error);
      throw new Error(`获取预测卡失败: ${parsedError.message}`);
    }
  }

  /**
   * 获取用户押注信息
   */
  static async getUserBet(cardId, userPublicKey) {
    try {
      const [userPriceBetPda] = this.getUserPriceBetPDA(cardId, userPublicKey);
      const bet = await program.account.userPriceBet.fetch(userPriceBetPda);
      
      return {
        cardId: bet.cardId.toString(),
        user: bet.user.toString(),
        predictedPrice: bet.predictedPrice.toString(),
        betAmount: bet.betAmount.toString(),
        nftMint: bet.nftMint.toString(),
        timestamp: bet.timestamp.toString(),
        isWinner: bet.isWinner,
        bump: bet.bump,
        pda: userPriceBetPda.toString()
      };
    } catch (error) {
      const parsedError = parseAnchorError(error);
      throw new Error(`获取用户押注失败: ${parsedError.message}`);
    }
  }

  /**
   * 获取账户余额
   */
  static async getBalance(publicKey) {
    try {
      const balance = await connection.getBalance(new PublicKey(publicKey));
      return balance;
    } catch (error) {
      throw new Error(`获取余额失败: ${error.message}`);
    }
  }

  /**
   * 获取系统状态
   */
  static async getSystemStatus() {
    try {
      const walletBalance = await this.getBalance(wallet.publicKey.toString());
      const isInitialized = await this.isPlatformInitialized();
      
      let platformInfo = null;
      if (isInitialized) {
        platformInfo = await this.getPlatformInfo();
      }

      return {
        wallet: {
          address: wallet.publicKey.toString(),
          balance: walletBalance,
          balanceSOL: walletBalance / LAMPORTS_PER_SOL
        },
        platform: {
          isInitialized,
          info: platformInfo
        },
        program: {
          id: program.programId.toString(),
          network: connection.rpcEndpoint
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`获取系统状态失败: ${error.message}`);
    }
  }
}

module.exports = ProphetService;