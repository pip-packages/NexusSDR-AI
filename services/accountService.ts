
import { Prospect, AccountIntelligence, AccountContactSummary } from '../types';
import { memoryService } from './memoryService';
import { generateAccountStrategy, mapBuyingCommittee } from './geminiService';

export const accountService = {
  // Group prospects by normalized company name
  groupProspectsByAccount(prospects: Prospect[]): Record<string, Prospect[]> {
    return prospects.reduce((acc, p) => {
      const key = p.company.toLowerCase().trim();
      if (!acc[key]) acc[key] = [];
      acc[key].push(p);
      return acc;
    }, {} as Record<string, Prospect[]>);
  },

  // Analyze an account group to generate intelligence
  async analyzeAccount(accountName: string, prospects: Prospect[]): Promise<AccountIntelligence> {
    
    const accountId = accountName.toLowerCase().trim();
    
    // 1. Build Contact Summaries
    const contactSummaries: AccountContactSummary[] = prospects.map(p => ({
        id: p.id,
        name: p.name,
        title: p.title,
        status: p.status
    }));

    // 2. Aggregate Signals from Memory
    let activeEvaluation = false;
    let budgetConfirmed = false;
    let timeline = undefined;
    
    // Check memory for every prospect in this account
    prospects.forEach(p => {
        const mem = memoryService.getMemory(p.id);
        if (mem) {
             if (mem.extracted_intelligence.budget_indicators.length > 0) budgetConfirmed = true;
             if (mem.extracted_intelligence.timeline_indicators.length > 0) timeline = mem.extracted_intelligence.timeline_indicators[0];
             // Simple heuristic for evaluation
             if (mem.lead_status === 'engaged' || mem.lead_status === 'booked' || mem.engagement_score > 5) activeEvaluation = true;
        }
    });

    const signals = {
        active_evaluation: activeEvaluation,
        multiple_stakeholders: prospects.length > 1,
        budget_confirmed: budgetConfirmed,
        timeline: timeline
    };

    // 3. Generate Strategy via AI
    const strategyResult = await generateAccountStrategy(accountName, contactSummaries, signals);

    // 4. Generate Buying Committee Map (Enhanced with signals)
    const committee = await mapBuyingCommittee(accountName, prospects, signals);

    return {
        account_id: accountId,
        company: prospects[0]?.company || accountName,
        contacts_engaged: contactSummaries,
        account_signals: signals,
        recommended_strategy: strategyResult.strategy,
        next_actions: strategyResult.nextActions,
        generated_at: new Date().toISOString(),
        buying_committee: committee
    };
  }
};
