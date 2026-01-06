
import { ApprovalRequest, ProposedAction, ApprovalConfig, ApprovalResult } from '../types';
import { evaluateActionSensitivity } from './geminiService';

const STORAGE_KEY_APPROVALS = 'sdr_approval_requests';

let listeners: ((requests: ApprovalRequest[]) => void)[] = [];

const DEFAULT_CONFIG: ApprovalConfig = {
    sensitiveKeywords: ['contract', 'discount', 'free', 'guarantee', 'legal', 'lawyer', 'sue'],
    restrictedRoles: ['ceo', 'cfo', 'president', 'founder'],
};

export const approvalService = {
    getRequests(): ApprovalRequest[] {
        try {
            const saved = localStorage.getItem(STORAGE_KEY_APPROVALS);
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    },

    saveRequests(requests: ApprovalRequest[]) {
        localStorage.setItem(STORAGE_KEY_APPROVALS, JSON.stringify(requests));
        this.notify(requests);
    },

    getPendingRequests(): ApprovalRequest[] {
        return this.getRequests().filter(r => r.status === 'pending');
    },

    addRequest(request: ApprovalRequest) {
        const requests = this.getRequests();
        const updatedRequests = [request, ...requests];
        this.saveRequests(updatedRequests);
    },

    updateStatus(id: string, status: 'approved' | 'rejected') {
        const requests = this.getRequests();
        const updatedRequests = requests.map(req => 
            req.id === id ? { ...req, status } : req
        );
        this.saveRequests(updatedRequests);
    },

    subscribe(callback: (requests: ApprovalRequest[]) => void) {
        listeners.push(callback);
        callback(this.getRequests());
        return () => {
            listeners = listeners.filter(l => l !== callback);
        };
    },

    notify(requests: ApprovalRequest[]) {
        listeners.forEach(l => l(requests));
    },

    async approvalWorkflowManager(
        action: ProposedAction,
        config: ApprovalConfig = DEFAULT_CONFIG
    ): Promise<ApprovalResult> {
        // 1. Deterministic Checks
        const lowerContent = action.content.toLowerCase();
        const sensitiveMatch = config.sensitiveKeywords.find(kw => lowerContent.includes(kw));
        
        const lowerTitle = action.prospectTitle.toLowerCase();
        const roleMatch = config.restrictedRoles.find(role => lowerTitle.includes(role));

        let requiresApproval = false;
        let reason = "";

        if (sensitiveMatch) {
            requiresApproval = true;
            reason = `Sensitive keyword detected: "${sensitiveMatch}"`;
        } else if (roleMatch) {
            requiresApproval = true;
            reason = `Restricted role outreach: "${roleMatch}"`;
        }

        // 2. AI Safety Check (if not already flagged)
        if (!requiresApproval) {
            // Mock prospect object for the AI call
            const mockProspect = { 
                id: action.prospectId, 
                name: action.prospectName, 
                title: action.prospectTitle, 
                company: action.prospectCompany 
            } as any;
            
            try {
                 const aiCheck = await evaluateActionSensitivity(mockProspect, action.content, action.type);
                 if (aiCheck.requiresApproval) {
                     requiresApproval = true;
                     reason = aiCheck.reason || "AI Risk Assessment Flag";
                 }
            } catch (e) {
                console.warn("AI Check failed, proceeding with default safety", e);
            }
        }

        if (!requiresApproval) {
            return {
                approved: true,
                autoApproved: true,
                status: 'approved',
                reason: "Safe for autonomous execution",
                timestamp: new Date().toISOString()
            };
        }

        // 3. Create Request
        const requestId = `apr_${Date.now()}`;
        const newRequest: ApprovalRequest = {
            id: requestId,
            action: action.type,
            reason_for_approval: reason,
            prospectName: action.prospectName,
            prospectTitle: action.prospectTitle,
            prospectCompany: action.prospectCompany,
            proposed_message: {
                subject: action.meta?.subject || 'Pending Review',
                body: action.content
            },
            risk_level: sensitiveMatch ? 'high' : 'medium',
            status: 'pending',
            timestamp: new Date().toISOString(),
            recommended_action: 'review',
            alternative_suggestions: []
        };

        this.addRequest(newRequest);

        return {
            approved: false,
            autoApproved: false,
            requestId: requestId,
            status: 'pending',
            reason: reason,
            timestamp: new Date().toISOString()
        };
    }
};
