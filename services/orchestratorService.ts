
import { 
    Prospect, CompanyInfo, SellerPersona, OrchestratorResult, ExecutionStep, 
    OrchestratorResults, OrchestratorRecommendation, OrchestratorGuardrails 
} from '../types';
import { 
    runIcpFitScoring, 
    runWebsitePersonalizationAgent, 
    runCompetitorIntelligenceAgent, 
    runObjectivePlanningAgent, 
    runColdEmailAgent,
    runFollowUpAgent,
    runToolSelectionAgent,
    runTriggerEventAgent,
    runAccountIntelligenceAgent
} from './geminiService';
import { memoryService } from './memoryService';

// Initial Empty Result State
const INITIAL_RESULT: OrchestratorResult = {
    execution_plan: {
        steps: [],
        stop_conditions: []
    },
    results: {
        icp: null,
        personalization_pack: null,
        competitor_intel: null,
        trigger_events: null,
        account_intel: null,
        objective_plan: null,
        message: null,
        follow_up_plan: null
    },
    final_recommendation: {
        send_now: false,
        what_to_send: "",
        why: "",
        next_touch_in_days: 0
    },
    guardrails: {
        blocked: false,
        blocked_reason: "",
        risks: []
    }
};

export const orchestratorService = {
    async orchestrateOutreach(
        prospect: Prospect,
        company: CompanyInfo,
        persona: SellerPersona,
        onStepUpdate?: (step: ExecutionStep) => void
    ): Promise<OrchestratorResult> {
        
        const output = JSON.parse(JSON.stringify(INITIAL_RESULT)) as OrchestratorResult;
        let webFetches = 0;
        let searchQueries = 0;

        const addStep = (stepInfo: Partial<ExecutionStep>, status: ExecutionStep['status'] = 'completed') => {
            const step: ExecutionStep = {
                step: (output.execution_plan.steps.length || 0) + 1,
                module: stepInfo.module || 'Unknown',
                reason: stepInfo.reason || '',
                inputs_used: stepInfo.inputs_used || [],
                budget: { web_fetches: webFetches, search_queries: searchQueries },
                status,
                timestamp: new Date().toISOString()
            };
            output.execution_plan.steps.push(step);
            if (onStepUpdate) onStepUpdate(step);
        };

        // --- PHASE 1: PRE-FLIGHT CHECKS (Hard Gate) ---
        // 1.1 State Machine Check
        if (prospect.status === 'booked' || prospect.status === 'lost') {
            output.guardrails.blocked = true;
            output.guardrails.blocked_reason = `State is ${prospect.status}. Outreach forbidden.`;
            output.execution_plan.stop_conditions.push("Dead/Closed State");
            addStep({ module: "StateMachineEvaluate", reason: "Checked state" }, "failed");
            return output;
        }
        addStep({ module: "StateMachineEvaluate", reason: "Lead is active/cold. Outreach permitted." });

        // 1.2 Memory Retrieval
        const memory = memoryService.getMemory(prospect.id);
        if (memory?.topics_to_avoid?.includes("Do Not Contact")) {
            output.guardrails.blocked = true;
            output.guardrails.blocked_reason = "Memory constraints: Do Not Contact set.";
            output.execution_plan.stop_conditions.push("Memory Block");
            addStep({ module: "MemoryRetrieve", reason: "Memory check failed" }, "failed");
            return output;
        }
        addStep({ module: "MemoryRetrieve", reason: "Retrieved lead context and constraints." });

        // --- PHASE 2: AGENTIC PLANNING ---
        // Call Tool Selection Agent to decide the rest of the flow
        let plan;
        try {
            const toolSelection = await runToolSelectionAgent(prospect, memory, persona);
            plan = toolSelection.tool_selection;
            
            // Log the planning step
            addStep({ 
                module: "ToolSelectionAgent", 
                reason: `Depth: ${toolSelection.decision_rationale?.depth_level}. Strategy: ${plan?.selected_steps?.length || 0} steps.`
            });

            // Populate anticipated stops
            if (plan?.stop_conditions) {
                output.execution_plan.stop_conditions.push(...plan.stop_conditions.map(c => c.condition));
            }

        } catch (e) {
            console.error("Tool Selection Failed, falling back to default.", e);
            // Fallback plan if agent fails
            plan = {
                selected_steps: [
                    { tool: "ICPScoreFromWebsite", order: 1 },
                    { tool: "PersonalizationPackFromWebsite", order: 2 },
                    { tool: "ObjectiveFirstPlanner", order: 3 },
                    { tool: "ColdEmailGenerator", order: 4 },
                    { tool: "FollowUpSequencer", order: 5 }
                ]
            };
        }

        // --- PHASE 3: DYNAMIC EXECUTION ---
        const stepsToExecute = plan?.selected_steps || [];
        for (const plannedStep of stepsToExecute) {
            if (output.guardrails.blocked) break;

            const toolName = plannedStep.tool;
            // Update budgets from plan estimation (or track actuals)
            
            try {
                switch(toolName) {
                    case "ICPScoreFromWebsite":
                        webFetches++;
                        output.results.icp = await runIcpFitScoring(prospect, company);
                        const icpScore = output.results.icp.icp_fit.score;
                        if (icpScore < 40) {
                            // Check if plan says to stop
                            const stopRule = plan.stop_conditions?.find((c: any) => c.action === 'Stop' && c.condition.includes('ICP'));
                            if (stopRule) {
                                output.guardrails.blocked = true;
                                output.guardrails.blocked_reason = "Low ICP Score - Auto Stop";
                            } else {
                                output.guardrails.risks.push("Low ICP Fit");
                            }
                        }
                        addStep({ module: toolName, reason: `ICP Grade: ${output.results.icp.icp_fit.grade}` });
                        break;

                    case "PersonalizationPackFromWebsite":
                        webFetches += 2; searchQueries++;
                        output.results.personalization_pack = await runWebsitePersonalizationAgent(prospect, company);
                        addStep({ module: toolName, reason: "Extracted snippets." });
                        break;

                    case "CompetitorMentionDetector":
                        webFetches += 2; searchQueries += 2;
                        output.results.competitor_intel = await runCompetitorIntelligenceAgent(prospect, company);
                        addStep({ module: toolName, reason: "Competitor intel gathered." });
                        break;

                    case "TriggerEventDetector":
                        webFetches++; searchQueries++;
                        output.results.trigger_events = await runTriggerEventAgent(prospect, company);
                        addStep({ module: toolName, reason: "Triggers scanned." });
                        break;

                    case "InternalDocsPitchPoints":
                        // Mapped to Account Intelligence for now as it covers similar ground
                        output.results.account_intel = await runAccountIntelligenceAgent(prospect, company);
                        addStep({ module: toolName, reason: "Account intel gathered." });
                        break;

                    case "ObjectiveFirstPlanner":
                        // Compile context
                        const researchSummary = `
                            ICP: ${output.results.icp?.icp_fit.grade || 'Unknown'}.
                            Snippets: ${output.results.personalization_pack?.personalization_pack?.length || 0} found.
                            Competitors: ${output.results.competitor_intel?.competitor_intelligence?.detected_tools?.map(t => t.tool_name).join(', ') || 'None'}.
                            Triggers: ${output.results.trigger_events?.trigger_events?.map(t => t.trigger_type).join(', ') || 'None'}.
                        `;
                        output.results.objective_plan = await runObjectivePlanningAgent(
                            prospect, company, persona, memory, researchSummary
                        );
                        addStep({ module: toolName, reason: `Objective: ${output.results.objective_plan.objective_plan.objective}` });
                        break;

                    case "ColdEmailGenerator":
                        // We use the agent but it implicitly uses the strategy we just built if we pass it, 
                        // currently runColdEmailAgent is autonomous, but in a real system we'd inject the plan.
                        // For this demo, it generates based on prospect state.
                        output.results.message = await runColdEmailAgent(prospect, company, persona);
                        addStep({ module: toolName, reason: `Generated ${output.results.message.variants.length} variants.` });
                        break;

                    case "FollowUpSequencer":
                        const mockLastMsg = { content: "Initial Outreach", role: "sdr", timestamp: new Date().toISOString() };
                        output.results.follow_up_plan = await runFollowUpAgent(prospect, mockLastMsg, company, []);
                        addStep({ module: toolName, reason: "Sequence planned." });
                        break;

                    case "StateMachineEvaluate":
                    case "MemoryRetrieve":
                        // Already handled in pre-flight, skip or log
                        break;

                    default:
                        addStep({ module: toolName, reason: "Tool not implemented or skipped" }, "skipped");
                }
            } catch (e) {
                console.warn(`Step ${toolName} failed`, e);
                addStep({ module: toolName, reason: "Execution Error" }, "failed");
                // Decide whether to block based on tool criticality
                if (toolName === "ObjectiveFirstPlanner" || toolName === "ColdEmailGenerator") {
                    output.guardrails.blocked = true;
                    output.guardrails.blocked_reason = "Critical Step Failed";
                }
            }
        }

        // --- PHASE 4: FINAL RECOMMENDATION ---
        if (!output.guardrails.blocked && output.results.message && output.results.message.variants.length > 0) {
            output.final_recommendation = {
                send_now: true,
                what_to_send: output.results.message.variants[0].email_body,
                why: `Matches objective: ${output.results.objective_plan?.objective_plan.objective || 'Outreach'}.`,
                next_touch_in_days: output.results.objective_plan?.objective_plan.timing.next_touch_delay_days || 3
            };
        } else {
             output.final_recommendation.why = output.guardrails.blocked_reason || "No content generated.";
        }

        return output;
    }
};
