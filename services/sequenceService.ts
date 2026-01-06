
import { Prospect, ProspectMemory, SequenceRecommendation, Channel } from '../types';

export const sequenceService = {
  getNextStep(prospect: Prospect, memory: ProspectMemory | null): SequenceRecommendation {
    const history = memory?.interaction_history || [];
    
    // 0. Check Dynamic Adaptations (Workflow Triggers)
    if (memory?.sequence_adaptations) {
        const adaptation = memory.sequence_adaptations;
        
        // High Intent Escalation (Pricing Page Visit)
        if (adaptation.override_priority === 'urgent') {
            return {
                nextChannel: 'email', // Or call if available
                stepName: 'Urgent Intent Follow-up',
                reasoning: `Dynamic Adaptation Triggered: ${adaptation.reason}. Escalating priority immediately.`,
                adjustments: ['Manual Review Required', 'Highly Personalized', 'Speed to Lead']
            };
        }

        // Engagement Based Branching (Opened many emails -> LinkedIn)
        if (adaptation.override_next_channel === 'linkedin') {
            return {
                nextChannel: 'linkedin',
                stepName: 'Engagement Branch: LinkedIn Switch',
                reasoning: `Dynamic Adaptation Triggered: ${adaptation.reason}. Switching channel to capture engagement.`,
                adjustments: ['Cross-channel persistence']
            };
        }
    }

    // 1. Analyze Prospect Attributes for Default Channel Strategy
    const isExecutive = ['ceo', 'cto', 'vp', 'founder', 'president'].some(role => 
        prospect.title.toLowerCase().includes(role)
    );
    const hasLinkedIn = !!prospect.linkedinUrl;
    const isEmailRisky = prospect.emailStatus === 'invalid' || prospect.emailStatus === 'risky';

    // 2. Analyze History
    const lastInteraction = history.length > 0 ? history[history.length - 1] : null;
    const emailCount = history.filter(h => h.channel === 'email' && h.direction === 'outbound').length;
    const linkedinCount = history.filter(h => h.channel === 'linkedin' && h.direction === 'outbound').length;

    // LOGIC TREE
    
    // Scenario A: Email Bounced or Risky -> Forced LinkedIn
    if (isEmailRisky && hasLinkedIn) {
        return {
            nextChannel: 'linkedin',
            stepName: 'LinkedIn Recovery',
            reasoning: 'Email channel compromised (Risky/Invalid). Shift to LinkedIn.',
            adjustments: ['Channel switch due to deliverability']
        };
    }

    // Scenario B: Executive -> Multi-Thread (LinkedIn First often better)
    if (isExecutive && linkedinCount === 0 && hasLinkedIn) {
        return {
            nextChannel: 'linkedin',
            stepName: 'Executive Soft Touch',
            reasoning: 'C-Suite prospect detected. LinkedIn connection request is less intrusive than cold email.',
            adjustments: ['Lead with LinkedIn for executive presence']
        };
    }

    // Scenario C: Email Sent, No Reply (The "Bump")
    if (lastInteraction && lastInteraction.channel === 'email' && lastInteraction.outcome !== 'replied') {
        // If 2 emails sent with no reply, switch to LinkedIn
        if (emailCount >= 2 && hasLinkedIn && linkedinCount === 0) {
            return {
                nextChannel: 'linkedin',
                stepName: 'Cross-Channel Pattern Interrupt',
                reasoning: 'No response to emails. Switching channel to pattern interrupt.',
                adjustments: ['Omnichannel escalation']
            };
        }
        // Otherwise simple bump
        return {
            nextChannel: 'email',
            stepName: 'Value Bump',
            reasoning: 'Follow up on previous email with new value add.',
            adjustments: []
        };
    }

    // Scenario D: LinkedIn Connected -> Email
    // (Simulating a scenario where we track connection acceptance)
    if (lastInteraction && lastInteraction.channel === 'linkedin' && lastInteraction.content?.includes("Connection")) {
        return {
            nextChannel: 'email',
            stepName: 'Post-Connection Context',
            reasoning: 'Leverage new LinkedIn connection to send detailed context via email.',
            adjustments: ['Capitalizing on social proof']
        };
    }

    // Default: Email 1
    return {
        nextChannel: 'email',
        stepName: 'Initial Value Drop',
        reasoning: 'Standard high-deliverability entry point.',
        adjustments: []
    };
  }
};
