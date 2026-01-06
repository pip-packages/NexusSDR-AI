
import { Prospect, ApiKeys, SyncResult, SyncDirection, SyncMode, SyncChange } from '../types';
import { workflowService } from './workflowService';

const getKeys = (): ApiKeys => {
  try {
    const saved = localStorage.getItem('sdr_api_keys');
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
};

const simulateLatency = () => new Promise(resolve => setTimeout(resolve, 800));

export const crmService = {
  async syncContact(prospect: Prospect) {
    const keys = getKeys();
    const activeCRMs = [];
    if (keys.hubspot) activeCRMs.push('HubSpot');
    if (keys.salesforce) activeCRMs.push('Salesforce');

    if (activeCRMs.length === 0) return { synced: false, message: 'No CRM connected' };

    await simulateLatency();
    // Simulate API Payload
    console.log(`[CRM SYNC] Creating/Updating Contact:`, {
        email: prospect.email,
        firstname: prospect.name.split(' ')[0],
        lastname: prospect.name.split(' ').slice(1).join(' '),
        company: prospect.company,
        jobtitle: prospect.title,
        lifecycle_stage: prospect.status
    });
    
    return { synced: true, message: `Synced to ${activeCRMs.join(' & ')}` };
  },

  async logActivity(prospect: Prospect, type: 'Email' | 'Call' | 'Meeting', content: string) {
    const keys = getKeys();
    if (!keys.hubspot && !keys.salesforce) return;

    await simulateLatency();
    console.log(`[CRM LOG] Activity Type: ${type} | Prospect: ${prospect.name}`);
    console.log(`[CRM LOG] Content Preview: "${content.substring(0, 50)}..."`);
    return { success: true };
  },

  async createDeal(prospect: Prospect) {
    const keys = getKeys();
    if (!keys.hubspot && !keys.salesforce) return { success: false, message: 'No CRM connected' };

    await simulateLatency();
    const dealName = `${prospect.company} - New Opportunity`;
    const amount = 15000; // Mock amount
    
    console.log(`[CRM DEAL] Created Deal: "${dealName}"`);
    console.log(`[CRM DEAL] Amount: $${amount} | Stage: Meeting Booked`);
    
    return { success: true, dealName };
  },

  async bidirectionalCrmSync(
    direction: SyncDirection = "bidirectional",
    entityTypes: string[] = ["contacts", "companies", "deals"],
    syncMode: SyncMode = "incremental"
  ): Promise<SyncResult> {
    const keys = getKeys();
    // Allow sync if keys exist, otherwise error
    if (!keys.hubspot && !keys.salesforce) {
         // Return empty result with error note if no keys, rather than throwing hard crash in UI
         return {
             direction,
             mode: syncMode,
             timestamp: new Date().toISOString(),
             stats: { to_crm: 0, from_crm: 0, conflicts: 0, errors: 1 },
             details: { synced_items: [], errors: [{ id: 'auth', error: 'No CRM Connected' }] }
         };
    }

    await simulateLatency();
    const result: SyncResult = {
        direction,
        mode: syncMode,
        timestamp: new Date().toISOString(),
        stats: { to_crm: 0, from_crm: 0, conflicts: 0, errors: 0 },
        details: { synced_items: [], errors: [] }
    };

    // Simulate TO CRM
    if (direction !== 'from_crm') {
        // Just say we synced the last few activities
        const count = Math.floor(Math.random() * 3) + 1; 
        result.stats.to_crm = count;
        for(let i=0; i<count; i++) {
            result.details.synced_items.push({
                id: `loc_${Date.now()}_${i}`,
                entityType: 'activity',
                entityId: `act_${i}`,
                changeType: 'create',
                data: { note: 'Logged email interaction' },
                timestamp: new Date().toISOString(),
                source: 'local'
            });
        }
    }

    // Simulate FROM CRM
    if (direction !== 'to_crm') {
        // 30% chance of inbound lead
        if (Math.random() > 0.7) {
            result.stats.from_crm++;
            const newLeadName = "Alex Remote";
            result.details.synced_items.push({
                id: `rem_${Date.now()}`,
                entityType: 'contact',
                entityId: `lead_${Date.now()}`,
                changeType: 'create',
                data: { name: newLeadName, company: "Remote Corp" },
                timestamp: new Date().toISOString(),
                source: 'remote'
            });
            // Trigger workflow
            workflowService.trigger('NEW_LEAD', newLeadName, { source: 'crm_sync_inbound' });
        }
    }

    return result;
  }
};
