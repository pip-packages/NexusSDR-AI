
import React, { useState, useEffect, useRef } from 'react';
import { CompanyInfo, SellerPersona, Prospect, AgentLog, Channel, OutreachStrategy, GeneratedMessage, ProposedAction, ColdEmailGenerationResult, ColdEmailVariant, PersonalizationPackResult, CoachResult, DeepResearchResult, MirrorResult, ScreenScanResult, MicrositeResult, VideoAnalysisResult, LogicAudit, RoleplayMessage, RoleplayFeedback, VoiceBlueprint } from '../types';
import { contextualMessageGenerator, runAutonomousAgent, dynamicStrategySelector, runColdEmailAgent, runWebsitePersonalizationAgent, runSDRCoachAgent, runDeepResearchAgent, runMirrorCheckAgent, runScreenScanAgent, runMicrositeGeneratorAgent, runVideoSignalAnalysis, auditDecision, interactWithRoleplayAgent, generateRoleplayFeedback, runPersonaBuilderAgent } from '../services/geminiService';
import { approvalService } from '../services/approvalService';

interface OutreachViewProps {
  company: CompanyInfo;
  persona: SellerPersona;
  activeProspect?: Prospect;
  onUpdate: (p: Prospect) => void;
  onSuccess: (id: string, message: string, channel: Channel) => void;
}

const OutreachView: React.FC<OutreachViewProps> = ({ company, persona, activeProspect, onUpdate, onSuccess }) => {
  const [researchAnalysis, setResearchAnalysis] = useState('');
  const [deepResearchResult, setDeepResearchResult] = useState<DeepResearchResult | null>(null);
  const [isDeepResearching, setIsDeepResearching] = useState(false);
  const [screenScanResult, setScreenScanResult] = useState<ScreenScanResult | null>(null);
  const [isScanningScreen, setIsScanningScreen] = useState(false);
  
  // Video Analysis State
  const [videoAnalysisResult, setVideoAnalysisResult] = useState<VideoAnalysisResult | null>(null);
  const [isAnalyzingVideo, setIsAnalyzingVideo] = useState(false);
  
  // Microsite State
  const [micrositeResult, setMicrositeResult] = useState<MicrositeResult | null>(null);
  const [isGeneratingMicrosite, setIsGeneratingMicrosite] = useState(false);
  
  // Roleplay State
  const [showRoleplay, setShowRoleplay] = useState(false);
  const [roleplayHistory, setRoleplayHistory] = useState<RoleplayMessage[]>([]);
  const [roleplayInput, setRoleplayInput] = useState('');
  const [isRoleplaying, setIsRoleplaying] = useState(false);
  const [roleplayFeedback, setRoleplayFeedback] = useState<RoleplayFeedback | null>(null);

  // Persona Builder (Vibe Matcher) State
  const [showPersonaBuilder, setShowPersonaBuilder] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<File[]>([]);
  const [isBuildingPersona, setIsBuildingPersona] = useState(false);
  const [voiceBlueprint, setVoiceBlueprint] = useState<VoiceBlueprint | null>(null);

  // New State for Generated Object
  const [generatedMessage, setGeneratedMessage] = useState<GeneratedMessage | null>(null);
  const [emailVariantsResult, setEmailVariantsResult] = useState<ColdEmailGenerationResult | null>(null);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState<number>(0);
  const [personalizationPack, setPersonalizationPack] = useState<PersonalizationPackResult | null>(null);
  const [isScanningWebsite, setIsScanningWebsite] = useState(false);
  
  const [contentBody, setContentBody] = useState('');
  const [contentSubject, setContentSubject] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [agentRunning, setAgentRunning] = useState(false);
  const [agentLogs, setAgentLogs] = useState<AgentLog[]>([]);
  
  // Logic Audit State
  const [showLogicMap, setShowLogicMap] = useState(false);
  const [logicAudit, setLogicAudit] = useState<LogicAudit | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);

  // Workflow States
  const [step, setStep] = useState<'research' | 'strategy' | 'generate'>('research');
  
  // Strategy State
  const [selectedStrategy, setSelectedStrategy] = useState<OutreachStrategy | null>(null);
  const [loadingStrategy, setLoadingStrategy] = useState(false);

  // Coach State
  const [coachResult, setCoachResult] = useState<CoachResult | null>(null);
  const [isCoaching, setIsCoaching] = useState(false);
  const [activeCoachTab, setActiveCoachTab] = useState<'scorecard' | 'rewrites' | 'experiments'>('scorecard');

  // Mirror/Vibe Check State
  const [mirrorResult, setMirrorResult] = useState<MirrorResult | null>(null);
  const [isMirroring, setIsMirroring] = useState(false);

  const [approvalSent, setApprovalSent] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<Channel>('email');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const roleplayEndRef = useRef<HTMLDivElement>(null);

  // Load existing personalization if available
  useEffect(() => {
      if (activeProspect?.websitePersonalization) {
          setPersonalizationPack(activeProspect.websitePersonalization);
      } else {
          setPersonalizationPack(null);
      }
      setDeepResearchResult(null); // Reset deep research on prospect change
      setMirrorResult(null);
      setScreenScanResult(null);
      setMicrositeResult(null);
      setVideoAnalysisResult(null);
      setLogicAudit(null); // Reset Logic Map
      setRoleplayHistory([]); // Reset Roleplay
      setRoleplayFeedback(null);
      setVoiceBlueprint(activeProspect?.voiceBlueprint || null);
      setUploadedDocs([]);
  }, [activeProspect]);

  useEffect(() => {
      roleplayEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [roleplayHistory]);

  const handleRunAgent = async () => {
    if (!activeProspect) return;
    setAgentRunning(true);
    setAgentLogs([]);
    setStep('research');
    
    // 1. Run Research Agent
    const finalResult = await runAutonomousAgent(`Research ${activeProspect.name} at ${activeProspect.company} for high-value outreach hooks.`, (log) => {
      setAgentLogs(prev => [...prev, log]);
    });
    setResearchAnalysis(finalResult);
    
    setAgentRunning(false);
    setStep('strategy');
    
    // 2. Auto-trigger Strategy Selection after Research
    handleSelectStrategy(finalResult);
  };

  const handleRunDeepResearch = async () => {
      if (!activeProspect) return;
      setIsDeepResearching(true);
      setAgentLogs(prev => [...prev, { type: 'action', content: 'Running Deep Research with Google Search Grounding...', timestamp: new Date().toISOString() }]);
      
      try {
          const result = await runDeepResearchAgent(activeProspect, company);
          setDeepResearchResult(result);
          setAgentLogs(prev => [...prev, { type: 'observation', content: `Found ${result.trigger_events.length} trigger events. Signal: ${result.nexus_signal}`, timestamp: new Date().toISOString() }]);
      } catch (e) {
          console.error("Deep Research Failed", e);
      }
      setIsDeepResearching(false);
  };

  const handleRunMirror = async () => {
      if (!activeProspect || !contentBody) return;
      setIsMirroring(true);
      setMirrorResult(null);
      try {
          const result = await runMirrorCheckAgent(
              { subject: contentSubject, body: contentBody }, 
              activeProspect
          );
          setMirrorResult(result);
      } catch (e) {
          console.error("Mirror Check Failed", e);
      }
      setIsMirroring(false);
  };

  const handleGenerateMicrosite = async () => {
      if (!activeProspect) return;
      setIsGeneratingMicrosite(true);
      setMicrositeResult(null);
      
      try {
          const result = await runMicrositeGeneratorAgent(activeProspect, company);
          setMicrositeResult(result);
      } catch (e) {
          console.error("Microsite Gen Failed", e);
      }
      setIsGeneratingMicrosite(false);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!event.target.files || event.target.files.length === 0 || !activeProspect) return;
      
      const file = event.target.files[0];
      const reader = new FileReader();
      
      setIsScanningScreen(true);
      setAgentLogs(prev => [...prev, { type: 'action', content: `Processing visual asset: ${file.name}...`, timestamp: new Date().toISOString() }]);

      reader.onloadend = async () => {
          const base64String = reader.result as string;
          // Extract base64 data part (remove data:image/png;base64, prefix)
          const base64Data = base64String.split(',')[1];
          
          try {
              const result = await runScreenScanAgent(activeProspect, base64Data, file.type);
              setScreenScanResult(result);
              setAgentLogs(prev => [...prev, { type: 'observation', content: `Visual Analysis Complete. Aesthetic: ${result.visual_analysis.aesthetic_vibe}`, timestamp: new Date().toISOString() }]);
          } catch (e) {
              console.error("Screen Scan failed", e);
              setAgentLogs(prev => [...prev, { type: 'answer', content: "Visual analysis failed.", timestamp: new Date().toISOString() }]);
          } finally {
              setIsScanningScreen(false);
          }
      };
      
      reader.readAsDataURL(file);
  };

  const handleVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!event.target.files || event.target.files.length === 0 || !activeProspect) return;
      
      const file = event.target.files[0];
      // Note: Browsers crash on large files via FileReader. 
      // Ideally use streaming/Blob URL or upload to backend. 
      // For this demo, we assume smaller clips (<20MB) or robust browser handling.
      const reader = new FileReader();
      
      setIsAnalyzingVideo(true);
      setVideoAnalysisResult(null);
      setAgentLogs(prev => [...prev, { type: 'action', content: `Ingesting video signal: ${file.name}...`, timestamp: new Date().toISOString() }]);

      reader.onloadend = async () => {
          const base64String = reader.result as string;
          const base64Data = base64String.split(',')[1];
          
          try {
              const result = await runVideoSignalAnalysis(activeProspect, base64Data, file.type);
              setVideoAnalysisResult(result);
              setAgentLogs(prev => [...prev, { type: 'observation', content: `Video signals extracted: ${result.signals.length} key moments found.`, timestamp: new Date().toISOString() }]);
          } catch (e) {
              console.error("Video Analysis failed", e);
              setAgentLogs(prev => [...prev, { type: 'answer', content: "Video analysis failed. File might be too large for browser demo.", timestamp: new Date().toISOString() }]);
          } finally {
              setIsAnalyzingVideo(false);
          }
      };
      
      reader.readAsDataURL(file);
  };

  const handleDocUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!event.target.files) return;
      const files = Array.from(event.target.files);
      setUploadedDocs(prev => [...prev, ...files]);
  };

  const handleBuildPersona = async () => {
      if (uploadedDocs.length === 0 || !activeProspect) return;
      setIsBuildingPersona(true);
      
      const filePayloads: { data: string; mimeType: string }[] = [];
      
      // Process all files to Base64
      for (const file of uploadedDocs) {
          try {
              const base64 = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(reader.result as string);
                  reader.onerror = reject;
                  reader.readAsDataURL(file);
              });
              filePayloads.push({
                  data: base64.split(',')[1],
                  mimeType: file.type
              });
          } catch (e) {
              console.error("Failed to read file", file.name);
          }
      }

      try {
          const blueprint = await runPersonaBuilderAgent(activeProspect.name, filePayloads);
          setVoiceBlueprint(blueprint);
          onUpdate({ ...activeProspect, voiceBlueprint: blueprint });
      } catch (e) {
          console.error("Persona Builder Failed", e);
      }
      setIsBuildingPersona(false);
  };

  const handleSelectStrategy = async (researchContext: string) => {
      if (!activeProspect) return;
      setLoadingStrategy(true);
      // Using the new robust dynamic strategy selector
      const strategy = await dynamicStrategySelector(activeProspect, researchContext);
      setSelectedStrategy(strategy);
      setLoadingStrategy(false);
  };

  const handleRunWebsiteScan = async () => {
      if (!activeProspect) return;
      setIsScanningWebsite(true);
      try {
          const result = await runWebsitePersonalizationAgent(activeProspect, company);
          setPersonalizationPack(result);
          onUpdate({ ...activeProspect, websitePersonalization: result });
      } catch (e) {
          console.error("Website Scan Failed", e);
      }
      setIsScanningWebsite(false);
  };

  const handleGenerate = async () => {
    if (!activeProspect) return;
    setLoading(true);
    setCoachResult(null); // Reset coach
    setStep('generate');
    setEmailVariantsResult(null);
    setLogicAudit(null); // Reset audit when regenerating

    // If Email, use the new Cold Email Agent for variants
    if (selectedChannel === 'email') {
        try {
            const variantsResult = await runColdEmailAgent(activeProspect, company, persona);
            setEmailVariantsResult(variantsResult);
            if (variantsResult.variants && variantsResult.variants.length > 0) {
                applyVariant(variantsResult.variants[0], 0);
            }
        } catch (e) {
            console.error("Cold Email Agent Failed", e);
        }
    } else {
        // LinkedIn / other channels use standard generator
        const result = await contextualMessageGenerator(
            activeProspect, 
            'LinkedIn Connection',
            { ...company, ...persona },
            [], 
            undefined,
            selectedStrategy || undefined
        );
        setGeneratedMessage(result);
        setContentBody(result.body);
        setContentSubject('');
    }
    
    setLoading(false);
  };

  const applyVariant = (variant: ColdEmailVariant, index: number) => {
      setSelectedVariantIndex(index);
      setContentSubject(variant.subject);
      setContentBody(variant.email_body);
      setLogicAudit(null); // Reset audit if content changes
      
      // Map to legacy structure for compatibility with existing UI components if needed
      setGeneratedMessage({
          body: variant.email_body,
          subject: variant.subject,
          personalization_used: variant.personalization_used,
          framework_applied: variant.style,
          reasoning: `Selected ${variant.style} style. Confidence: ${variant.confidence_score}`,
          confidence_score: variant.confidence_score * 100
      });
  };

  const insertSnippet = (snippet: string) => {
      setContentBody(prev => prev + "\n\n" + snippet);
  };

  const applyVideoDraft = () => {
      if (!videoAnalysisResult) return;
      setContentSubject(videoAnalysisResult.draft_email.subject);
      setContentBody(videoAnalysisResult.draft_email.body);
      setStep('generate'); // Ensure we are on the generate step to edit
  };

  const handleRunCoach = async () => {
      if (!activeProspect || !contentBody) return;
      setIsCoaching(true);
      setMirrorResult(null); // Clear mirror if coaching
      
      try {
          const result = await runSDRCoachAgent(
              { subject: contentSubject, body: contentBody, channel: selectedChannel },
              activeProspect,
              company,
              persona
          );
          setCoachResult(result);
      } catch (e) {
          console.error("Coaching failed", e);
      }
      setIsCoaching(false);
  };

  const handleRunLogicAudit = async () => {
      if (!contentBody) return;
      setIsAuditing(true);
      setShowLogicMap(true); // Open the panel immediately to show loading state
      
      // Construct context for the auditor
      const context = `
      Prospect: ${activeProspect?.name}, ${activeProspect?.title} @ ${activeProspect?.company}
      Strategy Used: ${selectedStrategy?.name || 'Standard'}
      Channel: ${selectedChannel}
      Draft Subject: ${contentSubject}
      Draft Body: ${contentBody}
      `;

      try {
          const audit = await auditDecision(context, "Drafted current outbound message");
          setLogicAudit(audit);
      } catch (e) {
          console.error("Logic Audit failed", e);
      }
      setIsAuditing(false);
  };

  const handleSendRoleplay = async () => {
      if (!roleplayInput || !activeProspect) return;
      
      const userMsg: RoleplayMessage = { role: 'user', content: roleplayInput, timestamp: new Date().toISOString() };
      const updatedHistory = [...roleplayHistory, userMsg];
      setRoleplayHistory(updatedHistory);
      setRoleplayInput('');
      setIsRoleplaying(true);

      try {
          const responseText = await interactWithRoleplayAgent(updatedHistory, activeProspect, company, roleplayInput);
          const aiMsg: RoleplayMessage = { role: 'model', content: responseText, timestamp: new Date().toISOString() };
          setRoleplayHistory([...updatedHistory, aiMsg]);
      } catch (e) {
          console.error("Roleplay Error", e);
      }
      setIsRoleplaying(false);
  };

  const handleEndRoleplay = async () => {
      if (roleplayHistory.length === 0) return;
      setIsRoleplaying(true);
      try {
          const feedback = await generateRoleplayFeedback(roleplayHistory);
          setRoleplayFeedback(feedback);
      } catch (e) {
          console.error("Feedback Gen Failed", e);
      }
      setIsRoleplaying(false);
  };

  const applyRewrite = (rewrite: { subject?: string; body: string }) => {
      setContentBody(rewrite.body);
      if (rewrite.subject) setContentSubject(rewrite.subject);
  };

  const handleSend = async () => {
    if (!activeProspect) return;
    
    const fullContent = selectedChannel === 'email' ? `Subject: ${contentSubject}\n\n${contentBody}` : contentBody;

    const action: ProposedAction = {
        type: selectedChannel === 'linkedin' ? 'send_linkedin' : 'send_email',
        prospectId: activeProspect.id,
        prospectName: activeProspect.name,
        prospectTitle: activeProspect.title,
        prospectCompany: activeProspect.company,
        content: fullContent,
        meta: { subject: contentSubject }
    };

    // Use Centralized Approval Manager
    const result = await approvalService.approvalWorkflowManager(action);
    
    if (result.status === 'pending') {
        setApprovalSent(true);
        return;
    }

    onSuccess(activeProspect.id, fullContent, selectedChannel);
  };

  if (!activeProspect) return <div className="text-center p-20 text-gray-400">Select a prospect to begin.</div>;

  const getTierColor = (tier?: string) => {
      switch(tier) {
          case 'Hot': return 'text-rose-600 bg-rose-50 border-rose-100';
          case 'Warm': return 'text-amber-600 bg-amber-50 border-amber-100';
          case 'Nurture': return 'text-blue-600 bg-blue-50 border-blue-100';
          default: return 'text-slate-500 bg-slate-50 border-slate-100';
      }
  };

  return (
    <div className="space-y-6 animate-fadeIn relative">
      {/* STEPS INDICATOR */}
      <div className="flex items-center gap-4 text-xs font-bold text-gray-400 uppercase tracking-widest">
        <span className={step === 'research' ? 'text-indigo-600 transition-colors' : ''}>1. Agentic Research</span>
        <i className="fas fa-chevron-right opacity-30"></i>
        <span className={step === 'strategy' ? 'text-indigo-600 transition-colors' : ''}>2. Strategic Analysis</span>
        <i className="fas fa-chevron-right opacity-30"></i>
        <span className={step === 'generate' ? 'text-indigo-600 transition-colors' : ''}>3. Content Synthesis</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* COGNITIVE SIDEBAR */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200">
            <h3 className="font-bold mb-4 text-gray-800">Target Profile</h3>
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 mb-4">
                <p className="text-sm font-bold text-gray-900">{activeProspect.name}</p>
                <p className="text-xs text-gray-500">{activeProspect.title} @ {activeProspect.company}</p>
            </div>

            {/* Strategic Scorecard (Replaced BANT Lead Score Widget) */}
            {activeProspect.bantData && (
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                    <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                        <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                            <i className="fas fa-clipboard-check text-indigo-500"></i> Strategic Scorecard
                        </h4>
                        <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${getTierColor(activeProspect.bantData.tier)}`}>
                            {activeProspect.bantData.tier || 'Unscored'} ({activeProspect.bantData.total})
                        </span>
                    </div>
                    <div className="p-4 space-y-4">
                        {Object.entries(activeProspect.bantData.breakdown || {}).map(([key, val]) => (
                            <div key={key} className="space-y-1">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-gray-500 uppercase">{key}</span>
                                    <span className="text-[10px] font-bold text-gray-900">{val as number}/100</span>
                                </div>
                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full rounded-full transition-all duration-500 ${
                                            (val as number) >= 70 ? 'bg-emerald-400' : (val as number) >= 40 ? 'bg-amber-400' : 'bg-slate-300'
                                        }`} 
                                        style={{width: `${val}%`}}
                                    ></div>
                                </div>
                                {/* Granular Reasoning */}
                                {activeProspect.bantData?.reasoning_breakdown && (
                                    <p className="text-[9px] text-gray-500 leading-snug italic pt-1 border-l-2 border-indigo-100 pl-2">
                                        "{activeProspect.bantData.reasoning_breakdown[key as keyof typeof activeProspect.bantData.reasoning_breakdown]}"
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                    {!activeProspect.bantData.reasoning_breakdown && (
                        <div className="px-4 pb-4">
                            <p className="text-[10px] text-slate-500 italic border-t border-slate-100 pt-2">
                                "{activeProspect.bantData.reasoning}"
                            </p>
                        </div>
                    )}
                </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-3xl shadow-xl h-[450px] flex flex-col overflow-hidden relative group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-400 to-blue-400"></div>
            
            {/* Logic Map Overlay Panel */}
            {showLogicMap ? (
                <div className="absolute inset-0 bg-slate-900 z-20 flex flex-col animate-slideUp">
                    <div className="p-5 border-b border-slate-700 flex justify-between items-center bg-slate-900">
                        <span className="font-bold text-sm text-white flex items-center gap-2">
                            <i className="fas fa-brain text-purple-400"></i> Logic Map
                        </span>
                        <button onClick={() => setShowLogicMap(false)} className="text-slate-400 hover:text-white transition-colors">
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-5 space-y-6">
                        {isAuditing ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-3">
                                <i className="fas fa-circle-notch fa-spin text-3xl text-purple-500"></i>
                                <p className="text-xs font-mono">Auditing Thought Signature...</p>
                            </div>
                        ) : logicAudit ? (
                            <>
                                {/* Thought Steps */}
                                <div className="space-y-4 relative">
                                    <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-slate-700"></div>
                                    {logicAudit.thought_signature_steps.map((step, i) => (
                                        <div key={i} className="pl-6 relative">
                                            <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full bg-slate-800 border-2 border-purple-500 z-10"></div>
                                            <p className="text-xs text-slate-300 font-mono leading-relaxed">{step}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Devil's Advocate */}
                                <div className="bg-red-900/20 border border-red-500/30 p-4 rounded-xl mt-6">
                                    <h4 className="text-xs font-bold text-red-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                        <i className="fas fa-fire"></i> Devil's Advocate
                                    </h4>
                                    <p className="text-xs text-red-200 italic leading-relaxed">"{logicAudit.devil_advocate_critique}"</p>
                                </div>

                                {/* Verdict */}
                                <div className="flex items-center justify-between pt-4 border-t border-slate-700">
                                    <span className="text-xs text-slate-400 font-bold uppercase">Verdict</span>
                                    <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                                        logicAudit.decision_verdict.includes('Valid') ? 'bg-green-500/20 text-green-400 border-green-500/50' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50'
                                    }`}>
                                        {logicAudit.decision_verdict} ({logicAudit.confidence_score}%)
                                    </span>
                                </div>
                            </>
                        ) : (
                            <div className="text-center text-slate-500 mt-20">
                                <p>No audit data available.</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <>
                    <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                        <span className="font-bold text-sm text-gray-800 flex items-center gap-2">
                            <i className="fas fa-stream text-indigo-500"></i> Thinking Process
                        </span>
                        {(agentRunning || isDeepResearching || isMirroring || isScanningScreen || isGeneratingMicrosite || isAnalyzingVideo) && <i className="fas fa-circle-notch fa-spin text-indigo-500"></i>}
                    </div>
                    <div className="flex-1 overflow-y-auto p-5 font-mono text-[10px] space-y-3 bg-gray-50/30">
                        {agentLogs.length === 0 ? <p className="text-gray-400 text-center mt-10">Ready to initiate research agent...</p> : 
                            agentLogs.map((log, i) => (
                                <div key={i} className="opacity-90">
                                    <span className="text-indigo-600 font-bold uppercase mr-1">{log.type}:</span> <span className="text-gray-600">{log.content}</span>
                                </div>
                            ))
                        }
                    </div>
                </>
            )}

            <div className="p-4 bg-white border-t border-gray-100 grid grid-cols-2 gap-2 relative z-30">
                <button onClick={handleRunAgent} disabled={agentRunning || isDeepResearching || isScanningScreen || isGeneratingMicrosite || isAnalyzingVideo} className="py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md disabled:opacity-50 text-[10px]">
                    {agentRunning ? 'Researching...' : 'Deploy Agent'}
                </button>
                <button 
                    onClick={handleRunDeepResearch}
                    disabled={agentRunning || isDeepResearching || isScanningScreen || isGeneratingMicrosite || isAnalyzingVideo}
                    className="py-2 bg-white border border-indigo-200 text-indigo-700 rounded-xl font-bold hover:bg-indigo-50 transition-all shadow-sm disabled:opacity-50 text-[10px] flex items-center justify-center gap-1"
                >
                    {isDeepResearching ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-search-plus"></i>} 
                    Deep Dive
                </button>
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={agentRunning || isDeepResearching || isScanningScreen || isGeneratingMicrosite || isAnalyzingVideo}
                    className="py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50 text-[10px] flex items-center justify-center gap-2"
                >
                    {isScanningScreen ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-camera"></i>}
                    Scan Screen
                </button>
                <button 
                    onClick={() => videoInputRef.current?.click()}
                    disabled={agentRunning || isDeepResearching || isScanningScreen || isGeneratingMicrosite || isAnalyzingVideo}
                    className="py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50 text-[10px] flex items-center justify-center gap-2"
                >
                    {isAnalyzingVideo ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-video"></i>}
                    Video Signal
                </button>
                <button 
                    onClick={() => setShowPersonaBuilder(true)}
                    className="col-span-2 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl font-bold hover:from-purple-600 hover:to-indigo-600 transition-all shadow-sm text-[10px] flex items-center justify-center gap-2"
                >
                    <i className="fas fa-fingerprint"></i> Persona Vibe Matcher
                </button>
                
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={handleFileUpload}
                />
                <input 
                    type="file" 
                    ref={videoInputRef} 
                    className="hidden" 
                    accept="video/*"
                    onChange={handleVideoUpload}
                />
            </div>
          </div>
        </div>

        {/* WORKSPACE */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl shadow-sm border border-gray-200 min-h-[500px] flex flex-col overflow-hidden relative">
            
            {/* Header / Tabs */}
            <div className="p-6 border-b border-gray-100 bg-white flex justify-between items-center">
                <div className="flex gap-2">
                    <button onClick={() => setSelectedChannel('email')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${selectedChannel === 'email' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 bg-gray-50 hover:bg-gray-100 border border-gray-200'}`}>Email</button>
                    <button onClick={() => setSelectedChannel('linkedin')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${selectedChannel === 'linkedin' ? 'bg-[#0077b5] text-white shadow-md' : 'text-gray-500 bg-gray-50 hover:bg-gray-100 border border-gray-200'}`}>LinkedIn</button>
                </div>
                <div className="flex gap-3">
                    {/* Sparring Mode Trigger */}
                    <button 
                        onClick={() => setShowRoleplay(true)} 
                        className="text-xs font-bold text-slate-600 hover:text-slate-800 transition-colors flex items-center gap-2 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200"
                    >
                        <i className="fas fa-user-ninja"></i> Sparring Mode
                    </button>

                    {/* Logic Map Trigger */}
                    {contentBody && (
                        <button 
                            onClick={handleRunLogicAudit} 
                            disabled={isAuditing}
                            className="text-xs font-bold text-purple-600 hover:text-purple-800 transition-colors flex items-center gap-2 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg border border-purple-100"
                        >
                            {isAuditing ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-brain"></i>}
                            Logic Audit
                        </button>
                    )}
                    {step === 'generate' && <button onClick={handleGenerate} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors">Regenerate Loop</button>}
                </div>
            </div>

            <div className="flex-1 p-8 space-y-8 overflow-y-auto">
                {researchAnalysis && !deepResearchResult && !screenScanResult && !micrositeResult && !videoAnalysisResult && (
                    <div className="p-5 bg-indigo-50 border border-indigo-100 rounded-2xl">
                        <h4 className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-widest mb-2">Researcher Findings</h4>
                        <p className="text-sm text-gray-700 italic">"{researchAnalysis.substring(0, 200)}..."</p>
                    </div>
                )}

                {deepResearchResult && (
                    <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-3xl p-6 shadow-xl relative overflow-hidden text-white animate-slideDown">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500 opacity-20 rounded-full -mr-10 -mt-10 blur-3xl"></div>
                        
                        <div className="flex justify-between items-start relative z-10 mb-6">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center backdrop-blur-sm">
                                        <i className="fas fa-satellite-dish text-indigo-300"></i>
                                    </div>
                                    <h3 className="font-bold text-lg">Deep Dive Intelligence</h3>
                                </div>
                                <p className="text-indigo-200 text-xs max-w-md italic">"{deepResearchResult.nexus_signal}"</p>
                            </div>
                            <div className="text-center">
                                <div className="text-3xl font-bold text-white">{deepResearchResult.relevance_score}</div>
                                <div className="text-[10px] uppercase font-bold text-indigo-300 tracking-wider">Relevance</div>
                            </div>
                        </div>

                        <div className="space-y-3 relative z-10">
                            <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-widest">Trigger Events Detected</h4>
                            {deepResearchResult.trigger_events.length === 0 ? (
                                <p className="text-sm text-gray-400 italic">No significant public trigger events found in recent search window.</p>
                            ) : (
                                deepResearchResult.trigger_events.map((event, idx) => (
                                    <div key={idx} className="bg-white/5 border border-white/10 p-3 rounded-xl hover:bg-white/10 transition-colors">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-[10px] font-bold bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded uppercase">{event.category}</span>
                                            <span className="text-[10px] text-gray-400">{event.date}</span>
                                        </div>
                                        <p className="text-sm font-medium text-white mb-1">{event.description}</p>
                                        <a href={event.source_url} target="_blank" rel="noreferrer" className="text-[10px] text-indigo-300 hover:text-white flex items-center gap-1">
                                            <i className="fas fa-external-link-alt"></i> Source
                                        </a>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {screenScanResult && (
                    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-lg relative overflow-hidden animate-slideDown">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-pink-100 text-pink-600 rounded-xl flex items-center justify-center">
                                <i className="fas fa-eye text-xl"></i>
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 text-lg">Visual Digital Footprint</h3>
                                <p className="text-xs text-slate-500">Visual hooks extracted via Gemini 3 Vision.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Visual Context</h4>
                                <div className="space-y-3">
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Aesthetic Vibe</span>
                                        <span className="inline-block bg-white border border-slate-200 px-3 py-1 rounded-full text-xs font-bold text-slate-700 shadow-sm">
                                            {screenScanResult.visual_analysis.aesthetic_vibe}
                                        </span>
                                    </div>
                                    {screenScanResult.visual_analysis.technical_sophistication && (
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Tech Sophistication</span>
                                            <span className="inline-block bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full text-xs font-bold text-indigo-700 shadow-sm">
                                                {screenScanResult.visual_analysis.technical_sophistication}
                                            </span>
                                        </div>
                                    )}
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Detected Value Props</span>
                                        <ul className="list-disc list-inside text-xs text-slate-600 space-y-1">
                                            {screenScanResult.visual_analysis.key_value_props_detected?.map((vp, i) => (
                                                <li key={i}>{vp}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Actionable Hooks</h4>
                                {screenScanResult.visual_hooks?.map((hook, idx) => (
                                    <div key={idx} className="bg-gradient-to-br from-indigo-50 to-white p-3 rounded-xl border border-indigo-100 hover:shadow-md transition-shadow group cursor-pointer" onClick={() => insertSnippet(hook.hook_content)}>
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-[10px] font-bold text-indigo-500 uppercase bg-white px-2 py-0.5 rounded border border-indigo-100">{hook.visual_element}</span>
                                            <span className="text-[10px] text-slate-400 group-hover:text-indigo-600 transition-colors"><i className="fas fa-plus-circle"></i> Insert</span>
                                        </div>
                                        <p className="text-xs font-bold text-slate-800 mb-1">"{hook.hook_content}"</p>
                                        <p className="text-[10px] text-slate-500 italic leading-snug">{hook.reasoning}</p>
                                    </div>
                                ))}
                                {(!screenScanResult.visual_hooks || screenScanResult.visual_hooks.length === 0) && (
                                    <p className="text-xs text-slate-400 italic">No specific hooks generated.</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* VIDEO ANALYSIS RESULT */}
                {videoAnalysisResult && (
                    <div className="bg-slate-900 rounded-3xl p-6 shadow-xl animate-slideDown border border-slate-800 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500 opacity-10 rounded-full -mr-10 -mt-10 blur-3xl"></div>
                        
                        <div className="flex items-center gap-3 mb-6 relative z-10">
                            <div className="w-10 h-10 bg-rose-500 rounded-xl flex items-center justify-center shadow-lg">
                                <i className="fas fa-video text-white text-lg"></i>
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">Visual Video Intelligence</h3>
                                <p className="text-xs text-rose-300">Extracted from webinar/interview visual cues.</p>
                            </div>
                        </div>

                        <div className="space-y-6 relative z-10">
                            <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
                                <h4 className="text-xs font-bold text-rose-400 uppercase tracking-widest mb-2">Context Summary</h4>
                                <p className="text-sm text-gray-300 italic">"{videoAnalysisResult.summary}"</p>
                            </div>

                            <div className="space-y-3">
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Key Visual Moments</h4>
                                {videoAnalysisResult.signals.map((signal, idx) => (
                                    <div key={idx} className="bg-white/10 p-4 rounded-xl border border-white/10 hover:bg-white/20 transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-[10px] font-mono bg-black/30 px-2 py-1 rounded text-rose-300">{signal.timestamp}</span>
                                            {signal.visual_cue && <span className="text-[10px] font-bold text-white bg-rose-500/20 px-2 py-0.5 rounded border border-rose-500/30">{signal.visual_cue}</span>}
                                        </div>
                                        {signal.quote && <p className="text-sm font-bold text-white mb-2">"{signal.quote}"</p>}
                                        <p className="text-xs text-rose-200"><strong className="text-rose-400">Insight:</strong> {signal.sales_implication}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-end pt-4 border-t border-white/10">
                                <button 
                                    onClick={applyVideoDraft}
                                    className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-2"
                                >
                                    <i className="fas fa-pen-nib"></i> Use Generated Email Draft
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* MICROSITE PREVIEW */}
                {micrositeResult && (
                    <div className="bg-slate-900 rounded-3xl p-6 shadow-2xl animate-slideDown border border-slate-800">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-8 h-8 rounded-lg bg-purple-500 text-white flex items-center justify-center font-bold">
                                        <i className="fas fa-bolt"></i>
                                    </div>
                                    <h3 className="text-lg font-bold text-white">Instant Microsite</h3>
                                </div>
                                <p className="text-xs text-purple-300">Generated tailored demo experience.</p>
                            </div>
                            <div className="text-right">
                                <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Hook Strategy</span>
                                <span className="text-sm font-bold text-white">"{micrositeResult.headline}"</span>
                            </div>
                        </div>
                        
                        <div className="bg-white rounded-xl overflow-hidden h-[500px] border-4 border-slate-700 relative group">
                            <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => window.open('', '_blank')?.document.write(micrositeResult.html_code)} className="bg-white/90 text-slate-800 px-3 py-1.5 rounded-lg text-xs font-bold shadow-md hover:bg-white flex items-center gap-2">
                                    <i className="fas fa-external-link-alt"></i> Open Full
                                </button>
                            </div>
                            <iframe 
                                title="Microsite Preview"
                                srcDoc={micrositeResult.html_code}
                                className="w-full h-full border-0"
                            />
                        </div>
                        
                        <div className="mt-4 p-3 bg-slate-800 rounded-xl text-xs text-slate-400 border border-slate-700 italic">
                            <strong className="text-purple-400 not-italic">Personalization Logic:</strong> {micrositeResult.personalization_summary}
                        </div>
                    </div>
                )}

                {/* STRATEGY SELECTION CARD */}
                {(step === 'strategy' || step === 'generate') && (
                    <div className={`transition-all ${step === 'generate' ? 'opacity-60 hover:opacity-100' : ''}`}>
                         {loadingStrategy ? (
                             <div className="p-12 border-2 border-dashed border-gray-200 rounded-3xl flex flex-col items-center justify-center text-gray-400">
                                 <i className="fas fa-chess-knight text-4xl mb-3 animate-bounce"></i>
                                 <p className="font-bold">Analyzing market signals to select optimal strategy...</p>
                             </div>
                         ) : selectedStrategy ? (
                             <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl border border-gray-200 shadow-lg overflow-hidden relative group">
                                 <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                                     <i className="fas fa-chess-queen text-8xl text-indigo-900"></i>
                                 </div>
                                 <div className="p-6 border-b border-gray-100 flex justify-between items-start">
                                     <div>
                                         <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 mb-1 block">Recommended Strategy</span>
                                         <h3 className="text-2xl font-bold text-gray-800 capitalize">{selectedStrategy.name?.replace(/_/g, ' ')}</h3>
                                     </div>
                                     <div className="text-right">
                                         <div className="text-3xl font-bold text-indigo-600">{selectedStrategy.confidence}%</div>
                                         <div className="text-[10px] text-gray-400 uppercase font-bold">Confidence</div>
                                     </div>
                                 </div>
                                 <div className="p-6 space-y-4">
                                     <p className="text-gray-600 text-sm leading-relaxed">{selectedStrategy.reasoning}</p>
                                     
                                     <div>
                                         <h5 className="text-xs font-bold text-gray-800 uppercase mb-3">Execution Plan</h5>
                                         <div className="space-y-3">
                                             {selectedStrategy.execution_plan?.map((step, i) => (
                                                 <div key={i} className="flex gap-3 items-start">
                                                     <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">
                                                         {step.stepNumber}
                                                     </div>
                                                     <div>
                                                         <div className="flex items-center gap-2 mb-1">
                                                             <span className="font-bold text-sm text-gray-800">{step.action}</span>
                                                             <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-500 uppercase">{step.channel}</span>
                                                         </div>
                                                         <p className="text-xs text-gray-500">{step.rationale}</p>
                                                     </div>
                                                 </div>
                                             ))}
                                         </div>
                                     </div>
                                 </div>
                                 {step === 'strategy' && (
                                     <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end">
                                         <button onClick={handleGenerate} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2">
                                             Proceed to Synthesis <i className="fas fa-arrow-right"></i>
                                         </button>
                                     </div>
                                 )}
                             </div>
                         ) : null}
                    </div>
                )}

                {/* CONTENT GENERATION & CRITIQUE */}
                {step === 'generate' && (
                    <div className="space-y-6 animate-slideUp">
                        
                        {/* WEBSITE PERSONALIZATION MODULE */}
                        <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white">
                                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-widest flex items-center gap-2">
                                    <i className="fas fa-globe"></i> Website Signals
                                </h4>
                                <button 
                                    onClick={handleRunWebsiteScan}
                                    disabled={isScanningWebsite}
                                    className="text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded transition-colors flex items-center gap-2"
                                >
                                    {isScanningWebsite ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-search"></i>}
                                    Scan For Hooks
                                </button>
                            </div>
                            
                            {personalizationPack ? (
                                <div className="p-4">
                                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-200">
                                        {personalizationPack.personalization_pack?.map((item, idx) => (
                                            <div 
                                                key={idx}
                                                className="min-w-[240px] max-w-[240px] bg-white p-3 rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
                                                onClick={() => insertSnippet(item.snippet)}
                                            >
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-[9px] font-bold uppercase text-slate-400">{item.type}</span>
                                                    <span className="text-[9px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded border border-green-100">{Math.round(item.confidence * 100)}%</span>
                                                </div>
                                                <p className="text-xs text-slate-800 font-medium line-clamp-3 mb-2">"{item.snippet}"</p>
                                                <div className="text-[10px] text-slate-500 italic mb-2 line-clamp-2">{item.why_it_matters}</div>
                                                <button className="w-full py-1 bg-indigo-50 text-indigo-600 rounded text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                                                    Insert
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-2 text-[10px] text-slate-400 px-1">
                                        <strong>Insight:</strong> {personalizationPack.summary.notes}
                                    </div>
                                </div>
                            ) : (
                                <div className="p-8 text-center text-slate-400 text-xs italic">
                                    Scan website to extract 5-10 specific personalization hooks.
                                </div>
                            )}
                        </div>

                        {/* Variant Selector */}
                        {emailVariantsResult && emailVariantsResult.variants && emailVariantsResult.variants.length > 0 && (
                            <div className="space-y-3">
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex justify-between">
                                    <span>Select Variant Style</span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded border ${emailVariantsResult.guardrail_report.tone_assessment === 'Safe' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-orange-50 border-orange-200 text-orange-700'}`}>
                                        Compliance: {emailVariantsResult.guardrail_report.tone_assessment}
                                    </span>
                                </h4>
                                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-200">
                                    {emailVariantsResult.variants?.map((variant, idx) => (
                                        <div 
                                            key={idx}
                                            onClick={() => applyVariant(variant, idx)}
                                            className={`min-w-[160px] p-3 rounded-xl border cursor-pointer transition-all ${
                                                selectedVariantIndex === idx 
                                                ? 'bg-indigo-600 text-white shadow-md border-indigo-600 ring-2 ring-indigo-200' 
                                                : 'bg-white border-gray-200 hover:border-indigo-300 text-gray-700'
                                            }`}
                                        >
                                            <div className="text-xs font-bold mb-1">{variant.style}</div>
                                            <div className={`text-[10px] ${selectedVariantIndex === idx ? 'text-indigo-200' : 'text-gray-400'}`}>
                                                Conf: {Math.round(variant.confidence_score * 100)}%
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden">
                            <div className="flex justify-between items-center px-4 py-3 border-b border-gray-200 bg-white">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Editor</span>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={handleRunMirror}
                                        disabled={isMirroring || !contentBody}
                                        className="text-xs font-bold flex items-center gap-2 px-3 py-1 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50 shadow-sm"
                                        title="Simulate Cynical Prospect"
                                    >
                                        {isMirroring ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-mask"></i>}
                                        Vibe Check
                                    </button>
                                    <button 
                                        onClick={handleRunCoach} 
                                        disabled={isCoaching || !contentBody}
                                        className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-2 px-3 py-1 bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        {isCoaching ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-graduation-cap"></i>}
                                        SDR Coach
                                    </button>
                                </div>
                            </div>
                            
                            {selectedChannel === 'email' && (
                                <div className="px-4 py-3 border-b border-gray-200 bg-white">
                                    <input 
                                        value={contentSubject}
                                        onChange={e => setContentSubject(e.target.value)}
                                        placeholder="Subject Line..."
                                        className="w-full font-bold text-gray-800 outline-none placeholder-gray-300"
                                    />
                                </div>
                            )}

                            <textarea 
                                value={contentBody} 
                                onChange={e => setContentBody(e.target.value)}
                                placeholder="Draft content will appear here..."
                                className="w-full h-64 p-6 bg-white text-gray-800 text-sm leading-relaxed outline-none font-medium resize-none"
                            />
                        </div>
                        
                        {/* MIRROR / VIBE CHECK RESULTS */}
                        {mirrorResult && (
                            <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-xl overflow-hidden animate-slideDown relative">
                                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                                    <i className="fas fa-user-secret text-8xl text-white"></i>
                                </div>
                                <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xl">🪞</span>
                                            <h3 className="font-bold text-lg text-white">The Mirror Analysis</h3>
                                        </div>
                                        <p className="text-xs text-slate-400 font-medium">Simulated Perspective: <span className="text-indigo-400">{mirrorResult.persona_simulated}</span></p>
                                    </div>
                                    <div className="text-right">
                                        <div className={`text-2xl font-bold ${mirrorResult.survival_score > 70 ? 'text-green-400' : 'text-red-400'}`}>
                                            {mirrorResult.survival_score}%
                                        </div>
                                        <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Survival Probability</div>
                                    </div>
                                </div>
                                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Critique Column */}
                                    <div className="space-y-4">
                                        <h4 className="text-xs font-bold text-red-400 uppercase tracking-widest flex items-center gap-2">
                                            <i className="fas fa-skull"></i> Brutal Critique
                                        </h4>
                                        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-200 text-sm italic leading-relaxed">
                                            "{mirrorResult.cynical_critique}"
                                        </div>
                                        <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Reason for Deletion</span>
                                            <p className="text-xs text-white">{mirrorResult.delete_reason}</p>
                                        </div>
                                    </div>

                                    {/* Rewrite Column */}
                                    <div className="space-y-4">
                                        <h4 className="text-xs font-bold text-green-400 uppercase tracking-widest flex items-center gap-2">
                                            <i className="fas fa-check-circle"></i> The Fix
                                        </h4>
                                        <div className="bg-slate-800 border border-slate-700 p-4 rounded-xl relative group">
                                            {mirrorResult.rewritten_subject && (
                                                <div className="text-xs font-bold text-slate-300 border-b border-slate-700 pb-2 mb-2">
                                                    Subj: {mirrorResult.rewritten_subject}
                                                </div>
                                            )}
                                            <p className="text-sm text-slate-300 whitespace-pre-wrap">{mirrorResult.rewritten_content}</p>
                                            
                                            <button 
                                                onClick={() => applyRewrite({ body: mirrorResult.rewritten_content, subject: mirrorResult.rewritten_subject })}
                                                className="absolute bottom-4 right-4 bg-green-600 hover:bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0"
                                            >
                                                Apply Fix
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* COACH DASHBOARD */}
                        {coachResult && (
                            <div className="bg-white border border-gray-200 rounded-2xl shadow-lg overflow-hidden animate-slideUp">
                                {/* Dashboard Header */}
                                <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-6 text-white flex justify-between items-center">
                                    <div>
                                        <div className="flex items-center gap-3 mb-1">
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xl ${
                                                (coachResult?.scorecard?.overall_score || 0) >= 80 ? 'bg-green-500' : 
                                                (coachResult?.scorecard?.overall_score || 0) >= 60 ? 'bg-yellow-500 text-black' : 'bg-red-500'
                                            }`}>
                                                {coachResult?.scorecard?.overall_score || 0}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-lg">Coach Feedback</h3>
                                                <p className="text-xs text-gray-400 uppercase tracking-wide font-bold">{coachResult?.scorecard?.grade || 'N/A'} Grade</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => setActiveCoachTab('scorecard')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeCoachTab === 'scorecard' ? 'bg-white/20 text-white' : 'hover:bg-white/10 text-gray-400'}`}>Scorecard</button>
                                        <button onClick={() => setActiveCoachTab('rewrites')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeCoachTab === 'rewrites' ? 'bg-white/20 text-white' : 'hover:bg-white/10 text-gray-400'}`}>Rewrites</button>
                                        <button onClick={() => setActiveCoachTab('experiments')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeCoachTab === 'experiments' ? 'bg-white/20 text-white' : 'hover:bg-white/10 text-gray-400'}`}>Experiments</button>
                                    </div>
                                </div>

                                {/* Dashboard Content */}
                                <div className="p-6">
                                    {activeCoachTab === 'scorecard' && (
                                        <div className="space-y-6">
                                            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                                                {Object.entries(coachResult?.scorecard?.category_scores || {}).map(([key, value]) => {
                                                    const score = value as number;
                                                    return (
                                                        <div key={key} className="flex flex-col gap-1">
                                                            <div className="flex justify-between text-xs font-bold uppercase text-gray-500">
                                                                <span>{key.replace(/_/g, ' ')}</span>
                                                                <span>{score}/20</span>
                                                            </div>
                                                            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                                                <div 
                                                                    className={`h-full rounded-full ${score >= 15 ? 'bg-green-500' : score >= 10 ? 'bg-yellow-500' : 'bg-red-500'}`} 
                                                                    style={{width: `${(score/20)*100}%`}}
                                                                ></div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                                <h4 className="text-xs font-bold text-gray-800 uppercase mb-3 flex items-center gap-2"><i className="fas fa-stethoscope text-indigo-500"></i> Diagnosis</h4>
                                                <ul className="space-y-3">
                                                    {coachResult?.diagnosis?.line_level_notes?.map((note, idx) => (
                                                        <li key={idx} className="text-sm text-gray-600 border-l-2 border-indigo-200 pl-3">
                                                            <span className="font-bold text-red-500 block text-xs uppercase mb-0.5">{note.issue}</span>
                                                            <p className="mb-1">"{note.snippet}"</p>
                                                            <p className="text-indigo-600 font-medium text-xs"><i className="fas fa-arrow-right mr-1"></i> {note.recommendation}</p>
                                                        </li>
                                                    ))}
                                                    {(!coachResult?.diagnosis?.line_level_notes || coachResult.diagnosis.line_level_notes.length === 0) && (
                                                        <li className="text-sm text-gray-400 italic">No specific diagnosis notes available.</li>
                                                    )}
                                                </ul>
                                            </div>
                                        </div>
                                    )}

                                    {activeCoachTab === 'rewrites' && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {coachResult?.rewrites?.map((rewrite, idx) => (
                                                <div key={idx} className="border border-gray-200 rounded-xl p-4 hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer group" onClick={() => applyRewrite(rewrite)}>
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-1 rounded uppercase">{rewrite.purpose}</span>
                                                        <span className="text-[10px] text-gray-400">{rewrite.character_count_body} chars</span>
                                                    </div>
                                                    {rewrite.subject && <p className="text-xs font-bold text-gray-800 mb-2 border-b border-gray-100 pb-2">Subj: {rewrite.subject}</p>}
                                                    <p className="text-xs text-gray-600 whitespace-pre-wrap">{rewrite.body}</p>
                                                    <div className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity flex justify-end">
                                                        <span className="text-indigo-600 text-xs font-bold">Click to Apply</span>
                                                    </div>
                                                </div>
                                            ))}
                                            {(!coachResult?.rewrites || coachResult.rewrites.length === 0) && (
                                                <div className="col-span-2 text-center text-gray-400 py-4 italic">No rewrites generated.</div>
                                            )}
                                        </div>
                                    )}

                                    {activeCoachTab === 'experiments' && (
                                        <div className="space-y-6">
                                            <div>
                                                <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">A/B Subject Line Tests</h4>
                                                <div className="grid grid-cols-1 gap-3">
                                                    {coachResult?.experiments?.ab_subjects?.map((exp, idx) => (
                                                        <div key={idx} className="bg-gray-50 p-3 rounded-lg border border-gray-200 flex justify-between items-center">
                                                            <div>
                                                                <span className="text-xs font-bold text-gray-800 block mb-1">Variant {exp.variant}: {exp.subject}</span>
                                                                <span className="text-[10px] text-gray-500 italic">{exp.hypothesis}</span>
                                                            </div>
                                                            <button onClick={() => setContentSubject(exp.subject || '')} className="text-xs bg-white border border-gray-200 px-2 py-1 rounded hover:bg-gray-100">Use</button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-6">
                                                <div>
                                                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">Hook Tests</h4>
                                                    <ul className="space-y-2">
                                                        {coachResult?.experiments?.hook_tests?.map((test, i) => (
                                                            <li key={i} className="text-xs text-gray-600 bg-white p-2 rounded border border-gray-100">
                                                                <strong>{test.test_name}:</strong> {test.hook_line}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                                <div>
                                                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">CTA Tests</h4>
                                                    <ul className="space-y-2">
                                                        {coachResult?.experiments?.cta_tests?.map((test, i) => (
                                                            <li key={i} className="text-xs text-gray-600 bg-white p-2 rounded border border-gray-100">
                                                                "{test.cta}"
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ACTION FOOTER */}
            {contentBody && step === 'generate' && (
                <div className="p-6 border-t border-gray-100 bg-white flex justify-end">
                    {approvalSent ? (
                        <div className="bg-orange-100 text-orange-800 px-6 py-3 rounded-2xl text-sm font-bold flex items-center gap-3 animate-pulse">
                            <i className="fas fa-lock"></i> Pending Compliance Approval
                        </div>
                    ) : (
                        <button onClick={handleSend} className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">
                            Execute Outreach <i className="fas fa-paper-plane ml-2"></i>
                        </button>
                    )}
                </div>
            )}
            
            {/* EMPTY STATE */}
            {step === 'research' && !agentRunning && !researchAnalysis && !deepResearchResult && !screenScanResult && !micrositeResult && !videoAnalysisResult && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-10">
                    <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-6">
                        <i className="fas fa-wand-magic-sparkles text-3xl text-indigo-400"></i>
                    </div>
                    <p className="text-gray-400 font-medium">Initiate research to begin strategic analysis.</p>
                </div>
            )}
          </div>
        </div>
      </div>

      {/* ROLEPLAY MODAL */}
      {showRoleplay && activeProspect && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fadeIn">
              <div className="bg-white w-full max-w-4xl h-[80vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden relative">
                  {/* Header */}
                  <div className="p-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center shrink-0">
                      <div>
                          <div className="flex items-center gap-3 mb-1">
                              <span className="text-xl">🥷</span>
                              <h3 className="font-bold text-slate-800 text-lg">Pre-Call Sparring Arena</h3>
                          </div>
                          <p className="text-xs text-slate-500">Simulating <span className="font-bold text-indigo-600">{activeProspect.name}</span> ({activeProspect.title})</p>
                      </div>
                      <div className="flex gap-3">
                          <button onClick={handleEndRoleplay} disabled={roleplayHistory.length === 0} className="text-xs font-bold text-rose-600 border border-rose-200 bg-rose-50 px-4 py-2 rounded-lg hover:bg-rose-100 transition-colors">
                              End & Evaluate
                          </button>
                          <button onClick={() => setShowRoleplay(false)} className="text-slate-400 hover:text-slate-600">
                              <i className="fas fa-times text-xl"></i>
                          </button>
                      </div>
                  </div>

                  {/* Chat Area */}
                  <div className="flex-1 flex overflow-hidden">
                      {/* Chat Messages */}
                      <div className="flex-1 bg-slate-100 p-6 overflow-y-auto space-y-4">
                          {roleplayHistory.length === 0 ? (
                              <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                                  <i className="fas fa-comments text-5xl mb-4 text-slate-300"></i>
                                  <p className="text-sm font-medium">Type your opening pitch to start the simulation.</p>
                                  <p className="text-xs mt-2 italic">Expect skepticism. Be prepared.</p>
                              </div>
                          ) : (
                              roleplayHistory.map((msg, idx) => (
                                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                      <div className={`max-w-[70%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${
                                          msg.role === 'user' 
                                          ? 'bg-indigo-600 text-white rounded-tr-none' 
                                          : 'bg-white text-slate-700 border border-slate-200 rounded-tl-none'
                                      }`}>
                                          {msg.content}
                                      </div>
                                  </div>
                              ))
                          )}
                          {isRoleplaying && (
                              <div className="flex justify-start">
                                  <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-slate-200 shadow-sm flex items-center gap-2 text-slate-400 text-xs">
                                      <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
                                      <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-75"></span>
                                      <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-150"></span>
                                  </div>
                              </div>
                          )}
                          <div ref={roleplayEndRef} />
                      </div>

                      {/* Feedback Panel (Shows after end) */}
                      {roleplayFeedback && (
                          <div className="w-80 bg-white border-l border-slate-200 p-6 overflow-y-auto animate-slideLeft">
                              <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wide mb-6 flex items-center gap-2">
                                  <i className="fas fa-clipboard-check text-emerald-500"></i> Session Report
                              </h4>
                              
                              <div className="mb-6 text-center">
                                  <div className={`text-4xl font-extrabold ${roleplayFeedback.score >= 80 ? 'text-emerald-500' : roleplayFeedback.score >= 60 ? 'text-amber-500' : 'text-red-500'}`}>
                                      {roleplayFeedback.score}
                                  </div>
                                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Performance Score</span>
                              </div>

                              <div className="space-y-6">
                                  <div>
                                      <span className="text-xs font-bold text-emerald-600 block mb-2"><i className="fas fa-check-circle mr-1"></i> Strengths</span>
                                      <ul className="text-xs text-slate-600 space-y-1">
                                          {roleplayFeedback.strengths.map((s, i) => <li key={i}>• {s}</li>)}
                                      </ul>
                                  </div>
                                  <div>
                                      <span className="text-xs font-bold text-red-500 block mb-2"><i className="fas fa-exclamation-circle mr-1"></i> Weaknesses</span>
                                      <ul className="text-xs text-slate-600 space-y-1">
                                          {roleplayFeedback.weaknesses.map((w, i) => <li key={i}>• {w}</li>)}
                                      </ul>
                                  </div>
                                  <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                                      <span className="text-[10px] font-bold text-indigo-500 uppercase block mb-1">Coach's Tip</span>
                                      <p className="text-xs text-indigo-800 italic">"{roleplayFeedback.coach_tip}"</p>
                                  </div>
                              </div>
                          </div>
                      )}
                  </div>

                  {/* Input Area */}
                  {!roleplayFeedback && (
                      <div className="p-4 bg-white border-t border-slate-200">
                          <div className="flex gap-2">
                              <input 
                                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                                  placeholder="Type your response..."
                                  value={roleplayInput}
                                  onChange={e => setRoleplayInput(e.target.value)}
                                  onKeyPress={e => e.key === 'Enter' && handleSendRoleplay()}
                                  autoFocus
                              />
                              <button 
                                  onClick={handleSendRoleplay}
                                  disabled={!roleplayInput || isRoleplaying}
                                  className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-md"
                              >
                                  <i className="fas fa-paper-plane"></i>
                              </button>
                          </div>
                      </div>
                  )}
              </div>
          </div>
      )}

      {/* PERSONA BUILDER MODAL */}
      {showPersonaBuilder && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fadeIn">
              <div className="bg-white w-full max-w-4xl h-[85vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden relative">
                  {/* Header */}
                  <div className="p-6 bg-gradient-to-r from-purple-600 to-indigo-600 text-white flex justify-between items-center shrink-0">
                      <div>
                          <div className="flex items-center gap-3 mb-1">
                              <span className="text-2xl"><i className="fas fa-fingerprint"></i></span>
                              <h3 className="font-bold text-xl">Vibe Matcher</h3>
                          </div>
                          <p className="text-xs text-indigo-200">Multi-Document Persona Reconstruction</p>
                      </div>
                      <button onClick={() => setShowPersonaBuilder(false)} className="text-white/60 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all">
                          <i className="fas fa-times text-lg"></i>
                      </button>
                  </div>

                  {/* Body */}
                  <div className="flex-1 flex overflow-hidden">
                      {/* Left: Upload & Context */}
                      <div className="w-1/3 bg-slate-50 border-r border-slate-200 p-6 flex flex-col">
                          <div className="mb-6">
                              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Context Source</h4>
                              <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-indigo-400 hover:bg-indigo-50 transition-all cursor-pointer group" onClick={() => docInputRef.current?.click()}>
                                  <div className="w-12 h-12 bg-white rounded-full mx-auto flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform">
                                      <i className="fas fa-cloud-upload-alt text-indigo-500 text-xl"></i>
                                  </div>
                                  <p className="text-sm font-bold text-slate-700">Upload Documents</p>
                                  <p className="text-[10px] text-slate-400 mt-1">PDFs, Articles, Posts (Max 1M tokens)</p>
                                  <input 
                                      type="file" 
                                      multiple 
                                      ref={docInputRef} 
                                      className="hidden" 
                                      onChange={handleDocUpload}
                                      accept=".pdf,.txt,.md,.doc,.docx"
                                  />
                              </div>
                          </div>

                          <div className="flex-1 overflow-y-auto mb-4">
                              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Staged Files ({uploadedDocs.length})</h4>
                              <div className="space-y-2">
                                  {uploadedDocs.map((file, i) => (
                                      <div key={i} className="bg-white p-2 rounded-lg border border-slate-200 flex items-center gap-2 text-xs shadow-sm">
                                          <i className="fas fa-file-alt text-slate-400"></i>
                                          <span className="truncate flex-1 font-medium text-slate-600">{file.name}</span>
                                          <span className="text-[10px] text-slate-400">{Math.round(file.size / 1024)}KB</span>
                                      </div>
                                  ))}
                                  {uploadedDocs.length === 0 && (
                                      <p className="text-xs text-slate-400 italic text-center py-4">No files added yet.</p>
                                  )}
                              </div>
                          </div>

                          <button 
                              onClick={handleBuildPersona}
                              disabled={uploadedDocs.length === 0 || isBuildingPersona}
                              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
                          >
                              {isBuildingPersona ? <><i className="fas fa-circle-notch fa-spin"></i> Analyzing Corpus...</> : <><i className="fas fa-magic"></i> Generate Blueprint</>}
                          </button>
                      </div>

                      {/* Right: Blueprint Result */}
                      <div className="flex-1 p-8 overflow-y-auto bg-white">
                          {!voiceBlueprint ? (
                              <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-60">
                                  <i className="fas fa-id-card-alt text-6xl mb-4"></i>
                                  <p className="font-bold text-lg">Awaiting Persona Construction</p>
                                  <p className="text-xs mt-2">Upload documents to unlock the Voice Blueprint.</p>
                              </div>
                          ) : (
                              <div className="animate-fadeIn space-y-8">
                                  <div className="flex items-start justify-between">
                                      <div>
                                          <span className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-1 block">Identified Archetype</span>
                                          <h2 className="text-3xl font-extrabold text-slate-900">{voiceBlueprint.archetype}</h2>
                                          <p className="text-slate-500 mt-2 text-sm leading-relaxed max-w-lg">{voiceBlueprint.description}</p>
                                      </div>
                                      <div className="flex flex-wrap gap-2 max-w-xs justify-end">
                                          {voiceBlueprint.tone_keywords.map((k, i) => (
                                              <span key={i} className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold border border-slate-200 uppercase">{k}</span>
                                          ))}
                                      </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-8">
                                      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-4">Communication DNA</h4>
                                          <div className="space-y-4">
                                              {Object.entries(voiceBlueprint.communication_traits).map(([trait, val]) => (
                                                  <div key={trait}>
                                                      <div className="flex justify-between text-xs font-bold text-slate-600 mb-1">
                                                          <span className="capitalize">{trait.replace('_', ' ')}</span>
                                                          <span>{val}/100</span>
                                                      </div>
                                                      <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                                                          <div className="h-full bg-indigo-500 rounded-full" style={{width: `${val}%`}}></div>
                                                      </div>
                                                  </div>
                                              ))}
                                          </div>
                                      </div>

                                      <div className="space-y-4">
                                          <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                                              <h4 className="text-xs font-bold text-green-700 uppercase tracking-wide mb-2 flex items-center gap-2"><i className="fas fa-check-circle"></i> Do's</h4>
                                              <ul className="text-xs text-green-800 space-y-1.5">
                                                  {voiceBlueprint.messaging_rules.do.map((rule, i) => <li key={i}>• {rule}</li>)}
                                              </ul>
                                          </div>
                                          <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                                              <h4 className="text-xs font-bold text-red-700 uppercase tracking-wide mb-2 flex items-center gap-2"><i className="fas fa-times-circle"></i> Don'ts</h4>
                                              <ul className="text-xs text-red-800 space-y-1.5">
                                                  {voiceBlueprint.messaging_rules.dont.map((rule, i) => <li key={i}>• {rule}</li>)}
                                              </ul>
                                          </div>
                                      </div>
                                  </div>

                                  <div className="bg-white border border-indigo-100 p-5 rounded-xl shadow-sm">
                                      <h4 className="text-xs font-bold text-indigo-500 uppercase tracking-wide mb-2">Voice Sample</h4>
                                      <p className="font-serif text-lg text-slate-700 italic">"{voiceBlueprint.sample_phrasing}"</p>
                                  </div>
                              </div>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default OutreachView;
