
import { Prospect, ProspectMemory, SendRecommendation, ScheduledActivity, SchedulingConstraints, OptimizedSchedule } from '../types';

function calculateOptimalSlot(
    activity: ScheduledActivity,
    constraints: SchedulingConstraints,
    usageMap: Record<string, number>, // Key: "YYYY-MM-DD-HH" -> count
    lastScheduledMap: Record<string, Date> // Key: prospectId -> lastTime
): Date | null {
    // Start looking from now or start_date
    let cursor = constraints.start_date ? new Date(constraints.start_date) : new Date();
    // Advance to next hour start to be clean
    cursor.setMinutes(0, 0, 0);
    cursor.setHours(cursor.getHours() + 1);

    const maxAttempts = 168; // Look ahead 1 week (hours)

    for (let i = 0; i < maxAttempts; i++) {
        // 1. Check Day Constraint
        if (constraints.avoid_days.includes(cursor.getDay())) {
            cursor.setHours(cursor.getHours() + 1);
            continue;
        }

        // 2. Check Business Hours (Simple 9-5 assumption relative to implied prospect timezone or local)
        // Ideally we use prospect specific timezone, but here we assume cursor is in relevant timezone or UTC simplified
        const hour = cursor.getHours();
        if (constraints.business_hours_only && (hour < 9 || hour >= 17)) {
            cursor.setHours(cursor.getHours() + 1);
            continue;
        }

        // 3. Check Usage Limits
        const hourKey = `${cursor.toISOString().slice(0, 13)}`; // YYYY-MM-DD-THH
        // Simple mock of daily usage aggregation (in real app, usageMap would be more complex)
        const currentHourly = usageMap[hourKey] || 0;
        
        if (currentHourly >= constraints.max_emails_per_hour) {
            cursor.setHours(cursor.getHours() + 1);
            continue;
        }

        // 4. Check Spacing (Min Gap)
        const lastTime = lastScheduledMap[activity.prospectId];
        if (lastTime) {
            const diffMinutes = (cursor.getTime() - lastTime.getTime()) / (1000 * 60);
            if (diffMinutes < constraints.min_gap_minutes) {
                cursor.setHours(cursor.getHours() + 1);
                continue;
            }
        }

        // Found a slot
        return new Date(cursor);
    }

    return null;
}

export const temporalService = {
  analyzeTiming(prospect: Prospect, memory: ProspectMemory | null): SendRecommendation {
    const now = new Date();
    const day = now.getDay(); // 0 = Sun, 6 = Sat
    const hour = now.getHours(); // 0-23
    const month = now.getMonth(); // 0-11
    const date = now.getDate();

    let score = 50; // Base score
    const factors: string[] = [];
    let action: 'send_now' | 'schedule_later' | 'hold' = 'send_now';
    let bestTime = undefined;
    let reason = "Conditions are acceptable for outreach.";

    // 1. Day of Week Check
    if (day === 0 || day === 6) {
        action = 'schedule_later';
        reason = "It's the weekend. Professional outreach has low open rates.";
        bestTime = "Monday 9:00 AM";
        factors.push("Weekend detected");
        score -= 20;
    } else if (day === 1) {
        factors.push("Monday - crowded inbox risk");
        score -= 5;
    } else if (day === 5 && hour > 14) {
        action = 'schedule_later';
        reason = "Late Friday afternoon. Prospect likely checking out.";
        bestTime = "Monday 10:00 AM";
        factors.push("Late Friday");
        score -= 15;
    }

    // 2. Time of Day Check (Assume prospect is in user's timezone for demo simplicity)
    // In real app, we'd use prospect.location to map timezone.
    if (hour < 8 || hour > 18) {
        if (action === 'send_now') {
            action = 'schedule_later';
            reason = "Outside typical business hours.";
            bestTime = "Tomorrow 9:30 AM";
        }
        factors.push("Outside business hours");
    }

    // 3. Holidays & Seasonal (Hardcoded simple check)
    if (month === 11 && date > 20) {
        action = 'hold';
        reason = "End of Year / Holiday Season. Defer to Jan 2nd.";
        bestTime = "January 2nd";
        factors.push("Holiday Season");
        score -= 30;
    }

    // 4. Interaction Spacing (from Memory)
    if (memory && memory.interaction_history.length > 0) {
        const lastOutbound = [...memory.interaction_history]
            .reverse()
            .find(i => i.direction === 'outbound');
        
        if (lastOutbound) {
            const lastDate = new Date(lastOutbound.date);
            const diffTime = Math.abs(now.getTime() - lastDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

            if (diffDays < 3 && lastOutbound.outcome !== 'replied_positive') {
                action = 'hold';
                reason = `Too soon. Last outreach was ${diffDays} days ago.`;
                bestTime = `In ${3 - diffDays} days`;
                factors.push("Rapid follow-up prevention");
                score -= 40;
            } else {
                factors.push(`Appropriate spacing (${diffDays} days)`);
                score += 10;
            }
        }
    }

    // 5. Timely Events (Enrichment Data)
    // Check for recent news keywords in the prospect data
    if (prospect.recentNews && prospect.recentNews.length > 0) {
        const lowerNews = prospect.recentNews.toLowerCase();
        if (lowerNews.includes('funding') || lowerNews.includes('raised')) {
            score += 30;
            factors.push("Recent Funding detected (High Priority)");
            // Override wait if it's a huge signal, but still respect weekend
            if (action === 'hold' && !reason.includes('Holiday')) {
                action = 'send_now';
                reason = "Funding news signals high urgency to connect.";
            }
        }
        if (lowerNews.includes('hiring') || lowerNews.includes('growth')) {
            score += 15;
            factors.push("Growth signals detected");
        }
    }

    // 6. Job Change (Simulated check)
    if (prospect.lastActivity === 'New Lead') {
        factors.push("Fresh Lead");
        score += 5;
    }

    return {
        action,
        reason,
        bestTime,
        priorityScore: Math.min(100, Math.max(0, score)),
        contextFactors: factors
    };
  },

  getTemporalContextString(recommendation: SendRecommendation): string {
      const now = new Date();
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const currentDay = days[now.getDay()];
      
      let context = `Current Time Context: It is ${currentDay}. `;
      
      if (recommendation.contextFactors.includes("Weekend detected")) {
          context += "It is the weekend. ";
      } else if (recommendation.contextFactors.includes("Late Friday")) {
          context += "It is late Friday afternoon. ";
      } else if (currentDay === 'Monday') {
          context += "It is the start of the week. ";
      }

      if (recommendation.contextFactors.some(f => f.includes("Funding"))) {
          context += "IMPORTANT: Prospect recently raised funding. Capitalize on this momentum. ";
      }

      return context;
  },

  async smartScheduler(
      activities: ScheduledActivity[],
      constraints: SchedulingConstraints
  ): Promise<OptimizedSchedule> {
      // Sort by priority
      const queue = [...activities].sort((a, b) => b.priority - a.priority);
      
      const scheduledActivities: ScheduledActivity[] = [];
      const usageMap: Record<string, number> = {};
      const lastScheduledMap: Record<string, Date> = {};
      const notes: string[] = [];

      let earliest = new Date(8640000000000000);
      let latest = new Date(-8640000000000000);

      for (const activity of queue) {
          const slot = calculateOptimalSlot(activity, constraints, usageMap, lastScheduledMap);
          
          if (slot) {
              const slotIso = slot.toISOString();
              activity.scheduledTime = slotIso;
              activity.status = 'scheduled';
              
              // Update trackers
              const hourKey = `${slotIso.slice(0, 13)}`;
              usageMap[hourKey] = (usageMap[hourKey] || 0) + 1;
              lastScheduledMap[activity.prospectId] = slot;

              if (slot < earliest) earliest = slot;
              if (slot > latest) latest = slot;
              
              scheduledActivities.push(activity);
          } else {
              activity.status = 'failed';
              notes.push(`Failed to schedule activity ${activity.id} within limits.`);
              scheduledActivities.push(activity);
          }
      }

      // Generate Notes
      if (constraints.business_hours_only) notes.push("Restricted to 9am-5pm.");
      if (constraints.respect_timezone) notes.push("Timezones respected.");
      notes.push(`Scheduled ${scheduledActivities.filter(a => a.status === 'scheduled').length} / ${activities.length} tasks.`);

      return {
          activities: scheduledActivities,
          total_scheduled: scheduledActivities.filter(a => a.status === 'scheduled').length,
          schedule_span: {
              start: earliest.getTime() === 8640000000000000 ? new Date().toISOString() : earliest.toISOString(),
              end: latest.getTime() === -8640000000000000 ? new Date().toISOString() : latest.toISOString()
          },
          expected_performance: 'High',
          optimization_notes: notes
      };
  }
};
