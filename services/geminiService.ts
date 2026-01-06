
import { GoogleGenAI, Type } from "@google/genai";
import { 
    Prospect, CompanyInfo, SellerPersona, CompetitorIntelligenceResult, 
    StrategicPlan, AgentLog, BantData, IcpFitAnalysis, GeneratedMessage, 
    OutreachStrategy, ColdEmailGenerationResult, PersonalizationPackResult, 
    CoachResult, DeepResearchResult, MirrorResult, ScreenScanResult, 
    MicrositeResult, VideoAnalysisResult, LogicAudit, RoleplayMessage, 
    RoleplayFeedback, VoiceBlueprint, ObjectionResponse, ProspectMemory, 
    ResponseClassification, ProcessingResult, SentimentIntentAnalysis, 
    FollowUpPlan, SequenceStep, AccountIntelligence, BuyingCommitteeIntelligence, 
    EscalationContext, HandoffContext, HandoffDocument, ToolSelectionResult, 
    TriggerEventResult, ObjectivePlan, AccountContactSummary,
    AccountIntelligenceResult, MeetingPrepResult, ThreadMessage, SignalAnalysisResult
} from '../types';

// Helper to get AI instance
const getAI = () => {
    // API Key must be available in process.env.API_KEY
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
}

// Helper for JSON parsing
export const safeJsonParse = (text: string | undefined): any => {
    if (!text) return null;
    try {
        // Remove markdown code blocks if present
        const cleanText = text.replace(/```json\n|\n```/g, "").replace(/```/g, "").trim();
        return JSON.parse(cleanText);
    } catch (e) {
        console.warn("JSON Parse Failed", e);
        return null;
    }
}

export async function generateJobChangeEmail(
    prospectName: string,
    oldCompany: string,
    newCompany: string,
    newTitle: string,
    myCompany: string
): Promise<{ subject: string; body: string }> {
    const ai = getAI();
    const prompt = `
    Write a "Job Change" re-engagement email for ${prospectName}.
    
    Context:
    - They were a champion at ${oldCompany}.
    - They just moved to ${newCompany} as ${newTitle}.
    - My Company: ${myCompany}.
    
    Strategy:
    - Tone: Warm, celebratory, but professional.
    - Hook: Congratulate on the specific move.
    - Bridge: Mention "seeing what you accomplished at ${oldCompany}" implies success at the new role.
    - Ask: Low friction "let's reconnect" or "is this relevant to your new stack?".
    
    Return JSON: { "subject": "string", "body": "string" }
    `;

    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    return safeJsonParse(response.text);
}

export async function runSignalAnalysisAgent(
    prospect: Prospect,
    signal: { type: string, description: string },
    currentContext: string
): Promise<SignalAnalysisResult> {
    const ai = getAI();
    const prompt = `
    You are an Autonomous Signal Analyst. Analyze this live market signal for prospect ${prospect.name} at ${prospect.company}.
    
    SIGNAL DETECTED:
    Type: ${signal.type}
    Description: ${signal.description}
    
    CURRENT CONTEXT:
    ${currentContext}

    DECISION LOGIC:
    - ACCELERATE: Positive momentum detected (Funding, Promotion, Hiring). Skip wait steps, engage immediately.
    - PAUSE: Risk detected (Layoffs, Legal Issue, PR Scandal). Halt outreach to avoid insensitivity.
    - PIVOT: Context shift (Acquisition, Strategy Change). Abandon current pitch, switch to consultative/advisory approach.
    - MAINTAIN: Signal is low relevance or neutral. Continue existing sequence.

    Return JSON:
    {
        "decision": "ACCELERATE" | "PAUSE" | "PIVOT" | "MAINTAIN",
        "confidence_score": number (0-100),
        "reasoning": "Clear explanation of why this decision was made based on sales psychology.",
        "recommended_action": "Specific next step description",
        "email_draft": { "subject": "string", "body": "string" } (Optional: Provide only if decision is ACCELERATE or PIVOT),
        "strategy_adjustment": "string" (Optional: Provide only if decision is PIVOT)
    }
    `;

    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: prompt,
        config: { 
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 1024 } // Use thinking for strategic decision making
        }
    });
    
    return safeJsonParse(response.text);
}

export async function runCompetitorIntelligenceAgent(
    prospect: Prospect,
    companyConfig: CompanyInfo
): Promise<CompetitorIntelligenceResult> {
    const ai = getAI();
    const prompt = `
    Analyze competitors for ${prospect.company}.
    
    Return JSON: { competitor_intelligence: { detected_tools: [{ tool_name, category, confidence, where_detected }] }, competitive_positioning: { positioning_strategy, why_this_positioning, recommended_talking_points }, land_and_expand_strategy: { initial_entry_point, initial_use_case, expansion_paths } }
    `;
    
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt,
            config: { 
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json" 
            }
        });
        
        const parsed = safeJsonParse(response.text);
        
        return {
            competitor_intelligence: {
                detected_tools: Array.isArray(parsed?.competitor_intelligence?.detected_tools) 
                    ? parsed.competitor_intelligence.detected_tools 
                    : []
            },
            competitive_positioning: {
                positioning_strategy: parsed?.competitive_positioning?.positioning_strategy || "Unknown",
                why_this_positioning: parsed?.competitive_positioning?.why_this_positioning || "Analysis unavailable",
                recommended_talking_points: Array.isArray(parsed?.competitive_positioning?.recommended_talking_points)
                    ? parsed.competitive_positioning.recommended_talking_points
                    : []
            },
            land_and_expand_strategy: {
                initial_entry_point: parsed?.land_and_expand_strategy?.initial_entry_point || "Unknown",
                initial_use_case: parsed?.land_and_expand_strategy?.initial_use_case || "Unknown",
                expansion_paths: Array.isArray(parsed?.land_and_expand_strategy?.expansion_paths)
                    ? parsed.land_and_expand_strategy.expansion_paths
                    : []
            }
        };
    } catch (e) {
        console.error("Competitor Intelligence failed", e);
        return {
            competitor_intelligence: { detected_tools: [] },
            competitive_positioning: {
                positioning_strategy: "Error",
                why_this_positioning: "Could not generate intelligence.",
                recommended_talking_points: []
            },
            land_and_expand_strategy: {
                initial_entry_point: "Error",
                initial_use_case: "Error",
                expansion_paths: []
            }
        };
    }
}

export async function generateStrategicPlan(goal: string): Promise<StrategicPlan> {
    const ai = getAI();
    const prompt = `Create a strategic execution plan for the following sales goal: "${goal}". Break it down into subgoals. Return JSON with structure { goal: string, subgoals: [{ id: string, title: string, status: 'pending' | 'in_progress' | 'completed', subgoals: [] }] }`;
    
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    return safeJsonParse(response.text);
}

export async function runAutonomousAgent(goal: string, logCallback: (log: AgentLog) => void): Promise<string> {
    const ai = getAI();
    logCallback({ type: 'thought', content: `Analyzing request: ${goal}`, timestamp: new Date().toISOString() });
    
    // Simulating agent steps for demo purposes, in a real autonomous loop this would be iterative
    logCallback({ type: 'action', content: 'Formulating research strategy...', timestamp: new Date().toISOString() });
    
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Provide a brief strategic summary for achieving: ${goal}`,
    });
    
    const result = response.text || "Strategy generated.";
    logCallback({ type: 'answer', content: result, timestamp: new Date().toISOString() });
    
    return result;
}

export async function calculateLeadScore(prospect: Prospect): Promise<BantData> {
    const ai = getAI();
    const prompt = `
    Act as 'The Gatekeeper'. Score this lead (0-100) based on BANT (Budget, Authority, Need, Timing).
    
    Prospect Data: ${JSON.stringify(prospect)}
    
    GATEKEEPER RULES:
    - If Company Size < 10 employees, Score MUST be < 30 and Tier 'Disqualified' (unless recent funding > $2M).
    - If Revenue < $1M (and no funding data), Score < 40 and Tier 'Low Priority'.
    - High Growth/Funding > $5M = High 'Budget' score.
    - C-Level Title = High 'Authority' score.
    - Matches Industry/Tech = High 'Need'.
    
    Return JSON: { 
        total: number, 
        breakdown: { budget: number, authority: number, need: number, timing: number }, 
        reasoning_breakdown: { budget: string, authority: string, need: string, timing: string }, 
        tier: 'Hot' | 'Warm' | 'Nurture' | 'Low Priority' | 'Disqualified', 
        reasoning: string 
    }`;
    
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    return safeJsonParse(response.text);
}

export async function enrichProspect(name: string, company: string, linkedinUrl?: string): Promise<any> {
    const ai = getAI();
    const prompt = `
    Perform deep sales intelligence research on ${name} working at ${company}.
    LinkedIn Context: ${linkedinUrl || 'Not provided'}.

    Use Google Search to find:
    1. **Accurate Details**: Correct job title, industry, and HQ location.
    2. **Firmographics**: Employee count, revenue range, and latest funding round.
    3. **Tech Stack**: Identify technologies used by the company (e.g. AWS, Hubspot, Salesforce).
    4. **News & Signals**: Recent news, press releases, or strategic shifts in the last 6 months.
    5. **Competitors**: Top 3 direct competitors.
    6. **Pain Points**: Infer 3 likely pain points for this role in this specific industry.

    Return JSON:
    {
        "title": "string",
        "industry": "string",
        "location": "string",
        "revenueRange": "string",
        "companySize": "string",
        "funding": "string",
        "website": "string",
        "competitors": ["string"],
        "technologies": ["string"],
        "recentNews": "string",
        "painPoints": ["string"],
        "email": "string (best guess pattern or null)"
    }
    `;
    
    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: prompt,
        config: { 
            tools: [{ googleSearch: {} }],
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 2048 }
        }
    });
    return safeJsonParse(response.text);
}

export async function runIcpFitScoring(prospect: Prospect, company: CompanyInfo): Promise<IcpFitAnalysis> {
    const ai = getAI();
    const prompt = `Analyze ICP fit for ${prospect.company} against our value prop: ${company.valueProposition}. Return JSON: { icp_fit: { grade: 'Excellent'|'Strong'|'Moderate'|'Poor', score: number, reasoning: string }, recommended_outreach_angle: { primary_hook: string } }`;
    
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    return safeJsonParse(response.text);
}

export async function contextualMessageGenerator(
    prospect: Prospect,
    context: string,
    senderProfile: any,
    history: any[],
    overrideTone?: string,
    strategy?: OutreachStrategy
): Promise<GeneratedMessage> {
    const ai = getAI();
    const prompt = `Generate a ${overrideTone || 'professional'} outreach message for ${prospect.name} at ${prospect.company}. Context: ${context}. Strategy: ${strategy?.name || 'Standard'}. Return JSON: { body: string, subject: string, personalization_used: string[], framework_applied: string, reasoning: string, confidence_score: number }`;
    
    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    return safeJsonParse(response.text);
}

export async function dynamicStrategySelector(prospect: Prospect, researchContext: string): Promise<OutreachStrategy> {
    const ai = getAI();
    const prompt = `Select best outreach strategy for ${prospect.name} based on research: ${researchContext}. Return JSON: { name: string, confidence: number, reasoning: string, execution_plan: [{ stepNumber: number, action: string, channel: string, rationale: string }] }`;
    
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    return safeJsonParse(response.text);
}

export async function runColdEmailAgent(
    prospect: Prospect, 
    company: CompanyInfo, 
    persona: SellerPersona,
    thoughtSignature?: string
): Promise<ColdEmailGenerationResult> {
    const ai = getAI();
    let instruction = `Generate 3 cold email variants for ${prospect.name} at ${prospect.company}.`;
    
    if (thoughtSignature) {
        instruction += `\n\nCRITICAL INSTRUCTION: Adhere strictly to the following Logic Chain of Thought Signature:\n"${thoughtSignature}"\n\nEnsure all variants align with the reasoning established in this signature.`;
    }

    const prompt = `
    ${instruction}
    
    Seller Persona: ${persona.name}, ${persona.title}. Tone: ${persona.tone}.
    Value Prop: ${company.valueProposition}.
    
    Return JSON: { variants: [{ style: string, subject: string, email_body: string, personalization_used: string[], confidence_score: number }], guardrail_report: { tone_assessment: string } }
    `;
    
    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: prompt,
        config: { 
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 2048 }
        }
    });
    return safeJsonParse(response.text);
}

export async function runWebsitePersonalizationAgent(prospect: Prospect, company: CompanyInfo): Promise<PersonalizationPackResult> {
    const ai = getAI();
    const prompt = `Find personalization hooks from ${prospect.company}'s website. Return JSON: { personalization_pack: [{ type: string, snippet: string, confidence: number, why_it_matters: string }], summary: { notes: string } }`;
    
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { 
            tools: [{ googleSearch: {} }],
            responseMimeType: "application/json" 
        }
    });
    return safeJsonParse(response.text);
}

export async function runSDRCoachAgent(message: any, prospect: Prospect, company: CompanyInfo, persona: SellerPersona): Promise<CoachResult> {
    const ai = getAI();
    const prompt = `Critique this message: "${message.body}". Return JSON: { scorecard: { overall_score: number, grade: string, category_scores: any, top_strengths: string[], top_risks: string[] }, diagnosis: { what_to_fix_first: string[], line_level_notes: any[] }, rewrites: any[], experiments: any, guardrail_report: any, next_best_actions: string[] }`;
    
    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    return safeJsonParse(response.text);
}

export async function runDeepResearchAgent(prospect: Prospect, company: CompanyInfo): Promise<DeepResearchResult> {
    const ai = getAI();
    const prompt = `Deep research on ${prospect.company} and ${prospect.name}. Look for triggers. Return JSON: { trigger_events: [{ description, source_url, date, category }], nexus_signal: string, relevance_score: number }`;
    
    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: prompt,
        config: { 
            tools: [{ googleSearch: {} }],
            responseMimeType: "application/json" 
        }
    });
    return safeJsonParse(response.text);
}

export async function runMirrorCheckAgent(message: { subject: string, body: string }, prospect: Prospect): Promise<MirrorResult> {
    const ai = getAI();
    const prompt = `Simulate being ${prospect.name}. Critique this email: Subject: ${message.subject}, Body: ${message.body}. Return JSON: { persona_simulated: string, cynical_critique: string, delete_reason: string, rewritten_content: string, rewritten_subject: string, survival_score: number }`;
    
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    return safeJsonParse(response.text);
}

export async function runScreenScanAgent(prospect: Prospect, base64Image: string, mimeType: string): Promise<ScreenScanResult> {
    const ai = getAI();
    const prompt = `
    Analyze this screenshot of ${prospect.company}'s website.
    "See" the design style and layout to determine the company's "vibe" and technical sophistication.
    
    Identify 3 highly specific visual details to use as "proof of research" hooks.
    Examples: "I noticed the modern dark mode aesthetic...", "Saw the API documentation link in the header implies a dev-first focus..."
    
    Return JSON: { 
        visual_analysis: { 
            aesthetic_vibe: string, 
            technical_sophistication: string, // e.g., "High - Modern Tech Stack", "Legacy/Traditional"
            key_value_props_detected: string[], 
            inferred_brand_values: string[] 
        }, 
        visual_hooks: [
            { hook_content: string, visual_element: string, reasoning: string }
        ] 
    }`;
    
    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: {
            parts: [
                { inlineData: { data: base64Image, mimeType: mimeType } },
                { text: prompt }
            ]
        },
        config: { responseMimeType: "application/json" }
    });
    return safeJsonParse(response.text);
}

export async function runMicrositeGeneratorAgent(prospect: Prospect, company: CompanyInfo): Promise<MicrositeResult> {
    const ai = getAI();
    const prompt = `Generate a personalized microsite HTML for ${prospect.name}. Return JSON: { html_code: string, headline: string, personalization_summary: string }`;
    
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    return safeJsonParse(response.text);
}

export async function runVideoSignalAnalysis(prospect: Prospect, base64Video: string, mimeType: string): Promise<VideoAnalysisResult> {
    const ai = getAI();
    const prompt = `
    Analyze this recording (interview, webinar, or demo) of ${prospect.name}.
    Identify key quotes, timestamps, and specific "pain points" mentioned by the speaker.
    
    Focus on:
    1. Strategic priorities mentioned.
    2. Frustrations with current processes (pain points).
    3. "Aha!" moments or enthusiastic quotes.
    
    Return JSON: { 
        summary: string, 
        signals: [{ timestamp, quote, visual_cue, pain_point, sales_implication }], 
        draft_email: { subject, body } 
    }`;
    
    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: {
             parts: [
                 { inlineData: { data: base64Video, mimeType: mimeType } },
                 { text: prompt }
             ]
        },
        config: { responseMimeType: "application/json" }
    });
    return safeJsonParse(response.text);
}

export async function auditDecision(context: string, decision: string): Promise<LogicAudit> {
    const ai = getAI();
    const prompt = `Audit this decision: "${decision}" based on context: "${context}". Return JSON: { thought_signature_steps: string[], devil_advocate_critique: string, decision_verdict: string, confidence_score: number }`;
    
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    return safeJsonParse(response.text);
}

export async function interactWithRoleplayAgent(history: RoleplayMessage[], prospect: Prospect, company: CompanyInfo, lastInput: string): Promise<string> {
    const ai = getAI();
    const chat = ai.chats.create({
        model: "gemini-3-pro-preview",
        config: { systemInstruction: `Roleplay as ${prospect.name}, ${prospect.title} at ${prospect.company}. Be skeptical but open to value. Keep responses short.` }
    });
    
    // Replay history
    for (const msg of history.slice(0, -1)) { // Exclude last which is input
        await chat.sendMessage({ message: msg.content });
    }
    
    const response = await chat.sendMessage({ message: lastInput });
    return response.text || "...";
}

export async function generateRoleplayFeedback(history: RoleplayMessage[]): Promise<RoleplayFeedback> {
    const ai = getAI();
    const prompt = `Evaluate this sales roleplay history. Return JSON: { score: number, strengths: string[], weaknesses: string[], coach_tip: string }`;
    
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
            parts: [{ text: JSON.stringify(history) }, { text: prompt }]
        },
        config: { responseMimeType: "application/json" }
    });
    return safeJsonParse(response.text);
}

export async function runPersonaBuilderAgent(prospectName: string, files: { data: string, mimeType: string }[]): Promise<VoiceBlueprint> {
    const ai = getAI();
    const parts: any[] = files.map(f => ({ inlineData: { data: f.data, mimeType: f.mimeType } }));
    parts.push({ text: `Analyze these documents to build a voice persona for ${prospectName}. Return JSON: { archetype, description, tone_keywords, communication_traits: { formality, data_reliance, emotional_expressiveness, brevity }, messaging_rules: { do: [], dont: [] }, sample_phrasing }` });
    
    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: { parts },
        config: { responseMimeType: "application/json" }
    });
    return safeJsonParse(response.text);
}

export const handleObjection = async (
    objection: string,
    prospect: Prospect,
    history: any[]
): Promise<ObjectionResponse> => {
    return objectionHandlerEngine(objection, prospect, history, {});
};

export async function analyzeInteraction(content: string, memory: ProspectMemory): Promise<any> {
    const ai = getAI();
    const prompt = `Analyze this interaction: "${content}". Memory: ${JSON.stringify(memory)}. Return JSON: { intelligenceUpdates: any, behaviorUpdates: any, sentiment: number, intent: string }`;
    
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    return safeJsonParse(response.text);
}

export async function classifyResponse(message: string, context: any): Promise<ResponseClassification> {
    const ai = getAI();
    const prompt = `Classify this response: "${message}". Context: ${JSON.stringify(context)}. Return JSON: { intent: string, urgency: 'low'|'medium'|'high'|'critical', action: string, sentiment: number, confidence: number }`;
    
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    return safeJsonParse(response.text);
}

export async function generateAutoResponse(classification: ResponseClassification, company: CompanyInfo, prospectName: string): Promise<string> {
    const ai = getAI();
    const prompt = `Generate a response for intent ${classification.intent}. Prospect: ${prospectName}. My Company: ${company.name}.`;
    const response = await ai.models.generateContent({ model: "gemini-3-flash-preview", contents: prompt });
    return response.text || "";
}

export async function objectionHandlerEngine(objection: string, prospect: Prospect, history: any[], senderProfile: any): Promise<ObjectionResponse> {
    const ai = getAI();
    const prompt = `Handle objection: "${objection}". Return JSON: { classification: { type: string, sincerity_score: number }, framework_used: string, reasoning: string, proof_points_used: string[], response_text: string }`;
    
    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    return safeJsonParse(response.text);
}

export async function intelligentResponseProcessor(message: any, prospect: Prospect, history: any[], senderProfile: any): Promise<ProcessingResult> {
    const ai = getAI();
    const prompt = `Process incoming message from ${prospect.name}: "${message.content}". Decide next actions. Return JSON: { processingTime: number, classification: { intent, urgency }, crmUpdates: string[], nextSteps: string[], actionTaken: string, responseSent: string }`;
    
    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    return safeJsonParse(response.text);
}

export async function sentimentAndIntentAnalyzer(message: string, history: any[], prospect: Prospect): Promise<SentimentIntentAnalysis> {
    const ai = getAI();
    const prompt = `Analyze sentiment/intent for: "${message}". Return JSON: { sentiment_score: number, confidence_score: number, primary_intent: string, engagement_level: string, buying_signals: [{ signal }], subtext_analysis: { hidden_objections: [] }, conversation_trajectory: { trend }, recommended_response_type: string }`;
    
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    return safeJsonParse(response.text);
}

export async function runFollowUpAgent(prospect: Prospect, lastMsg: any, company: CompanyInfo, history: any[]): Promise<FollowUpPlan> {
    const ai = getAI();
    const prompt = `Plan follow-up for ${prospect.name}. Last msg: "${lastMsg.content}". Return JSON: { follow_up_plan: { intent_detected: string, strategy: string, sequence: [{ step: number, delay_days: number, subject: string, message_body: string }] }, scheduling_logic: { next_touch_recommended: boolean, trigger_condition: string } }`;
    
    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    return safeJsonParse(response.text);
}

export async function adaptiveSequenceGenerator(
    audience: string, 
    goal: string, 
    persona: SellerPersona
): Promise<{ steps: SequenceStep[], thoughtSignature: string }> {
    const ai = getAI();
    const prompt = `
    Act as a Master Sales Strategist.
    Generate a sales sequence for target audience: "${audience}" to achieve goal: "${goal}".
    
    Thought Signature Requirement:
    Before generating the steps, engage in a Deep Reasoning Process to determine the optimal strategy. 
    Summarize this strategic reasoning into a "thought_signature" string (max 500 chars). 
    This signature will be used to enforce consistency in future downstream tasks.
    
    Return JSON: 
    { 
        "thought_signature": "string",
        "steps": [ ...array of SequenceStep objects... ]
    }
    
    SequenceStep Schema: { id, type, label, content, subject, delayDays, nextId }
    `;
    
    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: prompt,
        config: { 
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 2048 } // High Thinking Level for strategic logic building
        }
    });
    return safeJsonParse(response.text);
}

export async function generateAccountStrategy(accountName: string, contacts: any[], signals: any): Promise<{ strategy: string, nextActions: string[] }> {
    const ai = getAI();
    const prompt = `Generate strategy for account ${accountName}. Return JSON: { strategy: string, nextActions: string[] }`;
    
    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    return safeJsonParse(response.text);
}

export async function mapBuyingCommittee(accountName: string, prospects: Prospect[], signals: any): Promise<BuyingCommitteeIntelligence> {
    const ai = getAI();
    const prompt = `Map buying committee for ${accountName}. Return JSON: { internal_dynamics: { likely_power_center, deal_complexity, who_influences_whom }, buying_committee: { economic_buyer, champion, technical_decision_maker, end_users, blockers_or_risk_owners }, recommended_engagement_sequence: [] }`;
    
    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    
    const parsed = safeJsonParse(response.text);
    
    // Sanitize response
    return {
        internal_dynamics: {
            likely_power_center: parsed?.internal_dynamics?.likely_power_center || "Unknown",
            deal_complexity: parsed?.internal_dynamics?.deal_complexity || "Unknown",
            who_influences_whom: Array.isArray(parsed?.internal_dynamics?.who_influences_whom) ? parsed.internal_dynamics.who_influences_whom : []
        },
        buying_committee: parsed?.buying_committee || {},
        recommended_engagement_sequence: Array.isArray(parsed?.recommended_engagement_sequence) ? parsed.recommended_engagement_sequence : []
    };
}

export async function deepProspectResearcher(prospect: Prospect): Promise<any> {
    return enrichProspect(prospect.name, prospect.company, prospect.linkedinUrl);
}

export async function evaluateActionSensitivity(prospect: any, content: string, type: string): Promise<{ requiresApproval: boolean, reason?: string }> {
    const ai = getAI();
    const prompt = `Evaluate sensitivity of this action: ${type} to ${prospect.name}. Content: "${content}". Return JSON: { requiresApproval: boolean, reason: string }`;
    
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    return safeJsonParse(response.text);
}

export async function generateHandoffContext(prospect: Prospect, memory: ProspectMemory | null, history: any[], reason: string): Promise<HandoffContext> {
    const ai = getAI();
    const prompt = `Create handoff context for ${prospect.name}. Reason: ${reason}. Return JSON: { escalation_id, urgency, reason, sla, context_summary, key_intelligence: { pain_points, stakeholders_identified }, recommended_approach, prep_materials, suggested_response_draft }`;
    
    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    return safeJsonParse(response.text);
}

export async function generateStructuredHandoff(prospect: Prospect, memory: ProspectMemory | null, type: string, recipientRole: string): Promise<HandoffDocument> {
    const ai = getAI();
    const prompt = `Create handoff document of type ${type} for ${prospect.name}. Return JSON matching HandoffDocument interface.`;
    
    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    return safeJsonParse(response.text);
}

export async function runMeetingPrepAgent(prospect: Prospect, company: CompanyInfo): Promise<MeetingPrepResult> {
    const ai = getAI();
    const prompt = `Prepare for meeting with ${prospect.name} at ${prospect.company}. Return JSON: { meeting_brief: { company_snapshot: { one_liner, what_they_do, who_they_serve }, likely_priorities: [], discovery_questions: [], suggested_demo_flow: [], success_criteria_for_this_call: [], risks_and_watchouts: [] } }`;
    
    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: prompt,
        config: { 
            tools: [{ googleSearch: {} }],
            responseMimeType: "application/json" 
        }
    });
    return safeJsonParse(response.text);
}

export async function runObjectivePlanningAgent(prospect: Prospect, company: CompanyInfo, persona: SellerPersona, memory: any, summary: string): Promise<ObjectivePlan> {
    const ai = getAI();
    const prompt = `Plan objective for ${prospect.name}. Summary: ${summary}. Return JSON: { objective_plan: { objective: string, timing: { next_touch_delay_days: number } } }`;
    
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    return safeJsonParse(response.text);
}

export async function runToolSelectionAgent(prospect: Prospect, memory: any, persona: any): Promise<ToolSelectionResult> {
    const ai = getAI();
    const prompt = `Select tools for outreach to ${prospect.name}. Return JSON: { tool_selection: { selected_steps: [{ tool, order }], stop_conditions: [{ action, condition }] }, decision_rationale: { depth_level } }`;
    
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    return safeJsonParse(response.text);
}

export async function runTriggerEventAgent(prospect: Prospect, company: CompanyInfo): Promise<TriggerEventResult> {
    const ai = getAI();
    const prompt = `Find trigger events for ${prospect.company}. Return JSON: { trigger_events: [], overall_signal_strength: string, noise_filtered: [], limitations: [] }`;
    
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { 
            tools: [{ googleSearch: {} }],
            responseMimeType: "application/json" 
        }
    });
    return safeJsonParse(response.text);
}

export async function runAccountIntelligenceAgent(prospect: Prospect, company: CompanyInfo): Promise<AccountIntelligenceResult> {
    const ai = getAI();
    const prompt = `
    Account intelligence for ${prospect.company}.
    My Company: ${company.name}. Value Prop: ${company.valueProposition}.
    
    Return JSON: { summary: { primary_message_for_this_account, do_not_pitch }, account_intelligence: { best_fit_pitch_points: [{ pitch_point, why_it_resonates_with_persona, confidence }], persona_specific_objections_and_responses: [{ objection, recommended_response }] } }
    `;
    
    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    
    const parsed = safeJsonParse(response.text);
    
    return {
        summary: {
            primary_message_for_this_account: parsed?.summary?.primary_message_for_this_account || "Analysis unavailable.",
            do_not_pitch: Array.isArray(parsed?.summary?.do_not_pitch) ? parsed.summary.do_not_pitch : []
        },
        account_intelligence: {
            best_fit_pitch_points: Array.isArray(parsed?.account_intelligence?.best_fit_pitch_points) ? parsed.account_intelligence.best_fit_pitch_points : [],
            persona_specific_objections_and_responses: Array.isArray(parsed?.account_intelligence?.persona_specific_objections_and_responses) ? parsed.account_intelligence.persona_specific_objections_and_responses : []
        }
    };
}
