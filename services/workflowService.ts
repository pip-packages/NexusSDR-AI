
import { WorkflowTriggerType, AutomationLog, WorkflowAction, Event, TriggerResult, TriggerRule, TriggerCondition, EventType, Prospect } from '../types';
import { deepProspectResearcher, enrichProspect, runSignalAnalysisAgent, generateJobChangeEmail } from './geminiService';
import { crmService } from './crmService';
import { memoryService } from './memoryService';

// Mock storage
let automationLogs: AutomationLog[] = [];
let listeners: ((logs: AutomationLog[]) => void)[] = [];

// PRE-DEFINED TRIGGER RULES
const DEFAULT_TRIGGER_RULES: TriggerRule[] = [
    {
        name: "channel_switch_on_engagement",
        event_type: "email_opened",
        // Logic: Opened 3+ times but hasn't replied yet (replied check handled in processor or simplified condition)
        conditions: { open_count: { "$gte": 3 }, replied: false },
        action: "switch_channel_linkedin",
        parameters: {
            reason: "High interest signal (opens) but no reply. Pattern interrupt required."
        }
    },
    {
        name: "high_intent_pricing_visit",
        event_type: "website_visit",
        conditions: { page: "/pricing" },
        action: "escalate_intent",
        parameters: {
            priority: "urgent",
            tag: "high_intent"
        }
    },
    {
        name: "new_lead_enrichment",
        event_type: "prospect_added",
        conditions: { source: { "$in": ["inbound", "import", "api"] } },
        action: "enrich_and_sequence",
        parameters: {
            enrichment_depth: "comprehensive",
            auto_sequence: true,
            sequence_selection: "auto"
        }
    },
    {
        name: "meeting_booked_workflow",
        event_type: "meeting_booked",
        conditions: {},
        action: "post_booking_workflow",
        parameters: {
            stop_sequence: true,
            create_deal: true,
            send_confirmation: true,
            schedule_reminders: true,
            generate_prep_doc: true
        }
    },
    {
        name: "job_change_outreach",
        event_type: "prospect_job_changed",
        conditions: { new_company_icp_fit: true },
        action: "job_change_campaign",
        parameters: {
            delay_days: 7,
            personalization: "job_change_specific"
        }
    },
    {
        name: "funding_triggered_campaign",
        event_type: "company_funding",
        conditions: { amount: { "$gte": 5000000 } },
        action: "funding_campaign",
        parameters: {
            priority: "high",
            reference_funding: true
        }
    },
    {
        name: "no_reply_escalation",
        event_type: "email_sent",
        // Logic check: Wait 3 days, check reply. If no reply, trigger Apollo sequence.
        conditions: { days_since_sent: { "$gte": 3 }, replied: false },
        action: "add_to_apollo_sequence",
        parameters: {
            apolloSequenceId: "seq_linkedin_bump_v2",
            reason: "No reply to email channel."
        }
    }
];

// Helper to evaluate conditions
function evaluateCondition(eventData: any, condition: TriggerCondition): boolean {
    if (!condition || Object.keys(condition).length === 0) return true;
    if (!eventData) return false;

    for (const key in condition) {
        const expected = condition[key];
        const actual = eventData[key];

        if (typeof expected === 'object' && expected !== null && !Array.isArray(expected)) {
            // Check for operators
            if ('$gte' in expected) {
                if (actual < expected['$gte']) return false;
            }
            if ('$gt' in expected) {
                if (actual <= expected['$gt']) return false;
            }
            if ('$lt' in expected) {
                if (actual >= expected['$lt']) return false;
            }
            if ('$in' in expected) {
                if (!Array.isArray(expected['$in']) || !expected['$in'].includes(actual)) return false;
            }
        } else {
            // Direct equality
            if (actual !== expected) return false;
        }
    }
    return true;
}

// Action Executor
async function executeTriggerAction(action: string, event: Event, params: any): Promise<{ action: string; result: any }> {
    console.log(`[EXECUTING ACTION] ${action} for ${event.entityName}`, params);
    
    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 500));

    let result: any = { status: 'completed' };
    const prospectId = event.data?.prospectId || event.entityId; // Assuming entityId might be prospectId

    switch (action) {
        case 'switch_channel_linkedin':
            if (prospectId) {
                memoryService.updateAdaptation(prospectId, {
                    override_next_channel: 'linkedin',
                    reason: params.reason || "Engagement Based Switch"
                });
                result = { status: 'sequence_branched', next_channel: 'linkedin' };
            }
            break;
        case 'escalate_intent':
            if (prospectId) {
                memoryService.updateAdaptation(prospectId, {
                    override_priority: 'urgent',
                    reason: "High Intent Signal (Pricing Page)"
                });
                // In a real app, this would also ping Slack/Teams
                result = { status: 'escalated', priority: 'urgent' };
            }
            break;
        case 'enrich_and_sequence':
            // Logic to enrich and start sequence
            result = { status: 'enrolled', enriched: true };
            break;
        case 'accelerate_sequence':
            result = { status: 'accelerated', step_skipped: true };
            break;
        case 'priority_outreach':
            // Trigger alert
            break;
        case 'post_booking_workflow':
            // CRM deal creation logic
            break;
        case 'funding_campaign':
            // Start specific sequence
            break;
        case 'add_to_apollo_sequence':
            // Simulate Apollo API Call
            console.log(`[APOLLO API] POST /v1/contacts/${prospectId}/add_to_sequence`, { sequence_id: params.apolloSequenceId });
            result = { 
                status: 'success', 
                external_system: 'Apollo', 
                action_id: `apollo_${Date.now()}`,
                message: `Successfully added to sequence: ${params.apolloSequenceId}` 
            };
            break;
        case 'job_change_campaign':
            if (event.data?.prospectName && event.data?.oldCompany && event.data?.newCompany && event.data?.newTitle) {
                try {
                    const draft = await generateJobChangeEmail(
                        event.data.prospectName,
                        event.data.oldCompany,
                        event.data.newCompany,
                        event.data.newTitle,
                        "NEXUS Inc." // Assuming static company name for demo
                    );
                    
                    result = { 
                        status: 'draft_created', 
                        draft: draft,
                        campaign_status: 'ready_to_send' 
                    };
                } catch (e) {
                    console.error("Job change draft failed", e);
                    result = { status: 'failed' };
                }
            }
            break;
        default:
            console.warn(`Unknown action: ${action}`);
            result = { status: 'unknown_action' };
    }

    return { action, result };
}

// 6.1 event_trigger_processor
async function eventTriggerProcessor(
    event: Event,
    triggerRules: TriggerRule[] | null = null
): Promise<TriggerResult> {
    const startTime = Date.now();
    
    // Use default rules if none provided
    const rules = triggerRules || DEFAULT_TRIGGER_RULES;
    
    // Filter matching rules based on event type and conditions
    const matchingRules = rules.filter(rule => {
        if (rule.event_type !== event.type) return false;
        return evaluateCondition(event.data, rule.conditions);
    });

    const actionsExecuted: { action: string; result: any }[] = [];
    const workflowActions: WorkflowAction[] = [];

    // Execute actions
    for (const rule of matchingRules) {
        const actionResult = await executeTriggerAction(rule.action, event, rule.parameters);
        actionsExecuted.push(actionResult);
        
        workflowActions.push({
            id: `act_${Date.now()}_${actionsExecuted.length}`,
            type: rule.action.toUpperCase(),
            description: `Rule '${rule.name}': ${rule.action.replace(/_/g, ' ')}`,
            status: 'completed',
            timestamp: new Date().toISOString(),
            metadata: actionResult.result // Pass rich data (like the draft)
        });
    }

    // Log to dashboard (Integrate with existing log system)
    if (matchingRules.length > 0) {
        const newLog: AutomationLog = {
            id: `wf_${Date.now()}`,
            triggerType: event.type,
            entityName: event.entityName,
            timestamp: new Date().toISOString(),
            status: 'completed',
            actions: workflowActions
        };
        
        automationLogs = [newLog, ...automationLogs].slice(0, 50);
        notifyListeners();
    }

    return {
        event,
        actions_executed: actionsExecuted,
        processing_time: Date.now() - startTime
    };
}

function notifyListeners() {
    listeners.forEach(l => l([...automationLogs]));
}

// Service Export
export const workflowService = {
  getLogs(): AutomationLog[] {
    return automationLogs;
  },

  subscribe(callback: (logs: AutomationLog[]) => void) {
    listeners.push(callback);
    return () => {
      listeners = listeners.filter(l => l !== callback);
    };
  },

  notify() {
    notifyListeners();
  },

  // Legacy Trigger (Kept for compatibility, routed to new processor)
  async trigger(triggerType: WorkflowTriggerType, entityName: string, context: any = {}) {
      const event: Event = {
          type: triggerType,
          entityId: context.prospectId || `legacy_${Date.now()}`,
          entityName,
          timestamp: new Date().toISOString(),
          data: context
      };
      
      // Auto-add necessary data fields for legacy types to match rules
      if (triggerType === 'NEW_LEAD') event.data = { source: 'inbound', ...context };
      
      await eventTriggerProcessor(event);
  },

  // New Event Entry Point
  async processEvent(event: Event) {
      return await eventTriggerProcessor(event);
  },

  // New: Autonomous Signal Processing
  async processSignalAutonomous(
      prospect: Prospect, 
      signalType: string, 
      description: string
  ): Promise<void> {
      const memory = memoryService.getMemory(prospect.id);
      const currentStrategy = memory?.next_action || 'Standard Outreach';
      
      const analysis = await runSignalAnalysisAgent(
          prospect, 
          { type: signalType, description },
          currentStrategy
      );

      // Execute side effects based on decision
      if (analysis.decision === 'ACCELERATE') {
          memoryService.updateAdaptation(prospect.id, { override_priority: 'urgent', reason: `Signal: ${signalType}` });
      } else if (analysis.decision === 'PAUSE') {
          // Logic to pause (simulated by updating status)
      }

      // Log the rich decision
      const signalAction: WorkflowAction = {
          id: `sig_${Date.now()}`,
          type: 'SIGNAL_ANALYSIS',
          description: `Decision: ${analysis.decision}`,
          status: 'completed',
          timestamp: new Date().toISOString(),
          metadata: analysis // Store rich result for UI
      };

      const newLog: AutomationLog = {
          id: `wf_${Date.now()}`,
          triggerType: 'SIGNAL_DETECTED',
          entityName: prospect.name,
          timestamp: new Date().toISOString(),
          status: 'completed',
          actions: [signalAction]
      };

      automationLogs = [newLog, ...automationLogs].slice(0, 50);
      notifyListeners();
  }
};
