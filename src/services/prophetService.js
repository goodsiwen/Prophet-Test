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
      description = ''
    } = params;

    console.log('🎯 创建预测卡...');
    console.log('🆔 卡片 ID:', cardId);
    console.log('📊 资产符号:', assetSymbol);
    console.log('💰 当前价格:', currentPrice);
    console.log('⏰ 截止时间:', new Date(deadline * 1000).toLocaleString());

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
          creator: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await connection.confirmTransaction(txHash, 'confirmed');
      console.log('✅ 预测卡创建成功');

      return {
        success: true,
        txHash,
        cardId,
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
    const { cardId, predictedPrice, betAmount, userPublicKey } = params;

    console.log('💰 进行押注...');
    console.log('🆔 卡片 ID:', cardId);
    console.log('🎯 预测价格:', predictedPrice);
    console.log('💵 押注金额:', betAmount);

    // 检查平台是否已初始化
    const isInitialized = await this.isPlatformInitialized();
    if (!isInitialized) {
      throw new Error('平台尚未初始化，无法进行押注');
    }

    const [pricePredictionCardPda] = this.getPricePredictionCardPDA(cardId);
    const [cardTreasuryPda] = this.getCardTreasuryPDA(cardId);
    const [userPriceBetPda] = this.getUserPriceBetPDA(cardId, userPublicKey);
    const [nftMintPda] = this.getNftMintPDA(cardId, userPublicKey);
    
    const userPublicKeyObj = new PublicKey(userPublicKey);
    const userNftAccount = await getAssociatedTokenAddress(nftMintPda, userPublicKeyObj);
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
          user: userPublicKeyObj,
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