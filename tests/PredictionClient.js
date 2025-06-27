// frontend/services/PredictionClient.js
import { 
  Connection, 
  Transaction, 
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY
} from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress 
} from '@solana/spl-token';
import { Program, AnchorProvider, BN } from '@project-serum/anchor';

class PredictionClient {
  constructor(connection, wallet, programId, idl) {
    this.connection = connection;
    this.wallet = wallet;
    this.programId = new PublicKey(programId);
    this.idl = idl;
    
    // 创建程序实例（用于前端直接调用）
    const provider = new AnchorProvider(connection, wallet, {});
    this.program = new Program(idl, this.programId, provider);
  }

  // 🎯 创建预测卡
  async createPredictionCard(params) {
    const { targetAsset, targetPrice, expirationTime } = params;
    
    if (!this.wallet.publicKey) {
      throw new Error('钱包未连接');
    }

    console.log('🎯 开始创建预测卡...');
    console.log('📊 目标资产:', targetAsset);
    console.log('💰 目标价格:', targetPrice);
    console.log('⏰ 到期时间:', new Date(expirationTime * 1000));

    try {
      // 1. 从后端获取构建好的交易
      const response = await fetch('/api/prediction/cards/build-create-transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetAsset,
          targetPrice,
          expirationTime,
          creatorPublicKey: this.wallet.publicKey.toString()
        })
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error);
      }

      console.log('🏗️ 交易构建成功，等待用户确认...');
      console.log('💸 预估费用:', result.metadata.estimatedFee, 'SOL');

      // 2. 反序列化交易
      const transaction = Transaction.from(
        Buffer.from(result.transaction, 'base64')
      );

      // 3. 用户在钱包中确认并签名 ✅
      const signedTransaction = await this.wallet.signTransaction(transaction);

      console.log('✍️ 交易已签名，正在发送到区块链...');

      // 4. 发送交易到区块链
      const txHash = await this.connection.sendRawTransaction(
        signedTransaction.serialize(),
        {
          skipPreflight: false,
          preflightCommitment: 'confirmed'
        }
      );

      console.log('📤 交易已发送:', txHash);

      // 5. 等待交易确认
      const confirmation = await this.connection.confirmTransaction(
        txHash, 
        'confirmed'
      );

      if (confirmation.value.err) {
        throw new Error(`交易失败: ${confirmation.value.err}`);
      }

      console.log('✅ 预测卡创建成功!');

      // 6. 通知后端更新数据库
      await this.notifyBackend('create_card', {
        txHash,
        cardId: result.cardId,
        ...result.accounts,
        ...result.metadata
      });

      return {
        success: true,
        txHash,
        cardId: result.cardId,
        accounts: result.accounts,
        explorerUrl: `https://explorer.solana.com/tx/${txHash}?cluster=devnet`
      };

    } catch (error) {
      console.error('❌ 创建预测卡失败:', error);
      throw new Error(`创建预测卡失败: ${error.message}`);
    }
  }

  // 💰 下注
  async placeBet(params) {
    const { cardId, predictedPrice, betAmount } = params;
    
    if (!this.wallet.publicKey) {
      throw new Error('钱包未连接');
    }

    console.log('💰 开始下注...');
    console.log('🆔 卡片ID:', cardId);
    console.log('🎯 预测价格:', predictedPrice);
    console.log('💵 押注金额:', betAmount, 'lamports');

    try {
      // 1. 检查用户是否已经下注
      const existingBet = await this.checkUserBet(cardId);
      if (existingBet.hasBet) {
        throw new Error('您已经在此预测卡上下注，每张卡只能下注一次');
      }

      // 2. 从后端获取构建好的交易
      const response = await fetch('/api/prediction/bets/build-place-transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cardId,
          predictedPrice,
          betAmount,
          userPublicKey: this.wallet.publicKey.toString()
        })
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error);
      }

      console.log('🏗️ 下注交易构建成功，等待用户确认...');
      console.log('💸 预估费用:', result.metadata.estimatedFee, 'SOL');
      console.log('🎨 将铸造 NFT:', result.metadata.nftMetadata.name);

      // 3. 反序列化交易
      const transaction = Transaction.from(
        Buffer.from(result.transaction, 'base64')
      );

      // 4. 用户在钱包中确认并签名 ✅
      const signedTransaction = await this.wallet.signTransaction(transaction);

      console.log('✍️ 交易已签名，正在发送到区块链...');

      // 5. 发送交易到区块链
      const txHash = await this.connection.sendRawTransaction(
        signedTransaction.serialize(),
        {
          skipPreflight: false,
          preflightCommitment: 'confirmed'
        }
      );

      console.log('📤 交易已发送:', txHash);

      // 6. 等待交易确认
      const confirmation = await this.connection.confirmTransaction(
        txHash, 
        'confirmed'
      );

      if (confirmation.value.err) {
        throw new Error(`交易失败: ${confirmation.value.err}`);
      }

      console.log('✅ 下注成功! NFT 已铸造');

      // 7. 通知后端更新数据库
      await this.notifyBackend('place_bet', {
        txHash,
        cardId: result.cardId,
        ...result.accounts,
        ...result.metadata
      });

      return {
        success: true,
        txHash,
        cardId: result.cardId,
        accounts: result.accounts,
        nftMetadata: result.metadata.nftMetadata,
        explorerUrl: `https://explorer.solana.com/tx/${txHash}?cluster=devnet`
      };

    } catch (error) {
      console.error('❌ 下注失败:', error);
      throw new Error(`下注失败: ${error.message}`);
    }
  }

  // 🔍 获取卡片信息
  async getCardInfo(cardId) {
    try {
      const response = await fetch(`/api/prediction/cards/${cardId}`);
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    } catch (error) {
      console.error('获取卡片信息失败:', error);
      throw error;
    }
  }

  // 🔍 检查用户下注状态
  async checkUserBet(cardId) {
    if (!this.wallet.publicKey) {
      return { hasBet: false, data: null };
    }

    try {
      const response = await fetch(
        `/api/prediction/cards/${cardId}/bets/${this.wallet.publicKey.toString()}`
      );
      const result = await response.json();
      
      return {
        hasBet: result.hasBet,
        data: result.data
      };
    } catch (error) {
      console.error('检查用户下注状态失败:', error);
      return { hasBet: false, data: null };
    }
  }

  // 📝 通知后端更新数据库
  async notifyBackend(type, data) {
    try {
      await fetch('/api/prediction/transactions/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type,
          data,
          txHash: data.txHash
        })
      });
    } catch (error) {
      console.warn('通知后端失败（不影响主要功能）:', error);
    }
  }

  // 💰 获取用户余额
  async getUserBalance() {
    if (!this.wallet.publicKey) {
      return 0;
    }

    try {
      const balance = await this.connection.getBalance(this.wallet.publicKey);
      return balance / 1e9; // 转换为 SOL
    } catch (error) {
      console.error('获取余额失败:', error);
      return 0;
    }
  }

  // 🎨 获取用户的预测 NFT