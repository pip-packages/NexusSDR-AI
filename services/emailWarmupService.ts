
import { WarmupStats } from '../types';

export const emailWarmupService = {
  async getStats(provider: 'Instantly' | 'Warmbox'): Promise<WarmupStats> {
    // Simulate API latency
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Simulate realistic healthy warmup stats
    // In a real implementation, this would fetch from https://api.instantly.ai/v1/analytics/warmup or similar
    
    const baseInboxRate = 92;
    const volatility = Math.random() * 8; // 0 to 8%
    const inboxRate = Math.min(100, parseFloat((baseInboxRate + volatility).toFixed(1)));
    const spamRate = parseFloat((100 - inboxRate).toFixed(1));
    
    const dailyVolume = 30 + Math.floor(Math.random() * 25); // 30-55 emails/day
    const totalSent = 1200 + Math.floor(Math.random() * 500);

    return {
      provider,
      inboxRate,
      spamRate,
      dailyVolume,
      warmupEmailsSent: totalSent,
      status: inboxRate > 95 ? 'active' : 'issues_detected'
    };
  }
};
