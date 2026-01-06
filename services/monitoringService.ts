
import { CampaignMetrics, MonitoringResult, Alert, HealthScores } from '../types';

const simulateLatency = () => new Promise(resolve => setTimeout(resolve, 600));

export const monitoringService = {
  
  async gatherCampaignMetrics(campaignId: string): Promise<CampaignMetrics> {
    await simulateLatency();
    
    // Simulate metrics based on a fictional "Live" campaign state
    // In a real app, this queries the database or ESP API (SendGrid/Mailgun)
    const sent = 1542;
    const bounced = 28; // ~1.8%
    const delivered = sent - bounced;
    const spam_complaints = 1; // ~0.06%
    const opened = 680; // ~44%
    const clicked = 120; // ~7%
    const replied = 85; // ~5.5%
    const unsubscribed = 12; // ~0.8%
    const meetings_booked = 8; // ~0.5% conversion from sent, ~9% from reply

    return {
      sent,
      delivered,
      bounced,
      spam_complaints,
      opened,
      clicked,
      replied,
      unsubscribed,
      meetings_booked,
      
      delivery_rate: delivered / sent,
      bounce_rate: bounced / sent,
      spam_rate: spam_complaints / sent,
      open_rate: opened / delivered,
      click_rate: clicked / delivered,
      reply_rate: replied / delivered,
      unsubscribe_rate: unsubscribed / delivered,
      conversion_rate: meetings_booked / sent
    };
  },

  calculateHealthScores(metrics: CampaignMetrics): HealthScores {
    // 1. Deliverability Score (Base 100, penalize bounces/spam)
    let deliverability = 100;
    if (metrics.bounce_rate > 0.02) deliverability -= 20;
    else if (metrics.bounce_rate > 0.01) deliverability -= 10;
    
    if (metrics.spam_rate > 0.001) deliverability -= 40; // High penalty for spam
    
    // 2. Engagement Score (Open/Reply weighted)
    // Benchmark: Open 40%, Reply 5%
    const openScore = Math.min(50, (metrics.open_rate / 0.40) * 50);
    const replyScore = Math.min(50, (metrics.reply_rate / 0.05) * 50);
    const engagement = openScore + replyScore;

    // 3. Conversion Score (Meetings)
    // Benchmark: 1% from sent is amazing
    const conversion = Math.min(100, (metrics.conversion_rate / 0.01) * 100);

    // 4. Overall Weighted
    const overall = (deliverability * 0.4) + (engagement * 0.4) + (conversion * 0.2);

    return {
      deliverability: Math.round(Math.max(0, deliverability)),
      engagement: Math.round(Math.max(0, engagement)),
      conversion: Math.round(Math.max(0, conversion)),
      overall: Math.round(Math.max(0, overall))
    };
  },

  async executeIntervention(campaignId: string, alert: Alert): Promise<string> {
    await simulateLatency();
    console.log(`[AUTONOMOUS INTERVENTION] Campaign ${campaignId}: Executing ${alert.recommended_action}`);
    
    switch (alert.recommended_action) {
        case 'pause_and_verify_emails':
            return "Paused campaign. Queued remaining contacts for deep verification.";
        case 'pause_and_review_content':
            return "Paused campaign. Flagged templates for 'Spam Words' review.";
        case 'test_new_subject_lines':
            return "Activated 'Variant B' subject lines for next 100 sends.";
        case 'review_messaging':
            return "Flagged campaign for manual review (Reply rate drop).";
        default:
            return `Logged action: ${alert.recommended_action}`;
    }
  },

  async generateRecommendations(metrics: CampaignMetrics, alerts: Alert[]): Promise<string[]> {
      const recs = [];
      
      if (metrics.open_rate < 0.30) {
          recs.push("Subject Line Fatigue detected. Suggest rotating 3 new variations.");
      }
      if (metrics.click_rate > 0.1 && metrics.reply_rate < 0.02) {
          recs.push("High Interest (Clicks) but Low Reply. Review CTA friction.");
      }
      if (metrics.sent > 1000 && metrics.meetings_booked === 0) {
          recs.push("CRITICAL: Pipeline blockage. 1000+ sends with 0 meetings. Re-evaluate ICP fit.");
      }
      
      return recs;
  },

  async campaignHealthMonitor(
    campaignId: string,
    monitoringIntervalHours: number = 6,
    autoOptimize: boolean = true
  ): Promise<MonitoringResult> {
    
    // 1. Gather Metrics
    const metrics = await this.gatherCampaignMetrics(campaignId);
    
    // 2. Calculate Health
    const healthScores = this.calculateHealthScores(metrics);
    
    // 3. Check for Alerts
    const alerts: Alert[] = [];
    const timestamp = new Date().toISOString();

    // Critical Thresholds
    if (metrics.bounce_rate > 0.02) {
        alerts.push({
            id: `alt_${Date.now()}_1`,
            level: 'critical',
            type: 'high_bounce_rate',
            value: metrics.bounce_rate,
            threshold: 0.02,
            recommended_action: 'pause_and_verify_emails',
            timestamp
        });
    }
    if (metrics.spam_rate > 0.001) {
        alerts.push({
            id: `alt_${Date.now()}_2`,
            level: 'critical',
            type: 'high_spam_rate',
            value: metrics.spam_rate,
            threshold: 0.001,
            recommended_action: 'pause_and_review_content',
            timestamp
        });
    }

    // Warning Thresholds
    if (metrics.open_rate < 0.20) {
        alerts.push({
            id: `alt_${Date.now()}_3`,
            level: 'warning',
            type: 'low_open_rate',
            value: metrics.open_rate,
            threshold: 0.20,
            recommended_action: 'test_new_subject_lines',
            timestamp
        });
    }
    if (metrics.reply_rate < 0.02) {
        alerts.push({
            id: `alt_${Date.now()}_4`,
            level: 'warning',
            type: 'low_reply_rate',
            value: metrics.reply_rate,
            threshold: 0.02,
            recommended_action: 'review_messaging',
            timestamp
        });
    }

    // 4. Take Automatic Actions
    const actionsTaken: string[] = [];
    if (autoOptimize && alerts.length > 0) {
        for (const alert of alerts) {
            if (alert.level === 'critical' || (alert.level === 'warning' && alert.type === 'low_open_rate')) {
                const result = await this.executeIntervention(campaignId, alert);
                actionsTaken.push(result);
            }
        }
    }

    // 5. Generate Insights
    const recommendations = await this.generateRecommendations(metrics, alerts);

    // 6. Admin Notification (Simulation)
    if (alerts.some(a => a.level === 'critical')) {
        console.warn(`[CRITICAL ALERT] Campaign ${campaignId} requires immediate attention.`);
    }

    const nextCheck = new Date();
    nextCheck.setHours(nextCheck.getHours() + monitoringIntervalHours);

    return {
        campaign_id: campaignId,
        timestamp,
        metrics,
        health_scores: healthScores,
        alerts,
        actions_taken: actionsTaken,
        recommendations,
        next_check: nextCheck.toISOString()
    };
  }
};
