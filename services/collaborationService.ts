
import { EscalationContext, EscalationDecision, EscalationRule, Prospect, HandoffDocument, HandoffType } from '../types';
import { generateHandoffContext, generateStructuredHandoff, runMeetingPrepAgent } from './geminiService';
import { memoryService } from './memoryService';
import { INITIAL_COMPANY } from '../constants'; // Fallback

// 8.1 Default Escalation Rules
const DEFAULT_ESCALATION_RULES: EscalationRule[] = [
    // L4: Urgent - Legal/Hostile
    {
        id: 'legal_risk',
        name: 'Legal/Compliance Risk',
        priority: 100,
        level: 'L4_URGENT',
        reason: 'Legal threat or compliance inquiry detected',
        sla: '15m',
        pause_autonomous: true,
        conditions: (ctx) => {
            const lower = ctx.messageContent.toLowerCase();
            return lower.includes('lawyer') || lower.includes('sue') || lower.includes('cease and desist') || lower.includes('gdpr violation');
        }
    },
    // L4: Urgent - Hostile
    {
        id: 'hostile_response',
        name: 'Hostile Sentiment',
        priority: 95,
        level: 'L4_URGENT',
        reason: 'Hostile or abusive response detected',
        sla: '30m',
        pause_autonomous: true,
        conditions: (ctx) => {
            return (ctx.sentimentScore !== undefined && ctx.sentimentScore < -0.7);
        }
    },
    // L3: Handoff - Human Request
    {
        id: 'human_request',
        name: 'Explicit Human Request',
        priority: 90,
        level: 'L3_HANDOFF',
        reason: 'Prospect asked for a human',
        sla: '1h',
        pause_autonomous: true,
        conditions: (ctx) => {
            const lower = ctx.messageContent.toLowerCase();
            return lower.includes('speak to a human') || lower.includes('real person') || lower.includes('representative');
        }
    },
    // L3: Handoff - C-Suite Engagement
    {
        id: 'c_suite_positive',
        name: 'C-Suite Engagement',
        priority: 80,
        level: 'L3_HANDOFF',
        reason: 'C-Level Executive engaged',
        sla: '2h',
        pause_autonomous: true,
        conditions: (ctx) => {
            const title = ctx.prospectTitle.toLowerCase();
            const isCSuite = title.includes('ceo') || title.includes('cto') || title.includes('cfo') || title.includes('founder') || title.includes('vp');
            // Assume positive if not negative sentiment, or specifically meeting intent
            return isCSuite && (ctx.intent === 'positive_interest' || ctx.intent === 'meeting_request' || ctx.intent === 'question');
        }
    },
    // L2: Review - Complex Pricing
    {
        id: 'complex_pricing',
        name: 'Complex Pricing Inquiry',
        priority: 70,
        level: 'L2_REVIEW',
        reason: 'Enterprise pricing discussion',
        sla: '4h',
        pause_autonomous: true,
        conditions: (ctx) => {
            return ctx.messageContent.toLowerCase().includes('enterprise license') || ctx.messageContent.toLowerCase().includes('volume discount') || ctx.messageContent.toLowerCase().includes('procurement');
        }
    }
];

export const collaborationService = {
    
    async intelligentEscalationRouter(
        context: EscalationContext,
        prospect: Prospect,
        customRules: EscalationRule[] = []
    ): Promise<EscalationDecision> {
        
        // 1. Evaluate Rules
        const rules = [...customRules, ...DEFAULT_ESCALATION_RULES];
        const matchingRules = rules.filter(rule => rule.conditions(context));

        if (matchingRules.length === 0) {
            return {
                shouldEscalate: false,
                continueAutonomous: true,
                actionsPaused: false
            };
        }

        // 2. Prioritize Highest Severity
        const primaryRule = matchingRules.reduce((prev, current) => 
            (current.priority > prev.priority) ? current : prev
        );

        // 3. Build Escalation Package (Context + AI Analysis)
        // Retrieve memory to enrich packet
        const memory = memoryService.getMemory(context.prospectId);
        
        // Generate AI Context Packet (Summary, Strategy, Draft)
        const packageContext = await generateHandoffContext(
            prospect, 
            memory, 
            context.messages || [], // Pass history if available
            primaryRule.reason
        );

        // 4. Assignee Logic (Mock)
        let assignee = 'Unassigned';
        if (primaryRule.level === 'L4_URGENT') assignee = 'Sales Director';
        else if (primaryRule.level === 'L3_HANDOFF') assignee = 'Senior AE';
        else assignee = 'SDR Team Lead';

        // 5. Return Decision
        return {
            shouldEscalate: true,
            level: primaryRule.level,
            reason: primaryRule.reason,
            assignee,
            escalationId: `esc_${Date.now()}`,
            package: {
                ...packageContext,
                urgency: primaryRule.level === 'L4_URGENT' ? 'critical' : primaryRule.level === 'L3_HANDOFF' ? 'high' : 'medium',
                sla: primaryRule.sla
            },
            sla: primaryRule.sla,
            continueAutonomous: !primaryRule.pause_autonomous,
            actionsPaused: primaryRule.pause_autonomous
        };
    },

    async contextHandoffGenerator(
        prospect: Prospect,
        type: HandoffType,
        recipientRole: string = "Account Executive"
    ): Promise<HandoffDocument> {
        
        if (type === 'meeting_prep') {
            // Use specialized agent for meeting prep briefs
            const savedCompany = localStorage.getItem('sdr_company');
            const companyConfig = savedCompany ? JSON.parse(savedCompany) : INITIAL_COMPANY;
            
            const prepResult = await runMeetingPrepAgent(prospect, companyConfig);
            const brief = prepResult.meeting_brief;

            // Transform MeetingBrief into HandoffDocument structure
            return {
                id: `brief_${Date.now()}`,
                prospectId: prospect.id,
                type: 'meeting_prep',
                title: `Discovery Brief: ${prospect.company}`,
                createdAt: new Date().toISOString(),
                recipientRole,
                summary: brief.company_snapshot.one_liner,
                sections: [
                    {
                        title: "Company Snapshot",
                        content: `**What they do:** ${brief.company_snapshot.what_they_do}\n**Who they serve:** ${brief.company_snapshot.who_they_serve}`,
                        priority: 'high'
                    },
                    {
                        title: "Likely Priorities",
                        content: brief.likely_priorities.map(p => `• **${p.priority}**: ${p.why_it_matters}`).join('\n'),
                        priority: 'high'
                    },
                    {
                        title: "Discovery Questions",
                        content: brief.discovery_questions.map(q => `• ${q.question} _(${q.intent})_`).join('\n'),
                        priority: 'high'
                    },
                    {
                        title: "Suggested Demo Flow",
                        content: brief.suggested_demo_flow.map(s => `**Step ${s.step}:** ${s.focus} - ${s.why_this_matters}`).join('\n'),
                        priority: 'medium'
                    },
                    {
                        title: "Success Criteria",
                        content: brief.success_criteria_for_this_call.join('\n• '),
                        priority: 'medium'
                    },
                    {
                        title: "Risks & Watchouts",
                        content: brief.risks_and_watchouts.join('\n• '),
                        priority: 'low'
                    }
                ]
            };
        } else {
            // Use legacy/generic generator for other types
            const memory = memoryService.getMemory(prospect.id);
            return await generateStructuredHandoff(prospect, memory, type, recipientRole);
        }
    }
};
