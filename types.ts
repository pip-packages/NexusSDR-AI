
export interface DeepResearchResult {
    trigger_events: {
        description: string;
        source_url: string;
        date: string;
        category: string;
    }[];
    nexus_signal: string;
    relevance_score: number;
}

export interface VisualHook {
    hook_content: string;
    visual_element: string;
    reasoning: string;
}

export interface ScreenScanResult {
    visual_analysis: {
        aesthetic_vibe: string;
        technical_sophistication: string;
        key_value_props_detected: string[];
        inferred_brand_values: string[];
    };
    visual_hooks: VisualHook[];
}

export interface VideoSignal {
    timestamp: string;
    visual_cue: string;
    quote: string;
    pain_point: string;
    sales_implication: string;
}

export interface VideoAnalysisResult {
    summary: string;
    signals: VideoSignal[];
    draft_email: {
        subject: string;
        body: string;
    };
}

export interface VoiceBlueprint {
    archetype: string; // e.g., "The Data-Driven Visionary"
    description: string;
    tone_keywords: string[];
    communication_traits: {
        formality: number; // 0-100
        data_reliance: number; // 0-100
        emotional_expressiveness: number; // 0-100
        brevity: number; // 0-100
    };
    messaging_rules: {
        do: string[];
        dont: string[];
    };
    sample_phrasing: string;
}

export interface LogicAudit {
    thought_signature_steps: string[];
    devil_advocate_critique: string;
    decision_verdict: string;
    confidence_score: number;
}

export interface RoleplayMessage {
    role: 'user' | 'model';
    content: string;
    timestamp: string;
}

export interface RoleplayFeedback {
    score: number;
    strengths: string[];
    weaknesses: string[];
    coach_tip: string;
}

export interface MicrositeResult {
    html_code: string;
    headline: string;
    personalization_summary: string;
}

export interface MirrorResult {
    persona_simulated: string;
    cynical_critique: string;
    delete_reason: string;
    rewritten_content: string;
    rewritten_subject?: string;
    survival_score: number; // 0-100 probability of not being deleted
}

// --- SIGNAL INTELLIGENCE TYPES ---
export type SignalDecision = 'ACCELERATE' | 'PAUSE' | 'PIVOT' | 'MAINTAIN';

export interface SignalAnalysisResult {
    decision: SignalDecision;
    confidence_score: number;
    reasoning: string;
    recommended_action: string;
    email_draft?: {
        subject: string;
        body: string;
    };
    strategy_adjustment?: string;
}

export enum AppView {
  DASHBOARD = 'dashboard',
  PROSPECTS = 'prospects',
  WAR_ROOM = 'war_room',
  OUTREACH = 'outreach',
  INBOX = 'inbox',
  SETTINGS = 'settings'
}

export type Channel = 'email' | 'linkedin' | 'sms' | 'call';

export interface ApiKeys {
  hunter?: string;
  apollo?: string;
  salesforce?: string;
  hubspot?: string;
  supabaseUrl?: string;
  supabaseKey?: string;
  proxycurl?: string;
  instantly?: string;
  warmbox?: string;
}

export interface CompanyInfo {
  name: string;
  description: string;
  valueProposition: string;
  keyDifferentiators: string[];
  targetIndustries: string[];
  calendarLink: string;
}

export interface SellerPersona {
  name: string;
  title: string;
  email: string;
  tone: 'professional' | 'casual' | 'friendly' | 'authoritative' | 'consultative';
  personalizationDepth: 'light' | 'moderate' | 'deep';
}

export interface BantData {
  total: number;
  breakdown: {
    budget: number;
    authority: number;
    need: number;
    timing: number;
  };
  reasoning_breakdown?: {
    budget: string;
    authority: string;
    need: string;
    timing: string;
  };
  engagement?: number;
  tier?: 'Hot' | 'Warm' | 'Nurture' | 'Low Priority' | 'Disqualified';
  reasoning?: string;
}

export interface ProspectIntelligence {
  enrichment: any;
  pain_points: string[];
  lead_score: BantData;
  recommended_approach: string;
}

export interface IcpFitAnalysis {
  icp_fit: {
    grade: 'Excellent' | 'Strong' | 'Moderate' | 'Poor';
    score: number;
    reasoning: string;
  };
  recommended_outreach_angle: {
    primary_hook: string;
  };
}

export interface PersonalizationPackResult {
  personalization_pack: {
    type: string;
    snippet: string;
    confidence: number;
    why_it_matters: string;
  }[];
  summary: {
    notes: string;
  };
}

export interface IntentProfile {
  intent_score: number;
}

export interface Prospect {
  id: string;
  name: string;
  title: string;
  company: string;
  email: string;
  linkedinUrl: string;
  industry: string;
  location: string;
  score: number;
  status: 'cold' | 'engaged' | 'booked' | 'lost';
  lastActivity: string;
  bantData?: BantData;
  intelligence?: ProspectIntelligence;
  icpAnalysis?: IcpFitAnalysis;
  websitePersonalization?: PersonalizationPackResult;
  videoAnalysis?: VideoAnalysisResult;
  voiceBlueprint?: VoiceBlueprint;
  technologies?: string[];
  funding?: string;
  recentNews?: string;
  revenueRange?: string;
  competitors?: string[];
  website?: string;
  intentProfile?: IntentProfile;
  emailStatus?: 'verified' | 'invalid' | 'risky';
  companySize?: string;
  domain?: string;
}

export interface ThreadMessage {
  role: 'sdr' | 'prospect';
  channel: Channel;
  content: string;
  timestamp: string;
  status: 'sent' | 'delivered' | 'opened' | 'clicked' | 'replied' | 'bounced' | 'failed' | 'accepted';
  type?: string;
}

export interface EscalationContext {
  prospectId: string;
  threadId: string;
  messageContent: string;
  prospectTitle: string;
  companyName: string;
  intent?: string;
  messages?: ThreadMessage[];
  sentimentScore?: number;
}

export interface HandoffContext {
    escalation_id: string;
    urgency: string;
    reason: string;
    sla: string;
    context_summary: string;
    key_intelligence: {
        pain_points: string[];
        stakeholders_identified: string[];
    };
    recommended_approach: string;
    prep_materials: Record<string, string>;
    suggested_response_draft: string;
}

export interface NextAction {
    type: string;
    channel: Channel;
    scheduled: string;
}

export interface MessageThread {
  id: string;
  prospectId: string;
  prospectName: string;
  status: 'pending' | 'replied' | 'booked' | 'escalated';
  activeChannels: Channel[];
  messages: ThreadMessage[];
  isEscalated?: boolean;
  escalationContext?: HandoffContext;
  nextAction?: NextAction;
}

export interface AgentLog {
  type: 'thought' | 'action' | 'observation' | 'answer';
  content: string;
  timestamp: string;
}

export interface Subgoal {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed';
  subgoals?: Subgoal[];
}

export interface StrategicPlan {
  goal: string;
  subgoals: Subgoal[];
}

export interface WorkflowAction {
  id: string;
  type: string;
  description: string;
  status: string;
  timestamp: string;
  metadata?: any;
}

export interface AutomationLog {
  id: string;
  triggerType: string;
  entityName: string;
  timestamp: string;
  status: string;
  actions: WorkflowAction[];
}

export interface ApprovalRequest {
  id: string;
  action: string;
  reason_for_approval: string;
  prospectName: string;
  prospectTitle: string;
  prospectCompany: string;
  proposed_message: {
    subject: string;
    body: string;
  };
  risk_level: 'low' | 'medium' | 'high';
  status: 'pending' | 'approved' | 'rejected';
  timestamp: string;
  recommended_action: string;
  alternative_suggestions: string[];
}

export interface WarmupStats {
  provider: string;
  inboxRate: number;
  spamRate: number;
  dailyVolume: number;
  warmupEmailsSent: number;
  status: 'active' | 'issues_detected';
}

export interface LearningInsight {
  targetSegment?: string;
}

export interface AgentCritique {
  score: number;
  critiques: string[];
  suggestedRevision: string;
}

export interface SensitivityCheckResult {
  requiresApproval: boolean;
  reason?: string;
}

export type AgentRole = 'RESEARCHER' | 'STRATEGIST' | 'COPYWRITER' | 'CRITIC';

export interface WarRoomMessage {
  id: string;
  agentRole: AgentRole;
  agentName: string;
  content: string;
  timestamp: string;
}

export interface StrategicAsset {
  id: string;
  type: string;
  title: string;
  content: string;
  createdBy: string;
}

export interface OutreachStrategy {
  name: string;
  confidence: number;
  reasoning: string;
  execution_plan: {
    stepNumber: number;
    action: string;
    channel: string;
    rationale: string;
  }[];
}

export interface BuyingCommittee {
    economic_buyer: any;
    champion: any;
    technical_decision_maker: any;
    end_users: any;
    blockers_or_risk_owners: any;
}

export interface GeneratedMessage {
  body: string;
  subject?: string;
  personalization_used: string[];
  framework_applied: string;
  reasoning: string;
  confidence_score: number;
}

export interface SequenceStep {
  id: string;
  type: 'START' | 'EMAIL' | 'LINKEDIN' | 'CALL' | 'WAIT' | 'BRANCH' | 'APOLLO_SEQUENCE';
  label: string;
  content?: string;
  subject?: string;
  nextId?: string;
  yesNextId?: string;
  noNextId?: string;
  delayDays?: number;
  condition?: {
      field: string;
      operator: string;
      value: any;
  };
  adaptationLogic?: string;
  apolloSequenceId?: string;
}

export interface ObjectionResponse {
    classification: {
        type: string;
        sincerity_score: number;
    };
    framework_used: string;
    reasoning: string;
    proof_points_used: string[];
    response_text: string;
}

export interface ProcessingResult {
    processingTime: number;
    classification: {
        intent: string;
        urgency: string;
    };
    crmUpdates?: string[];
    nextSteps?: string[];
    actionTaken: string;
    responseSent?: string;
}

export interface SentimentIntentAnalysis {
    sentiment_score: number;
    confidence_score: number;
    primary_intent: string;
    engagement_level: string;
    buying_signals: { signal: string }[];
    subtext_analysis: { hidden_objections: string[] };
    conversation_trajectory?: { trend: string };
    recommended_response_type: string;
}

export type HandoffType = 'meeting_prep' | 'escalation' | 'general';

export interface HandoffDocument {
    id: string;
    prospectId: string;
    type: HandoffType;
    title: string;
    createdAt: string;
    recipientRole: string;
    summary: string;
    sections: {
        title: string;
        content: string;
        priority: 'high' | 'medium' | 'low';
    }[];
}

export interface InteractionEvent {
    date: string;
    channel: string;
    direction: 'inbound' | 'outbound';
    content_summary: string;
    outcome: string;
    sentiment?: number;
    intent?: string;
    content?: string;
}

export interface ExtractedIntelligence {
    stated_pain_points: string[];
    stated_priorities: string[];
    mentioned_competitors: string[];
    budget_indicators: string[];
    timeline_indicators: string[];
    decision_makers_mentioned: string[];
    objections_raised: string[];
    questions_asked: string[];
}

export interface BehavioralProfile {
    disc_type: string;
    communication_preference: string;
    decision_style: string;
}

export interface EpisodicLesson {
    prospectId: string;
    outcome: string;
    keyLearning: string;
    timestamp: string;
}

export interface SequenceAdaptation {
    override_next_channel?: Channel;
    override_priority?: 'urgent' | 'normal';
    reason: string;
    active_until?: string;
}

export interface ProspectMemory {
    prospect_id: string;
    basic_info: any;
    enrichment_data: any;
    behavioral_profile: BehavioralProfile;
    interaction_history: InteractionEvent[];
    extracted_intelligence: ExtractedIntelligence;
    engagement_score: number;
    lead_status: string;
    next_action: string;
    topics_to_avoid: string[];
    topics_that_resonated: string[];
    episodicLessons: EpisodicLesson[];
    sequence_adaptations?: SequenceAdaptation;
}

export interface EngagementStep {
    step: number;
    target_role: string;
    objective: string;
    message_angle: string;
}

export interface BuyingCommitteeIntelligence {
    internal_dynamics: {
        likely_power_center: string;
        deal_complexity: string;
        who_influences_whom: string[];
    };
    buying_committee: BuyingCommittee;
    recommended_engagement_sequence: EngagementStep[];
}

export interface ColdEmailVariant {
    style: string;
    subject: string;
    email_body: string;
    personalization_used: string[];
    confidence_score: number;
}

export interface ColdEmailGenerationResult {
    variants: ColdEmailVariant[];
    guardrail_report: {
        tone_assessment: string;
    };
}

export interface FollowUpPlan {
    follow_up_plan: {
        intent_detected: string;
        strategy: string;
        sequence: {
            step: number;
            delay_days: number;
            subject: string;
            message_body: string;
        }[];
    };
    scheduling_logic: {
        next_touch_recommended: boolean;
        trigger_condition: string;
    };
}

export interface MeetingPrepResult {
    meeting_brief: {
        company_snapshot: {
            one_liner: string;
            what_they_do: string;
            who_they_serve: string;
        };
        likely_priorities: { priority: string; why_it_matters: string }[];
        discovery_questions: { question: string; intent: string }[];
        suggested_demo_flow: { step: number; focus: string; why_this_matters: string }[];
        success_criteria_for_this_call: string[];
        risks_and_watchouts: string[];
    };
}

export interface AccountIntelligenceResult {
    summary: {
        primary_message_for_this_account: string;
        do_not_pitch: string[];
    };
    account_intelligence: {
        best_fit_pitch_points: {
            when_to_use: string;
            confidence: number;
            pitch_point: string;
            why_it_resonates_with_persona: string;
            supporting_evidence: { document: string };
        }[];
        persona_specific_objections_and_responses: {
            objection: string;
            recommended_response: string;
        }[];
    };
}

export interface AccountContactSummary {
    id: string;
    name: string;
    title: string;
    status: string;
}

export interface ResponseClassification {
    intent: string;
    urgency: 'low' | 'medium' | 'high' | 'critical' | 'hot' | 'warm' | 'cool' | 'cold';
    action: string;
    sentiment?: number;
    confidence: number;
}

export interface CompetitorIntelligenceResult {
  competitor_intelligence: {
    detected_tools: {
      tool_name: string;
      category: string;
      confidence: number;
      where_detected: string;
    }[];
  };
  competitive_positioning: {
      positioning_strategy: string;
      why_this_positioning: string;
      recommended_talking_points: string[];
  };
  land_and_expand_strategy: {
      initial_entry_point: string;
      initial_use_case: string;
      expansion_paths: string[];
  };
}

export interface TriggerEvent {
  trigger_type: string;
  what_changed: string;
  why_it_matters: string;
  sales_relevance: string;
  urgency_level: 'Low' | 'Medium' | 'High';
  recommended_outreach_reason: string;
  best_persona_to_contact: string;
  suggested_message_angle: string;
  evidence: {
    url: string;
    delta_excerpt: string;
  };
  confidence: number;
}

export interface TriggerEventResult {
  trigger_events: TriggerEvent[];
  overall_signal_strength: 'Weak' | 'Moderate' | 'Strong';
  noise_filtered: string[];
  limitations: string[];
}

export interface CoachScorecard {
  overall_score: number;
  grade: 'Poor' | 'Fair' | 'Good' | 'Strong' | 'Excellent';
  category_scores: {
    relevance_and_personalization: number;
    clarity_and_structure: number;
    value_proposition_strength: number;
    credibility_and_proof: number;
    cta_quality: number;
    tone_and_deliverability: number;
  };
  top_strengths: string[];
  top_risks: string[];
}

export interface CoachDiagnosis {
  what_to_fix_first: string[];
  line_level_notes: {
    issue: string;
    location: string;
    snippet: string;
    recommendation: string;
  }[];
}

export interface CoachRewrite {
  purpose: string;
  subject?: string;
  body: string;
  character_count_body: number;
}

export interface CoachExperiment {
    variant?: string;
    subject?: string;
    test_name?: string;
    hook_line?: string;
    cta?: string;
    structure?: string;
    example_outline?: string;
    hypothesis: string;
}

export interface CoachExperiments {
  ab_subjects: CoachExperiment[];
  hook_tests: CoachExperiment[];
  cta_tests: CoachExperiment[];
  structure_tests: CoachExperiment[];
}

export interface CoachResult {
  scorecard: CoachScorecard;
  diagnosis: CoachDiagnosis;
  rewrites: CoachRewrite[];
  experiments: CoachExperiments;
  guardrail_report: {
    spam_risk: string;
    compliance_issues: string[];
  };
  next_best_actions: string[];
}

export type SyncDirection = 'bidirectional' | 'to_crm' | 'from_crm';
export type SyncMode = 'incremental' | 'full';

export interface SyncChange {
    id: string;
    entityType: string;
    entityId: string;
    changeType: string;
    data: any;
    timestamp: string;
    source: string;
}

export interface SyncResult {
    direction: SyncDirection;
    mode: SyncMode;
    timestamp: string;
    stats: { to_crm: number; from_crm: number; conflicts: number; errors: number };
    details: { synced_items: SyncChange[]; errors: any[] };
}

export interface OutreachAttempt {
  id: string;
  prospectId: string;
  timestamp: string;
  content: string;
  variables: any;
  prospectAttributes: any;
  outcomes: {
    opened: boolean;
    replied: boolean;
    booked: boolean;
  };
}

export interface ExperimentVariant {
    id: string;
    name: string;
    allocation: number;
    stats: {
        sent: number;
        replied: number;
    };
}

export interface Experiment {
    id: string;
    status: 'running' | 'completed';
    variants: ExperimentVariant[];
    winner?: string;
    significance?: number;
}

export interface PersonaProfile {
    segment: string;
}

export interface AccountIntelligence {
    account_id: string;
    company: string;
    contacts_engaged: AccountContactSummary[];
    account_signals: any;
    recommended_strategy: string;
    next_actions: string[];
    generated_at: string;
    buying_committee: BuyingCommitteeIntelligence;
}

export interface SendRecommendation {
    action: 'send_now' | 'schedule_later' | 'hold';
    reason: string;
    bestTime?: string;
    priorityScore: number;
    contextFactors: string[];
}

export interface ScheduledActivity {
    id: string;
    prospectId: string;
    type: string;
    status: string;
    priority: number;
    scheduledTime?: string;
    content?: string;
}

export interface SchedulingConstraints {
    start_date?: string;
    avoid_days: number[];
    business_hours_only: boolean;
    max_emails_per_hour: number;
    min_gap_minutes: number;
    respect_timezone?: boolean;
}

export interface OptimizedSchedule {
    activities: ScheduledActivity[];
    total_scheduled: number;
    schedule_span: { start: string; end: string };
    expected_performance: string;
    optimization_notes: string[];
}

export interface SequenceRecommendation {
    nextChannel: Channel;
    stepName: string;
    reasoning: string;
    adjustments: string[];
}

export type WorkflowTriggerType = string;
export type EventType = string;

export interface Event {
    type: EventType;
    entityId: string;
    entityName: string;
    timestamp: string;
    data: any;
}

export interface TriggerCondition {
    [key: string]: any;
}

export interface TriggerRule {
    name: string;
    event_type: EventType;
    conditions: TriggerCondition;
    action: string;
    parameters: any;
}

export interface TriggerResult {
    event: Event;
    actions_executed: { action: string; result: any }[];
    processing_time: number;
}

export interface ProposedAction {
    type: string;
    prospectId: string;
    prospectName: string;
    prospectTitle: string;
    prospectCompany: string;
    content: string;
    meta?: { subject?: string };
}

export interface ApprovalConfig {
    sensitiveKeywords: string[];
    restrictedRoles: string[];
}

export interface ApprovalResult {
    approved: boolean;
    autoApproved: boolean;
    requestId?: string;
    status: string;
    reason: string;
    timestamp: string;
}

export interface CampaignMetrics {
      sent: number;
      delivered: number;
      bounced: number;
      spam_complaints: number;
      opened: number;
      clicked: number;
      replied: number;
      unsubscribed: number;
      meetings_booked: number;
      
      delivery_rate: number;
      bounce_rate: number;
      spam_rate: number;
      open_rate: number;
      click_rate: number;
      reply_rate: number;
      unsubscribe_rate: number;
      conversion_rate: number;
}

export interface Alert {
    id: string;
    level: 'critical' | 'warning';
    type: string;
    value: number;
    threshold: number;
    recommended_action: string;
    timestamp: string;
}

export interface HealthScores {
      deliverability: number;
      engagement: number;
      conversion: number;
      overall: number;
}

export interface MonitoringResult {
        campaign_id: string;
        timestamp: string;
        metrics: CampaignMetrics;
        health_scores: HealthScores;
        alerts: Alert[];
        actions_taken: string[];
        recommendations: string[];
        next_check: string;
}

export interface UnifiedActivity {
    id: string;
    type: string;
    content?: string;
    timestamp: string;
    metadata?: any;
    prospectId?: string;
}

export interface LogResult {
    activityId: string;
    loggedTo: string[];
    results: Record<string, any>;
    timestamp: string;
}

export type ActivityType = string;

export interface EscalationRule {
        id: string;
        name: string;
        priority: number;
        level: 'L4_URGENT' | 'L3_HANDOFF' | 'L2_REVIEW';
        reason: string;
        sla: string;
        pause_autonomous: boolean;
        conditions: (ctx: EscalationContext) => boolean;
}

export interface EscalationDecision {
    shouldEscalate: boolean;
    level?: string;
    reason?: string;
    assignee?: string;
    escalationId?: string;
    package?: HandoffContext;
    sla?: string;
    continueAutonomous: boolean;
    actionsPaused: boolean;
}

export interface ExecutionStep {
    step: number;
    module: string;
    reason: string;
    inputs_used?: string[];
    budget: { web_fetches: number; search_queries: number };
    status: 'completed' | 'failed' | 'skipped';
    timestamp: string;
}

export interface OrchestratorRecommendation {
    send_now: boolean;
    what_to_send: string;
    why: string;
    next_touch_in_days: number;
}

export interface OrchestratorGuardrails {
    blocked: boolean;
    blocked_reason: string;
    risks: string[];
}

export interface ObjectivePlan {
    objective_plan: {
        objective: string;
        timing: {
            next_touch_delay_days: number;
        };
    };
}

export interface OrchestratorResults {
    icp: IcpFitAnalysis | null;
    personalization_pack: PersonalizationPackResult | null;
    competitor_intel: CompetitorIntelligenceResult | null;
    trigger_events: TriggerEventResult | null;
    account_intel: AccountIntelligenceResult | null;
    objective_plan: ObjectivePlan | null;
    message: ColdEmailGenerationResult | null;
    follow_up_plan: FollowUpPlan | null;
}

export interface OrchestratorResult {
    execution_plan: {
        steps: ExecutionStep[];
        stop_conditions: string[];
    };
    results: OrchestratorResults;
    final_recommendation: OrchestratorRecommendation;
    guardrails: OrchestratorGuardrails;
}

export interface ToolSelectionResult {
    tool_selection: {
        selected_steps: { tool: string; order: number }[];
        stop_conditions: { action: string; condition: string }[];
    };
    decision_rationale: {
        depth_level: string;
    };
}
