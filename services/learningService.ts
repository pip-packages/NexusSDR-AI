
import { OutreachAttempt, LearningInsight, Prospect } from '../types';

const STORAGE_KEY_ATTEMPTS = 'sdr_attempts';
const STORAGE_KEY_INSIGHTS = 'sdr_insights';

export const learningService = {
  getAttempts(): OutreachAttempt[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ATTEMPTS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  },

  getInsights(): LearningInsight[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_INSIGHTS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  },

  saveInsights(insights: LearningInsight[]) {
    localStorage.setItem(STORAGE_KEY_INSIGHTS, JSON.stringify(insights));
  },

  recordAttempt(prospect: Prospect, content: string, subject: string): OutreachAttempt {
    const attempts = this.getAttempts();
    
    const newAttempt: OutreachAttempt = {
      id: `att_${Date.now()}`,
      prospectId: prospect.id,
      timestamp: new Date().toISOString(),
      content,
      variables: {
        subjectLength: subject.length,
        wordCount: content.split(' ').length,
        tone: 'professional',
        personalizationHook: 'unknown',
        sendHour: new Date().getHours()
      },
      prospectAttributes: {
        title: prospect.title,
        industry: prospect.industry,
        companySize: prospect.companySize || 'Unknown'
      },
      outcomes: {
        opened: false,
        replied: false,
        booked: false
      }
    };

    attempts.push(newAttempt);
    localStorage.setItem(STORAGE_KEY_ATTEMPTS, JSON.stringify(attempts));
    return newAttempt;
  },

  updateOutcome(prospectId: string, outcomeType: 'opened' | 'replied' | 'booked', value: boolean = true) {
    const attempts = this.getAttempts();
    const attemptIndex = attempts.map(a => a.prospectId).lastIndexOf(prospectId);
    
    if (attemptIndex !== -1) {
      attempts[attemptIndex].outcomes[outcomeType] = value;
      if (outcomeType === 'replied' || outcomeType === 'booked') {
        attempts[attemptIndex].outcomes.opened = true;
      }
      localStorage.setItem(STORAGE_KEY_ATTEMPTS, JSON.stringify(attempts));
    }
  },

  getRelevantInsights(prospect: Prospect): LearningInsight[] {
    const allInsights = this.getInsights();
    return allInsights.filter(insight => {
        if (!insight.targetSegment) return true;
        const target = insight.targetSegment.toLowerCase();
        return (
            prospect.title.toLowerCase().includes(target) || 
            prospect.industry.toLowerCase().includes(target)
        );
    });
  }
};
