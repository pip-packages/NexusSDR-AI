
import React, { useState, useEffect } from 'react';
import { MessageThread, CompanyInfo, Prospect, ProspectMemory, ResponseClassification, HandoffDocument, ThreadMessage, HandoffContext, ObjectionResponse, ProcessingResult, SentimentIntentAnalysis, EscalationContext, FollowUpPlan } from '../types';
import { handleObjection, analyzeInteraction, classifyResponse, generateAutoResponse, objectionHandlerEngine, intelligentResponseProcessor, sentimentAndIntentAnalyzer, runFollowUpAgent } from '../services/geminiService';
import { crmService } from '../services/crmService';
import { memoryService } from '../services/memoryService';
import { meetingService } from '../services/meetingService';
import { workflowService } from '../services/workflowService';
import { collaborationService } from '../services/collaborationService';

interface InboxViewProps {
  inbox: MessageThread[];
  company: CompanyInfo;
  prospects: Prospect[];
  onReply: (threadId: string, message: ThreadMessage) => void;
  onBookMeeting: (threadId: string, prospectId: string) => void;
}

const InboxView: React.FC<InboxViewProps> = ({ inbox, company, prospects, onReply, onBookMeeting }) => {
  const [activeThreadId, setActiveThreadId] = useState<string | null>(inbox[0]?.id || null);
  const [replyText, setReplyText] = useState('');
  const [activeChannel, setActiveChannel] = useState<'email' | 'linkedin'>('email');
  const [isHandlingObjection, setIsHandlingObjection] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [booking, setBooking] = useState(false);
  const [activeMemory, setActiveMemory] = useState<ProspectMemory | null>(null);
  
  // Classification & Meeting State
  const [classification, setClassification] = useState<ResponseClassification | null>(null);
  const [isClassifying, setIsClassifying] = useState(false);
  const [handoffDoc, setHandoffDoc] = useState<HandoffDocument | null>(null);
  const [generatingDoc, setGeneratingDoc] = useState(false);

  // Escalation State
  const [showHandoffModal, setShowHandoffModal] = useState(false);
  const [generatingHandoff, setGeneratingHandoff] = useState(false);
  const [handoffContext, setHandoffContext] = useState<HandoffContext | undefined>(undefined);

  // Objection Intelligence
  const [objectionAnalysis, setObjectionAnalysis] = useState<ObjectionResponse | null>(null);

  // Autonomous Processing State
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Sentiment & Intent Analysis State
  const [analyzingSentiment, setAnalyzingSentiment] = useState(false);
  const [activeAnalysis, setActiveAnalysis] = useState<SentimentIntentAnalysis | null>(null);

  // Follow-Up Planner State
  const [isPlanningFollowUp, setIsPlanningFollowUp] = useState(false);
  const [followUpPlan, setFollowUpPlan] = useState<FollowUpPlan | null>(null);

  const activeThread = inbox.find(t => t.id === activeThreadId);

  useEffect(() => {
    if (activeThread && activeThread.messages) {
        const memory = memoryService.getMemory(activeThread.prospectId);
        setActiveMemory(memory);
        setClassification(null);
        setHandoffDoc(null);
        setHandoffContext(activeThread.escalationContext);
        setObjectionAnalysis(null);
        setProcessingResult(null); 
        setActiveAnalysis(null);
        setFollowUpPlan(null);
        
        const lastMsg = activeThread.messages[activeThread.messages.length - 1];
        if (lastMsg && (lastMsg.channel === 'linkedin' || lastMsg.channel === 'email')) {
            setActiveChannel(lastMsg.channel);
        }

        if (lastMsg && lastMsg.role === 'prospect') {
             runClassification(lastMsg.content, activeThread.prospectId).then((cls) => {
                 checkEscalation(activeThread, lastMsg.content, cls);
             });
             
             if (memory) {
                 runAnalysis(lastMsg.content, activeThread.prospectId, memory);
             }
        }
    }
  }, [activeThreadId, activeThread?.messages?.length]);

  const checkEscalation = async (thread: MessageThread, messageContent: string, classificationResult?: ResponseClassification) => {
      if (thread.isEscalated) return;

      const prospect = prospects.find(p => p.id === thread.prospectId);
      if (!prospect) return;

      const context: EscalationContext = {
          prospectId: thread.prospectId,
          threadId: thread.id,
          messageContent: messageContent,
          prospectTitle: prospect.title,
          companyName: prospect.company,
          intent: classificationResult?.intent,
          messages: thread.messages
      };

      setGeneratingHandoff(true);
      const decision = await collaborationService.intelligentEscalationRouter(context, prospect);
      
      if (decision.shouldEscalate) {
          thread.isEscalated = true;
          thread.status = 'escalated';
          thread.escalationContext = decision.package;
          setHandoffContext(decision.package);
          
          workflowService.trigger('ESCALATION_TRIGGERED', thread.prospectName, { 
              reason: decision.reason, 
              level: decision.level 
          });
      }
      setGeneratingHandoff(false);
  };

  const runClassification = async (message: string, prospectId: string) => {
      setIsClassifying(true);
      const prospect = prospects.find(p => p.id === prospectId);
      const context = {
          title: prospect?.title,
          company: prospect?.company,
          status: prospect?.status,
          memory_highlights: activeMemory ? {
              pain_points: activeMemory.extracted_intelligence.stated_pain_points,
              history_len: activeMemory.interaction_history.length
          } : {}
      };

      const result = await classifyResponse(message, context);
      setClassification(result);
      setIsClassifying(false);

      if (result.action === 'auto_respond' && !activeThread?.isEscalated && result.intent !== 'objection') {
          const draft = await generateAutoResponse(result, company, prospect?.name || 'Prospect');
          setReplyText(draft);
      }
      return result;
  };

  const runAnalysis = async (content: string, prospectId: string, memory: ProspectMemory) => {
    setIsAnalyzing(true);
    try {
        const result = await analyzeInteraction(content, memory);
        
        memoryService.updateIntelligence(prospectId, result.intelligenceUpdates);
        memoryService.updateBehavior(prospectId, result.behaviorUpdates);
        memoryService.addInteraction(prospectId, {
            date: new Date().toISOString(),
            channel: 'email',
            direction: 'inbound',
            content_summary: content.substring(0, 50) + '...',
            outcome: 'received',
            sentiment: result.sentiment,
            intent: result.intent
        });
        
        setActiveMemory(memoryService.getMemory(prospectId));
    } catch (e) {
        console.error(e);
    }
    setIsAnalyzing(false);
  };

  const handleManualReply = () => {
    if (!replyText || !activeThreadId || !activeThread) return;
    
    memoryService.addInteraction(activeThread.prospectId, {
        date: new Date().toISOString(),
        channel: activeChannel,
        direction: 'outbound',
        content_summary: replyText.substring(0, 50) + '...',
        outcome: 'replied_manual'
    });

    onReply(activeThreadId, {
      role: 'sdr',
      channel: activeChannel,
      content: replyText,
      timestamp: new Date().toISOString(),
      status: 'sent',
      type: 'manual_reply'
    });
    setReplyText('');
    setObjectionAnalysis(null);
    setProcessingResult(null);
    setActiveAnalysis(null);
    setFollowUpPlan(null);
    
    if (activeThread.isEscalated) {
        activeThread.isEscalated = false;
        activeThread.status = 'replied';
        setHandoffContext(undefined);
    }
  };

  const handleAISuggestion = async () => {
    if (!activeThread) return;
    setIsHandlingObjection(true);
    setObjectionAnalysis(null);
    
    const lastProspectMsg = [...activeThread.messages].reverse().find(m => m.role === 'prospect');
    if (!lastProspectMsg) return;

    const prospect = prospects.find(p => p.id === activeThread.prospectId);
    if (!prospect) return;

    const analysis = await objectionHandlerEngine(
        lastProspectMsg.content,
        prospect,
        activeThread.messages,
        { ...company, ...{ name: "Me", title: "SDR", email: "", tone: "professional", personalizationDepth: "moderate" } }
    );

    setObjectionAnalysis(analysis);
    setReplyText(analysis.response_text);
    setIsHandlingObjection(false);
  };

  const handleAutoPilot = async () => {
      if (!activeThread) return;
      setIsProcessing(true);
      setProcessingResult(null);

      const lastMsg = activeThread.messages[activeThread.messages.length - 1];
      const prospect = prospects.find(p => p.id === activeThread.prospectId);
      
      if (!lastMsg || lastMsg.role !== 'prospect' || !prospect) {
          setIsProcessing(false);
          return;
      }

      const result = await intelligentResponseProcessor(
          lastMsg,
          prospect,
          activeThread.messages,
          { ...company, ...{ name: "Me", title: "SDR", email: "", tone: "professional", personalizationDepth: "moderate" } }
      );

      setProcessingResult(result);
      
      if (result.actionTaken === 'replied' && result.responseSent) {
          onReply(activeThread.id, {
              role: 'sdr',
              channel: activeChannel,
              content: result.responseSent,
              timestamp: new Date().toISOString(),
              status: 'sent',
              type: 'auto_pilot'
          });
      }

      setIsProcessing(false);
  };

  const handleDeepAnalysis = async () => {
      if (!activeThread) return;
      setAnalyzingSentiment(true);
      setActiveAnalysis(null);

      const lastMsg = activeThread.messages[activeThread.messages.length - 1];
      const prospect = prospects.find(p => p.id === activeThread.prospectId);

      if (!lastMsg || !prospect) {
          setAnalyzingSentiment(false);
          return;
      }

      const result = await sentimentAndIntentAnalyzer(lastMsg.content, activeThread.messages, prospect);
      setActiveAnalysis(result);
      setAnalyzingSentiment(false);
  };

  const handleGenerateFollowUp = async () => {
      if (!activeThread) return;
      setIsPlanningFollowUp(true);
      setFollowUpPlan(null);

      const prospect = prospects.find(p => p.id === activeThread.prospectId);
      const lastMsg = activeThread.messages[activeThread.messages.length - 1];

      if (!prospect || !lastMsg) {
          setIsPlanningFollowUp(false);
          return;
      }

      try {
          const plan = await runFollowUpAgent(prospect, lastMsg, company, activeThread.messages);
          setFollowUpPlan(plan);
      } catch (e) {
          console.error("Follow-Up Agent failed", e);
      }
      setIsPlanningFollowUp(false);
  };

  const handleBookMeeting = async () => {
    if (!activeThread) return;
    setBooking(true);
    const prospect = prospects.find(p => p.id === activeThread.prospectId);
    
    if (prospect) {
        await crmService.createDeal(prospect);
        await crmService.syncContact({ ...prospect, status: 'booked' });
        const memory = memoryService.getMemory(prospect.id);
        if (memory) {
            memory.lead_status = 'booked';
            memoryService.saveMemory(memory);
        }
        workflowService.trigger('MEETING_BOOKED', activeThread.prospectName);
    }
    onBookMeeting(activeThread.id, activeThread.prospectId);
    setBooking(false);
  };

  const handleGenerateBrief = async () => {
      if (!activeThread) return;
      const prospect = prospects.find(p => p.id === activeThread.prospectId);
      if (!prospect) return;

      setGeneratingDoc(true);
      const doc = await collaborationService.contextHandoffGenerator(prospect, 'meeting_prep');
      setHandoffDoc(doc);
      setGeneratingDoc(false);
  };

  const handleSendNudge = () => {
      const lastMsgDate = activeThread?.messages[activeThread.messages.length - 1].timestamp || "";
      const status = meetingService.getConversionStatus(lastMsgDate);
      const nudge = meetingService.getNudgeStrategy(status === 'on_track' ? 'needs_nudge' : status);
      setReplyText(`[AI Nudge Draft]: Hi ${activeThread?.prospectName.split(' ')[0]}, ${nudge}`);
  };

  if (inbox.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400">
        <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6">
            <i className="fas fa-inbox text-4xl text-slate-300"></i>
        </div>
        <h2 className="text-2xl font-bold text-slate-700 mb-2">Inbox is Empty</h2>
        <p className="text-slate-500">Start outreach to prospects to see conversations here.</p>
      </div>
    );
  }

  const getUrgencyColor = (urgency?: string) => {
      switch(urgency) {
          case 'hot': return 'bg-rose-500 text-white shadow-rose-200';
          case 'warm': return 'bg-amber-500 text-white shadow-amber-200';
          case 'cool': return 'bg-blue-400 text-white shadow-blue-200';
          case 'cold': return 'bg-slate-400 text-white';
          default: return 'bg-slate-400 text-white';
      }
  };

  return (
    <div className="h-[calc(100vh-140px)] flex gap-6 animate-fadeIn pb-4">
      {/* LEFT SIDEBAR: CONVERSATION LIST */}
      <div className="w-80 flex flex-col space-y-4">
        <h2 className="text-xl font-bold text-slate-800 px-1">Conversations</h2>
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-y-auto">
          {inbox.map((thread) => {
             const messages = thread.messages || [];
             if (messages.length === 0) return null;
             const lastMsg = messages[messages.length - 1];
             
             const date = new Date(lastMsg.timestamp);
             const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
             const isActive = activeThreadId === thread.id;
             
             const hasLinkedin = thread.activeChannels?.includes('linkedin') || messages.some(m => m.channel === 'linkedin');
             const hasEmail = thread.activeChannels?.includes('email') || messages.some(m => m.channel === 'email');

             return (
              <div 
                key={thread.id} 
                onClick={() => setActiveThreadId(thread.id)}
                className={`p-4 cursor-pointer transition-all border-b border-slate-50 ${isActive ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}
              >
                <div className="flex justify-between items-start mb-1.5">
                  <div className="flex items-center gap-2 overflow-hidden">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-indigo-500' : 'bg-transparent'}`}></div>
                      <p className={`text-sm truncate ${isActive ? 'font-bold text-indigo-900' : 'font-semibold text-slate-700'}`}>{thread.prospectName}</p>
                  </div>
                  <span className="text-[10px] text-slate-400 whitespace-nowrap ml-2">{timeStr}</span>
                </div>
                <div className="pl-4">
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {lastMsg.content}
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                        <div className="flex gap-2 text-slate-400">
                            {hasEmail && <i className="fas fa-envelope text-[10px]" title="Email"></i>}
                            {hasLinkedin && <i className="fab fa-linkedin text-[10px]" title="LinkedIn"></i>}
                        </div>
                        {thread.isEscalated && (
                            <span className="inline-block px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                                <i className="fas fa-exclamation-circle"></i> Escalated
                            </span>
                        )}
                        {thread.status === 'booked' && (
                            <span className="inline-block px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[9px] font-bold uppercase tracking-wider">
                                Booked
                            </span>
                        )}
                    </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT SIDE: UNIFIED THREAD VIEW */}
      <div className="flex-1 bg-white rounded-3xl shadow-lg shadow-slate-200/50 border border-slate-200 flex flex-col overflow-hidden relative">
        {activeThread && activeThread.messages ? (
          <>
            {/* THREAD HEADER */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white/80 backdrop-blur-sm z-10 sticky top-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xl relative shadow-inner">
                  {activeThread.prospectName[0]}
                  <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 border-2 border-white rounded-full ${
                      activeThread.status === 'replied' ? 'bg-emerald-500' : 
                      activeThread.status === 'booked' ? 'bg-indigo-600' : 
                      activeThread.isEscalated ? 'bg-red-500' : 'bg-slate-400'
                  }`}></span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">{activeThread.prospectName}</h3>
                  <div className="flex items-center gap-3 text-xs mt-0.5">
                     {activeThread.status === 'booked' ? (
                        <span className="text-indigo-600 font-bold flex items-center gap-1 bg-indigo-50 px-2 py-0.5 rounded-full">
                           <i className="fas fa-check-circle"></i> Meeting Booked
                        </span>
                     ) : activeThread.isEscalated ? (
                        <span className="text-red-600 font-bold flex items-center gap-1 bg-red-50 px-2 py-0.5 rounded-full">
                           <i className="fas fa-exclamation-triangle"></i> Escalated
                        </span>
                     ) : (
                        <span className="text-slate-500 flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-full capitalize">
                           {activeThread.status}
                        </span>
                     )}
                     <div className="h-3 w-[1px] bg-slate-200"></div>
                     <div className="flex gap-2 text-slate-400">
                        {activeThread.activeChannels?.includes('email') && <span title="Email Active"><i className="fas fa-envelope"></i></span>}
                        {activeThread.activeChannels?.includes('linkedin') && <span title="LinkedIn Active"><i className="fab fa-linkedin text-[#0077b5]"></i></span>}
                     </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {!activeThread.isEscalated && activeThread.status !== 'booked' && (
                    <button 
                        onClick={handleAutoPilot}
                        disabled={isProcessing}
                        className="text-xs bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:shadow-lg hover:shadow-purple-200 transition-all flex items-center gap-2"
                    >
                        {isProcessing ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-robot"></i>}
                        Auto-Pilot
                    </button>
                )}

                {activeThread.isEscalated && (
                    <button 
                        onClick={() => setShowHandoffModal(true)}
                        className="text-xs bg-red-50 text-red-600 px-4 py-2 rounded-xl border border-red-200 font-bold hover:bg-red-100 transition-colors animate-pulse flex items-center gap-2"
                    >
                        <i className="fas fa-file-medical"></i> Handoff Packet
                    </button>
                )}
                
                {activeThread.status !== 'booked' && (
                    <button 
                        onClick={handleBookMeeting}
                        disabled={booking}
                        className="text-xs font-bold text-slate-600 bg-white border border-slate-200 px-4 py-2 rounded-xl hover:bg-slate-50 transition-colors"
                    >
                        {booking ? <><i className="fas fa-circle-notch fa-spin mr-2"></i> Syncing...</> : 'Mark Booked'}
                    </button>
                )}
              </div>
            </div>

            {/* MESSAGES TIMELINE */}
            <div className="flex-1 p-8 overflow-y-auto space-y-8 bg-slate-50/50">
              
              {activeThread.isEscalated && (
                  <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center justify-between shadow-sm animate-slideDown">
                      <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-white text-red-600 rounded-full flex items-center justify-center shrink-0 border border-red-100 shadow-sm">
                              <i className="fas fa-user-headset text-lg"></i>
                          </div>
                          <div>
                              <h4 className="font-bold text-red-800 text-sm">Human Intervention Required</h4>
                              <p className="text-xs text-red-600 mt-0.5">Reason: {handoffContext?.reason || "High Sensitivity Detected"}</p>
                          </div>
                      </div>
                      <div className="text-right">
                          <p className="text-[10px] uppercase font-bold text-red-400 tracking-wider">SLA Target</p>
                          <p className="text-xs font-bold text-red-700">{handoffContext?.sla?.replace(/_/g, ' ') || 'Immediate'}</p>
                      </div>
                  </div>
              )}

              {processingResult && (
                  <div className="bg-gradient-to-br from-purple-50 to-white border border-purple-200 p-5 rounded-2xl shadow-sm animate-fadeIn flex flex-col gap-3 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-purple-100 rounded-full -mr-10 -mt-10 opacity-50 blur-xl pointer-events-none"></div>
                      <div className="flex items-center justify-between relative z-10">
                          <h4 className="text-xs font-bold text-purple-800 uppercase tracking-widest flex items-center gap-2">
                              <i className="fas fa-microchip"></i> Auto-Pilot Execution
                          </h4>
                          <span className="text-[10px] bg-white/80 px-2 py-0.5 rounded border border-purple-100 text-purple-600 font-mono">
                              {processingResult.processingTime}ms
                          </span>
                      </div>
                      <div className="grid grid-cols-2 gap-6 text-xs relative z-10">
                          <div>
                              <span className="font-bold text-purple-400 block mb-1 uppercase text-[10px]">Classification</span>
                              <div className="flex gap-2">
                                  <span className="bg-purple-100 px-2 py-1 rounded-md text-purple-800 font-bold capitalize">{processingResult.classification?.intent?.replace(/_/g, ' ') || 'Unknown'}</span>
                                  <span className="bg-white border border-purple-200 px-2 py-1 rounded-md text-purple-700 font-medium capitalize">{processingResult.classification.urgency}</span>
                              </div>
                          </div>
                          <div>
                              <span className="font-bold text-purple-400 block mb-1 uppercase text-[10px]">Workflow Actions</span>
                              <ul className="space-y-1">
                                  {processingResult.crmUpdates?.map((u, i) => <li key={i} className="text-slate-600 flex items-center gap-1.5"><i className="fas fa-check text-green-500"></i> {u}</li>)}
                                  {processingResult.nextSteps?.map((s, i) => <li key={`step_${i}`} className="text-slate-600 flex items-center gap-1.5"><i className="fas fa-arrow-right text-purple-400"></i> {s}</li>)}
                              </ul>
                          </div>
                      </div>
                  </div>
              )}

              {activeThread.messages.map((msg, idx) => {
                 const isSdr = msg.role === 'sdr';
                 const isLinkedin = msg.channel === 'linkedin';
                 const isLatestProspect = !isSdr && idx === activeThread.messages.length - 1;

                 return (
                    <div key={idx} className={`flex w-full ${isSdr ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] group relative flex flex-col ${isSdr ? 'items-end' : 'items-start'}`}>
                            
                            <div className={`p-5 rounded-2xl shadow-sm text-sm leading-relaxed whitespace-pre-wrap relative ${
                                isSdr 
                                    ? isLinkedin 
                                        ? 'bg-[#0077b5] text-white rounded-tr-none' 
                                        : 'bg-indigo-600 text-white rounded-tr-none'
                                    : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none'
                            }`}>
                                {msg.content}
                            </div>
                            
                            <div className="flex items-center gap-2 mt-1.5 px-1 opacity-70">
                                <span className={`text-[10px] ${isLinkedin && isSdr ? 'text-[#0077b5] font-bold' : ''}`}>
                                    {isSdr && msg.channel === 'linkedin' ? <i className="fab fa-linkedin mr-1"></i> : isSdr ? <i className="fas fa-envelope mr-1"></i> : null}
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {isSdr && msg.status && (
                                    <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                                        {msg.status === 'opened' && <><i className="fas fa-eye text-emerald-500"></i> Opened</>}
                                        {msg.status === 'delivered' && <i className="fas fa-check"></i>}
                                    </span>
                                )}
                            </div>

                            {isLatestProspect && (
                                <div className="mt-2 flex gap-2">
                                    <button 
                                        onClick={handleDeepAnalysis}
                                        disabled={analyzingSentiment}
                                        className="text-[10px] font-bold bg-white border border-slate-200 text-slate-500 px-3 py-1.5 rounded-full hover:bg-slate-50 hover:text-indigo-600 transition-colors shadow-sm flex items-center gap-1"
                                    >
                                        {analyzingSentiment ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-microscope"></i>}
                                        Deep Analysis
                                    </button>
                                </div>
                            )}

                            {isLatestProspect && activeAnalysis && (
                                <div className="mt-4 w-full bg-white border border-slate-200 rounded-2xl p-5 shadow-lg animate-fadeIn relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-400 to-purple-400"></div>
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2.5 h-2.5 rounded-full shadow-sm ${activeAnalysis.sentiment_score > 0 ? 'bg-emerald-500' : activeAnalysis.sentiment_score < 0 ? 'bg-rose-500' : 'bg-slate-400'}`}></div>
                                            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Intelligence Report</h4>
                                        </div>
                                        <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-bold text-slate-500">
                                            {Math.round(activeAnalysis.confidence_score * 100)}% Conf.
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div className="bg-slate-50 p-3 rounded-xl">
                                            <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Intent</p>
                                            <p className="text-sm font-bold text-slate-800 capitalize">{activeAnalysis.primary_intent}</p>
                                        </div>
                                        <div className="bg-slate-50 p-3 rounded-xl">
                                            <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Engagement</p>
                                            <p className="text-sm font-bold text-slate-800 capitalize">{activeAnalysis.engagement_level?.replace('_', ' ') || 'Unknown'}</p>
                                        </div>
                                    </div>

                                    {activeAnalysis.buying_signals && activeAnalysis.buying_signals.length > 0 && (
                                        <div className="mb-4">
                                            <p className="text-[10px] text-slate-400 font-bold uppercase mb-2">Buying Signals</p>
                                            <div className="flex flex-wrap gap-2">
                                                {activeAnalysis.buying_signals.map((sig, i) => (
                                                    <span key={i} className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg font-bold border border-emerald-100 flex items-center gap-1">
                                                        <i className="fas fa-check-circle"></i> {sig.signal}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="pt-3 border-t border-slate-100 flex justify-between text-xs">
                                        <span className="text-slate-500">Trajectory: <strong className="text-slate-700 capitalize">{activeAnalysis.conversation_trajectory?.trend || 'Stable'}</strong></span>
                                        <span className="text-slate-500">Action: <strong className="text-indigo-600">{activeAnalysis.recommended_response_type}</strong></span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                 );
              })}
              
              {/* Meeting Conversion Assistant */}
              {(classification?.intent === 'meeting_request' || activeThread.status === 'booked') && !activeThread.isEscalated && (
                  <div className="mx-auto max-w-lg bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 rounded-2xl p-5 animate-fadeIn shadow-md">
                      <h4 className="text-xs font-bold text-indigo-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <i className="fas fa-magic"></i> Meeting Conversion Assistant
                      </h4>
                      
                      {!handoffDoc ? (
                          <div className="grid grid-cols-2 gap-4">
                              <button 
                                  onClick={handleGenerateBrief}
                                  disabled={generatingDoc}
                                  className="bg-white border border-indigo-100 p-4 rounded-xl text-left hover:shadow-lg transition-all hover:-translate-y-0.5 group"
                              >
                                  <h5 className="text-sm font-bold text-slate-800 mb-1 flex items-center gap-2 group-hover:text-indigo-600 transition-colors">
                                      {generatingDoc ? <i className="fas fa-spinner fa-spin text-indigo-500"></i> : <i className="fas fa-file-alt text-indigo-500"></i>} 
                                      Generate Prep Doc
                                  </h5>
                                  <p className="text-[10px] text-slate-500">Create AE handoff brief.</p>
                              </button>
                              
                              <button 
                                  onClick={handleSendNudge}
                                  className="bg-white border border-indigo-100 p-4 rounded-xl text-left hover:shadow-lg transition-all hover:-translate-y-0.5 group"
                              >
                                  <h5 className="text-sm font-bold text-slate-800 mb-1 flex items-center gap-2 group-hover:text-indigo-600 transition-colors">
                                      <i className="fas fa-clock text-amber-500"></i> Send Nudge
                                  </h5>
                                  <p className="text-[10px] text-slate-500">Draft follow-up.</p>
                              </button>
                          </div>
                      ) : (
                          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative max-h-96 overflow-y-auto">
                              <button onClick={() => setHandoffDoc(null)} className="absolute top-3 right-3 text-slate-300 hover:text-slate-500"><i className="fas fa-times"></i></button>
                              
                              <h5 className="font-bold text-slate-800 text-sm mb-2 border-b border-slate-100 pb-2">{handoffDoc.title}</h5>
                              <p className="text-xs text-slate-500 mb-4 italic">{handoffDoc.summary}</p>
                              
                              <div className="space-y-4">
                                  {handoffDoc.sections?.map((section, idx) => (
                                      <div key={idx} className="text-xs">
                                          <div className="flex items-center gap-2 mb-1.5">
                                              <span className={`w-1.5 h-1.5 rounded-full ${section.priority === 'high' ? 'bg-rose-500' : 'bg-indigo-500'}`}></span>
                                              <strong className="text-slate-700 uppercase tracking-wide text-[10px]">{section.title}</strong>
                                          </div>
                                          <div className="text-slate-600 pl-3.5 border-l border-slate-200 whitespace-pre-wrap leading-relaxed">{section.content}</div>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}
                  </div>
              )}

              {/* Follow-Up Planner Module */}
              {followUpPlan && (
                  <div className="mx-auto max-w-lg bg-teal-50 border border-teal-200 rounded-2xl p-5 animate-fadeIn shadow-md mt-4 relative overflow-hidden">
                      <div className="flex justify-between items-center mb-4 relative z-10">
                          <h4 className="text-xs font-bold text-teal-800 uppercase tracking-widest flex items-center gap-2">
                              <i className="fas fa-calendar-alt"></i> Follow-Up Strategy
                          </h4>
                          <button onClick={() => setFollowUpPlan(null)} className="text-teal-400 hover:text-teal-600"><i className="fas fa-times"></i></button>
                      </div>
                      
                      <div className="mb-4 relative z-10">
                          <div className="flex gap-2 mb-2">
                              <span className="bg-white/50 text-teal-800 px-2 py-1 rounded text-[10px] font-bold border border-teal-100">Intent: {followUpPlan.follow_up_plan.intent_detected}</span>
                              <span className="bg-white/50 text-teal-800 px-2 py-1 rounded text-[10px] font-bold border border-teal-100">Strategy: {followUpPlan.follow_up_plan.strategy}</span>
                          </div>
                      </div>

                      <div className="space-y-3 relative z-10">
                          {followUpPlan.follow_up_plan.sequence?.map((step, idx) => (
                              <div key={idx} className="bg-white p-4 rounded-xl border border-teal-100 shadow-sm hover:shadow-md transition-shadow">
                                  <div className="flex justify-between mb-2">
                                      <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wide">Step {step.step}</span>
                                      <span className="text-[10px] text-slate-400 font-medium">Delay: {step.delay_days} days</span>
                                  </div>
                                  <p className="text-xs text-slate-800 font-bold mb-1">Subject: {step.subject}</p>
                                  <p className="text-xs text-slate-600 mb-3 whitespace-pre-wrap italic pl-2 border-l-2 border-teal-100">"{step.message_body}"</p>
                                  <button 
                                      onClick={() => {
                                          setReplyText(step.message_body);
                                      }}
                                      className="w-full py-2 bg-teal-50 text-teal-700 rounded-lg text-xs font-bold hover:bg-teal-100 transition-colors border border-teal-100"
                                  >
                                      Use Draft
                                  </button>
                              </div>
                          ))}
                      </div>
                  </div>
              )}
            </div>

            {/* RESPONSE INPUT AREA */}
            <div className="p-6 border-t border-slate-100 bg-white shadow-[0_-10px_20px_rgba(0,0,0,0.02)] z-20">
               {isClassifying && (
                   <div className="mb-2 text-xs text-indigo-500 font-bold animate-pulse flex items-center gap-1.5">
                       <i className="fas fa-brain"></i> Analyzing Intent & Context...
                   </div>
               )}
               {classification && !isClassifying && !activeThread.isEscalated && (
                   <div className="mb-4 flex items-center gap-3 animate-fadeIn">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded shadow-sm uppercase tracking-wide ${getUrgencyColor(classification.urgency)}`}>
                            {classification.urgency} Priority
                        </span>
                        <span className="text-xs font-bold text-slate-600 capitalize flex items-center gap-1">
                             <i className="fas fa-tag text-slate-400 text-[10px]"></i> {classification.intent?.replace(/_/g, ' ') || 'Unknown'}
                        </span>
                   </div>
               )}

               {objectionAnalysis && (
                   <div className="mb-4 bg-amber-50 border border-amber-100 rounded-2xl p-5 animate-fadeIn relative">
                       <div className="flex justify-between items-start mb-3">
                           <div>
                               <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wide flex items-center gap-2">
                                   <i className="fas fa-shield-alt"></i> Objection Intelligence
                               </h4>
                               <div className="flex gap-2 mt-2">
                                   <span className="text-[10px] bg-white border border-amber-200 text-amber-700 px-2 py-0.5 rounded-lg font-bold uppercase">{objectionAnalysis.classification.type}</span>
                                   <span className="text-[10px] bg-white border border-amber-200 text-amber-700 px-2 py-0.5 rounded-lg font-bold">{objectionAnalysis.framework_used}</span>
                               </div>
                           </div>
                           <div className="text-right">
                               <span className="text-[10px] font-bold text-amber-500 block mb-1">Sincerity Score</span>
                               <div className="w-20 h-1.5 bg-amber-200 rounded-full mt-1 overflow-hidden">
                                   <div className="h-full bg-amber-500 rounded-full" style={{width: `${objectionAnalysis.classification.sincerity_score * 10}%`}}></div>
                               </div>
                           </div>
                       </div>
                       <p className="text-xs text-amber-900/80 italic leading-relaxed mb-3">"{objectionAnalysis.reasoning}"</p>
                       <div className="flex gap-2 items-center flex-wrap">
                           <span className="text-[10px] font-bold text-amber-600 uppercase">Proof Points:</span>
                           {objectionAnalysis.proof_points_used?.map((pt, i) => (
                               <span key={i} className="text-[10px] bg-white px-2 py-0.5 rounded text-amber-800 border border-amber-100 shadow-sm">{pt}</span>
                           ))}
                       </div>
                   </div>
               )}

              <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
                  activeThread.isEscalated ? 'border-red-200 ring-2 ring-red-50' : 'border-slate-200 focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-300'
              }`}>
                {activeThread.isEscalated && (
                    <div className="bg-red-50 px-4 py-1.5 text-[10px] font-bold text-red-600 uppercase tracking-wider text-center border-b border-red-100">
                        Manual Override Active - Autonomous Responses Disabled
                    </div>
                )}
                <div className="bg-slate-50/50 px-4 py-2 border-b border-slate-100 flex gap-2 justify-between items-center">
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setActiveChannel('email')}
                            className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-2 ${
                                activeChannel === 'email' ? 'bg-white shadow-sm text-indigo-600 ring-1 ring-indigo-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                            <i className="fas fa-envelope"></i> Email
                        </button>
                        <button 
                            onClick={() => setActiveChannel('linkedin')}
                            className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-2 ${
                                activeChannel === 'linkedin' ? 'bg-white shadow-sm text-[#0077b5] ring-1 ring-[#0077b5]/10' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                            <i className="fab fa-linkedin"></i> LinkedIn
                        </button>
                    </div>
                    
                    {!activeThread.isEscalated && (
                        <button 
                            onClick={handleGenerateFollowUp} 
                            disabled={isPlanningFollowUp}
                            className="text-[10px] font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1.5 disabled:opacity-50 px-2 py-1 rounded hover:bg-teal-50 transition-colors"
                        >
                            {isPlanningFollowUp ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-calendar-plus"></i>}
                            Plan Follow-Up
                        </button>
                    )}
                </div>
                <div className="p-4">
                    <textarea 
                    className="w-full h-24 p-0 bg-transparent outline-none resize-none text-sm placeholder-slate-300 text-slate-800 leading-relaxed"
                    placeholder={`Reply via ${activeChannel === 'email' ? 'Email' : 'LinkedIn'}...`}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    />
                </div>
                <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-100">
                  <button 
                    onClick={handleAISuggestion}
                    disabled={isHandlingObjection || isAnalyzing || activeThread.isEscalated}
                    className="flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors disabled:opacity-50 hover:bg-indigo-50 px-3 py-1.5 rounded-lg"
                  >
                    {isHandlingObjection ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-wand-magic-sparkles"></i>}
                    AI Suggestion {activeMemory ? '(Context Aware)' : ''}
                  </button>
                  <button 
                    onClick={handleManualReply}
                    disabled={!replyText}
                    className={`px-6 py-2 text-white rounded-xl text-sm font-bold shadow-lg transition-all disabled:opacity-50 disabled:shadow-none flex items-center gap-2 ${
                        activeThread.isEscalated ? 'bg-red-600 hover:bg-red-700 shadow-red-200' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 hover:-translate-y-0.5'
                    }`}
                  >
                    Send {activeThread.isEscalated && '(Take Over)'} <i className="fas fa-paper-plane ml-1"></i>
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center opacity-40">
            <i className="fas fa-comments text-5xl mb-4 text-slate-200"></i>
            <p className="text-xl font-bold text-slate-400">Select a conversation</p>
          </div>
        )}
      </div>

      {/* HANDOFF PACKET MODAL */}
      {showHandoffModal && handoffContext && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fadeIn">
              <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                  {/* ... (Modal content same as before) ... */}
                  <div className="bg-gradient-to-r from-red-600 to-orange-600 p-8 text-white shrink-0 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mt-20 -mr-20"></div>
                      <div className="flex justify-between items-start relative z-10">
                          <div>
                              <div className="flex items-center gap-2 mb-3">
                                  <span className="bg-white/20 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm">
                                      Escalation ID: {handoffContext.escalation_id.split('_')[1]}
                                  </span>
                                  <span className="bg-white text-red-600 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-sm">
                                      {handoffContext.urgency} Urgency
                                  </span>
                              </div>
                              <h3 className="text-2xl font-bold tracking-tight">Human Handoff Packet</h3>
                              <p className="text-red-100 text-sm mt-1 font-medium">Trigger: {handoffContext.reason}</p>
                          </div>
                          <button onClick={() => setShowHandoffModal(false)} className="text-white/60 hover:text-white transition-colors bg-white/10 hover:bg-white/20 p-2 rounded-full"><i className="fas fa-times text-lg"></i></button>
                      </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-8 bg-slate-50 text-sm">
                      <div className="space-y-6">
                          {/* Context Summary */}
                          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                              <h4 className="font-bold text-slate-800 mb-3 uppercase text-xs tracking-wide">Situation Summary</h4>
                              <p className="text-slate-600 leading-relaxed">{handoffContext.context_summary}</p>
                          </div>

                          <div className="grid grid-cols-2 gap-6">
                              {/* Intelligence */}
                              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                  <h4 className="font-bold text-slate-800 mb-4 uppercase text-xs tracking-wide flex items-center gap-2">
                                      <i className="fas fa-brain text-purple-500"></i> Extracted Intelligence
                                  </h4>
                                  <div className="space-y-4">
                                      <div>
                                          <span className="text-xs text-slate-400 font-bold block mb-2">Pain Points</span>
                                          <ul className="space-y-1.5">
                                              {handoffContext.key_intelligence?.pain_points?.map((p, i) => <li key={i} className="flex items-start gap-2 text-slate-600"><i className="fas fa-caret-right text-purple-400 mt-1"></i> {p}</li>)}
                                          </ul>
                                      </div>
                                      <div>
                                          <span className="text-xs text-slate-400 font-bold block mb-2">Stakeholders</span>
                                          <div className="flex flex-wrap gap-2">
                                              {handoffContext.key_intelligence?.stakeholders_identified?.map((s, i) => (
                                                  <span key={i} className="bg-slate-100 px-2 py-1 rounded-md text-xs text-slate-600 font-medium">{s}</span>
                                              ))}
                                          </div>
                                      </div>
                                  </div>
                              </div>

                              {/* Strategy */}
                              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                  <h4 className="font-bold text-slate-800 mb-4 uppercase text-xs tracking-wide flex items-center gap-2">
                                      <i className="fas fa-chess text-blue-500"></i> Recommended Strategy
                                  </h4>
                                  <p className="text-slate-600 italic mb-5 leading-relaxed">"{handoffContext.recommended_approach}"</p>
                                  <div>
                                      <span className="text-xs text-slate-400 font-bold block mb-2">Prep Materials</span>
                                      <div className="flex flex-col gap-2">
                                          {Object.entries(handoffContext.prep_materials || {}).map(([name, link], i) => (
                                              <a href="#" key={i} className="text-blue-600 hover:text-blue-700 flex items-center gap-2 font-medium bg-blue-50 p-2 rounded-lg transition-colors">
                                                  <i className="fas fa-file-pdf"></i> {name}
                                              </a>
                                          ))}
                                          {Object.keys(handoffContext.prep_materials || {}).length === 0 && <span className="text-slate-400 italic">No specific docs found.</span>}
                                      </div>
                                  </div>
                              </div>
                          </div>

                          {/* Suggested Response */}
                          <div className="bg-gradient-to-br from-indigo-50 to-white p-6 rounded-2xl border border-indigo-100">
                              <div className="flex justify-between items-center mb-4">
                                  <h4 className="font-bold text-indigo-900 uppercase text-xs tracking-wide">Suggested Response Draft</h4>
                                  <button 
                                      onClick={() => {
                                          setReplyText(handoffContext.suggested_response_draft);
                                          setShowHandoffModal(false);
                                      }}
                                      className="text-xs bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-bold shadow-sm"
                                  >
                                      Use Draft
                                  </button>
                              </div>
                              <div className="bg-white p-4 rounded-xl border border-indigo-100 text-indigo-900 font-mono text-xs whitespace-pre-wrap leading-relaxed shadow-sm">
                                  {handoffContext.suggested_response_draft}
                              </div>
                          </div>
                      </div>
                  </div>

                  <div className="p-5 bg-white border-t border-slate-200 flex justify-end gap-3">
                      <button onClick={() => setShowHandoffModal(false)} className="px-5 py-2.5 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-colors">Close</button>
                      <button 
                          onClick={() => {
                              setShowHandoffModal(false);
                          }}
                          className="px-6 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-red-200 flex items-center gap-2 transition-all hover:-translate-y-0.5"
                      >
                          Acknowledge & Take Over <i className="fas fa-arrow-right"></i>
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default InboxView;
