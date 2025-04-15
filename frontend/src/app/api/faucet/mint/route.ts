import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

const FAUCET_ABI = [
  'function mint(address to, uint256 amount) external',
  'function balanceOf(address account) view returns (uint256)',
];

const MINT_AMOUNT = {
  PYUSD: ethers.parseUnits('100', 6), // 100 PYUSD
  USDC: ethers.parseUnits('100', 6),  // 100 USDC
};

const RATE_LIMIT_WINDOW = 24 * 60 * 60 * 1000; // 24 hours
const rateLimit = new Map<string, number>();

export async function POST(req: NextRequest) {
  try {
    const { token, address } = await req.json();

    if (!token || !address) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Rate limit check
    const key = `${address}-${token}`;
    const lastMint = rateLimit.get(key) || 0;
    const now = Date.now();

    if (now - lastMint < RATE_LIMIT_WINDOW) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Try again in 24 hours.' },
        { status: 429 }
      );
    }

    // Initialize provider and wallet
    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
    const wallet = new ethers.Wallet('0x290996a52c073ddfb9cd2f90dc2da8584f57a9c699c48522792cdf54e2f44812', provider);
    console.log('Wallet address:', wallet.address);
    
    // Initialize token contract
    const tokenContract = new ethers.Contract(token, FAUCET_ABI, wallet);
    
    // Mint tokens
    const tx = await tokenContract.mint(
      address,
      MINT_AMOUNT[token as keyof typeof MINT_AMOUNT] || MINT_AMOUNT.PYUSD
    );
    
    await tx.wait();
    
    // Update rate limit
    rateLimit.set(key, now);

    return NextResponse.json({
      success: true,
      transaction: tx.hash,
      amount: ethers.formatUnits(
        MINT_AMOUNT[token as keyof typeof MINT_AMOUNT] || MINT_AMOUNT.PYUSD,
        6
      ),
    });
  } catch (error: any) {
    console.error('Faucet error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to mint tokens' },
      { status: 500 }
    );
  }
}
