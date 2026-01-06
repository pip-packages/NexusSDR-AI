
import { UnifiedActivity, LogResult, ActivityType, Prospect } from '../types';
import { memoryService } from './memoryService';
import { crmService } from './crmService';
import { workflowService } from './workflowService';

export const activityService = {
    
    // Helper to capture a snapshot of the prospect state
    async enrichActivityContext(activity: UnifiedActivity, prospect?: Prospect): Promise<UnifiedActivity> {
        if (!prospect) {
            // In a real app, fetch prospect by activity.prospectId
            // Here we assume it might be passed or we skip snapshot
            return activity;
        }

        const snapshot = {
            status: prospect.status,
            score: prospect.score,
            intent_score: prospect.intentProfile?.intent_score,
            last_action: prospect.lastActivity
        };

        return {
            ...activity,
            metadata: {
                ...activity.metadata,
                prospectSnapshot: snapshot,
                enriched: true
            }
        };
    },

    async unifiedActivityLogger(
        activity: UnifiedActivity,
        prospect: Prospect,
        destinations: string[] = ["local", "crm"]
    ): Promise<LogResult> {
        // 1. Enrich
        const enrichedActivity = await this.enrichActivityContext(activity, prospect);
        const logResults: Record<string, any> = {};

        // 2. Log Local (Memory)
        if (destinations.includes("local")) {
            // Map UnifiedActivity to InteractionEvent structure for memory service
            // This is a bridge between the new unified logger and the existing memory structure
            const channelMap: Record<string, any> = {
                'email_sent': 'email', 'email_received': 'email',
                'linkedin_message_sent': 'linkedin', 'linkedin_message_received': 'linkedin'
            };
            
            const direction = activity.type.includes('sent') ? 'outbound' : 'inbound';
            const channel = channelMap[activity.type] || 'email'; // Default fallback

            memoryService.addInteraction(prospect.id, {
                date: activity.timestamp,
                channel: channel,
                direction: direction,
                content_summary: activity.content ? activity.content.substring(0, 100) + '...' : activity.type,
                outcome: activity.metadata?.outcome || 'logged',
                content: activity.content
            });
            logResults["local"] = true;
        }

        // 3. Log CRM
        if (destinations.includes("crm")) {
            // Transform for CRM
            const crmType = activity.type.includes('email') ? 'Email' : 
                           activity.type.includes('meeting') ? 'Meeting' : 'Call';
            
            const result = await crmService.logActivity(
                prospect, 
                crmType as any, 
                activity.content || `Activity: ${activity.type}`
            );
            logResults["crm"] = result;
        }

        // 4. Check Triggers (Workflow Engine)
        // Map ActivityType to Workflow Trigger EventType
        const triggerMap: Record<string, any> = {
            'email_opened': 'email_opened',
            'email_clicked': 'link_clicked',
            'meeting_scheduled': 'meeting_booked',
            'email_received': 'email_replied' // Simplified mapping
        };

        const eventType = triggerMap[activity.type];
        if (eventType) {
            await workflowService.trigger(eventType, prospect.name, {
                prospectId: prospect.id,
                activityId: activity.id,
                ...activity.metadata
            });
        }

        return {
            activityId: activity.id,
            loggedTo: Object.keys(logResults),
            results: logResults,
            timestamp: new Date().toISOString()
        };
    }
};
