
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Prospect, MessageThread, StrategicPlan, Subgoal, AgentLog, AutomationLog, ApprovalRequest, ApiKeys, WarmupStats, SignalAnalysisResult } from '../types';
import { generateStrategicPlan, runAutonomousAgent } from '../services/geminiService';
import { workflowService } from '../services/workflowService';
import { approvalService } from '../services/approvalService';
import { emailWarmupService } from '../services/emailWarmupService';

interface DashboardViewProps {
  prospects: Prospect[];
  inbox: MessageThread[];
  apiKeys: ApiKeys;
  // Persistent State Props
  agentLogs: AgentLog[];
  setAgentLogs: React.Dispatch<React.SetStateAction<AgentLog[]>>;
  strategicPlan: StrategicPlan | null;
  setStrategicPlan: React.Dispatch<React.SetStateAction<StrategicPlan | null>>;
}

const SubgoalItem: React.FC<{ subgoal: Subgoal }> = ({ subgoal }) => {
  const statusColor = subgoal.status === 'completed' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 
                     subgoal.status === 'in_progress' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-500 border-slate-200';

  return (
      <div className="ml-4 border-l-2 border-slate-100 pl-4 py-3 relative group">
          {/* Connector dot */}
          <div className="absolute -left-[21px] top-5 w-2 h-2 rounded-full bg-slate-200 group-hover:bg-indigo-400 transition-colors border-2 border-white"></div>
          <div className="flex items-center gap-3">
              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${statusColor}`}>
                   {subgoal.status?.replace('_', ' ') || 'Pending'}
              </span>
              <span className="font-semibold text-sm text-slate-800">{subgoal.title}</span>
          </div>
          {subgoal.subgoals?.map(sg => <SubgoalItem key={sg.id} subgoal={sg} />)}
      </div>
  );
};

const DashboardView: React.FC<DashboardViewProps> = ({ 
  prospects, 
  inbox, 
  apiKeys,
  agentLogs, 
  setAgentLogs, 
  strategicPlan, 
  setStrategicPlan 
}) => {
  const [goalInput, setGoalInput] = useState('');
  const [planning, setPlanning] = useState(false);
  const [agentRunning, setAgentRunning] = useState(false);
  const [automationLogs, setAutomationLogs] = useState<AutomationLog[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);
  const [warmupStats, setWarmupStats] = useState<WarmupStats | null>(null);
  
  // Signal Simulator State
  const [selectedSignalProspectId, setSelectedSignalProspectId] = useState<string>(prospects[0]?.id || '');
  const [selectedSignalType, setSelectedSignalType] = useState<string>('Funding Round');
  const [signalDescription, setSignalDescription] = useState('');
  const [injectingSignal, setInjectingSignal] = useState(false);

  // Job Change Simulator State
  const [scanningJobChanges, setScanningJobChanges] = useState(false);

  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubWorkflow = workflowService.subscribe(setAutomationLogs);
    const unsubApproval = approvalService.subscribe(reqs => setPendingApprovals(reqs.filter(r => r.status === 'pending')));
    
    if (apiKeys.instantly) {
        emailWarmupService.getStats('Instantly').then(setWarmupStats);
    } else if (apiKeys.warmbox) {
        emailWarmupService.getStats('Warmbox').then(setWarmupStats);
    }

    return () => { unsubWorkflow(); unsubApproval(); };
  }, [apiKeys]);

  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [agentLogs]);

  const handleCreatePlan = async () => {
    if (!goalInput) return;
    setPlanning(true);
    setAgentLogs([]); // Clear logs for new task
    setAgentRunning(true);
    
    // Step 1: Agentic Reasoning for Plan
    await runAutonomousAgent(`Create an execution strategy for: ${goalInput}`, (log) => {
        setAgentLogs(prev => [...prev, log]);
    });

    // Step 2: Formalize Plan
    const plan = await generateStrategicPlan(goalInput);
    setStrategicPlan(plan);
    setPlanning(false);
    setAgentRunning(false);
  };

  const handleInjectSignal = async () => {
      const prospect = prospects.find(p => p.id === selectedSignalProspectId);
      if (!prospect) return;
      
      setInjectingSignal(true);
      const desc = signalDescription || getDefaultDescription(selectedSignalType, prospect.company);
      
      await workflowService.processSignalAutonomous(prospect, selectedSignalType, desc);
      
      setInjectingSignal(false);
      setSignalDescription('');
  };

  const handleScanJobChanges = async () => {
      setScanningJobChanges(true);
      
      // Simulate scanning by picking a random "champion"
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const championName = "Sarah Jenkins";
      const oldCompany = "TechFlow Inc.";
      const newCompany = "ScaleUp Systems";
      const newTitle = "VP of Engineering";
      
      // Trigger the workflow
      await workflowService.trigger("prospect_job_changed", championName, {
          prospectName: championName,
          oldCompany,
          newCompany,
          newTitle,
          new_company_icp_fit: true // Forces trigger condition
      });
      
      setScanningJobChanges(false);
  };

  const getDefaultDescription = (type: string, company: string) => {
      switch(type) {
          case 'Funding Round': return `${company} raised Series B funding of $25M led by Sequoia.`;
          case 'Job Change': return `Key Decision Maker (CTO) left ${company}. New CTO appointed internally.`;
          case 'Layoffs': return `${company} announced 15% workforce reduction in engineering.`;
          case 'Product Launch': return `${company} launched a new AI analytics suite today.`;
          default: return `Significant market event detected for ${company}.`;
      }
  };

  const stats = useMemo(() => {
    const totalOutreach = inbox.length;
    const booked = prospects.filter(p => p.status === 'booked').length;
    return [
      { label: 'Pipeline Activity', value: prospects.length, icon: 'fa-users', color: 'indigo' },
      { label: 'Outreach Sent', value: totalOutreach, icon: 'fa-paper-plane', color: 'blue' },
      { label: 'Meetings Booked', value: booked, icon: 'fa-calendar-check', color: 'emerald' },
      { label: 'Pending Approvals', value: pendingApprovals.length, icon: 'fa-shield-alt', color: 'amber' },
    ];
  }, [prospects, inbox, pendingApprovals]);

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      <header className="flex justify-between items-end">
        <div>
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Agent Command Center</h2>
            <p className="text-slate-500 mt-1 font-medium">Autonomous sales intelligence execution dashboard.</p>
        </div>
        <div className="text-right">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Active Workspace</p>
            <p className="text-sm font-bold text-indigo-600">Default Campaign</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-5 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center bg-${stat.color}-50 text-${stat.color}-600 border border-${stat.color}-100 group-hover:scale-110 transition-transform`}>
              <i className={`fas ${stat.icon} text-2xl`}></i>
            </div>
            <div>
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">{stat.label}</p>
              <p className="text-3xl font-bold text-slate-900 mt-1 tabular-nums">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* AGENT COGNITION CONSOLE */}
        <div className="lg:col-span-2 flex flex-col gap-8">
            <div className="bg-slate-900 rounded-3xl p-1 shadow-2xl border border-slate-800 h-[600px] flex flex-col relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
                
                {/* Console Header */}
                <div className="bg-slate-900 p-4 border-b border-slate-800 flex justify-between items-center rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <div className="flex gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-red-500"></div>
                            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                        </div>
                        <span className="text-xs font-mono text-slate-400 ml-2">agent_cognition_stream.log</span>
                    </div>
                    {agentRunning && (
                        <div className="text-xs font-mono text-emerald-400 flex items-center gap-2">
                            <i className="fas fa-circle-notch fa-spin"></i> PROCESSING
                        </div>
                    )}
                </div>

                {/* Console Body */}
                <div className="flex-1 bg-slate-950 p-6 overflow-y-auto font-mono text-xs space-y-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                    {agentLogs.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center opacity-30 text-center text-slate-500">
                            <i className="fas fa-terminal text-5xl mb-4"></i>
                            <p className="font-medium">System Ready. Awaiting instructions.</p>
                        </div>
                    ) : (
                        agentLogs.map((log, idx) => (
                            <div key={idx} className="animate-fadeIn">
                                {log.type === 'thought' && <p className="text-slate-400"><span className="text-purple-400 font-bold uppercase mr-2">[THOUGHT]</span>{log.content}</p>}
                                {log.type === 'action' && <p className="text-amber-400 mt-1"><span className="text-amber-600 font-bold uppercase mr-2">[ACTION]</span>{log.content}</p>}
                                {log.type === 'observation' && <p className="text-emerald-400/80 pl-4 border-l border-emerald-900 mt-1 italic">{log.content}</p>}
                                {log.type === 'answer' && (
                                    <div className="mt-4 p-4 bg-slate-900 border border-indigo-900/50 rounded-lg text-indigo-300 shadow-lg">
                                        <div className="flex items-center gap-2 mb-2 text-indigo-400 font-bold border-b border-indigo-900/50 pb-2">
                                            <i className="fas fa-check-circle"></i> RESULT
                                        </div>
                                        {log.content}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                    <div ref={logEndRef} />
                </div>

                {/* Console Input */}
                <div className="p-4 bg-slate-900 border-t border-slate-800">
                    <div className="flex gap-4">
                        <div className="flex-1 bg-slate-800 border border-slate-700 rounded-xl p-1 flex items-center shadow-inner focus-within:ring-2 focus-within:ring-indigo-500/50 transition-all">
                            <span className="pl-3 text-slate-500 font-mono">{'>'}</span>
                            <input 
                                value={goalInput} 
                                onChange={e => setGoalInput(e.target.value)} 
                                className="bg-transparent border-none outline-none flex-1 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 font-mono" 
                                placeholder="Enter objective (e.g. 'Research Acme Corp contacts')..." 
                            />
                        </div>
                        <button 
                            onClick={handleCreatePlan}
                            disabled={!goalInput || agentRunning}
                            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-900/20 font-mono border border-indigo-500"
                        >
                            EXECUTE
                        </button>
                    </div>
                </div>
            </div>
            
            {strategicPlan && (
                <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-8 animate-fadeIn relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-green-50 to-transparent rounded-bl-full opacity-60 pointer-events-none"></div>
                    <div className="flex justify-between items-center mb-6 relative z-10">
                        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <i className="fas fa-clipboard-list text-indigo-500"></i> Active Playbook
                        </h3>
                        <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-xs font-extrabold uppercase border border-emerald-100 tracking-wider flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Running
                        </span>
                    </div>
                    <div className="space-y-6 relative z-10">
                        {strategicPlan.subgoals?.map(sg => <SubgoalItem key={sg.id} subgoal={sg} />)}
                    </div>
                </div>
            )}
        </div>

        {/* FEED & ALERTS */}
        <div className="space-y-8">
            {/* Live Signal Simulator Widget */}
            <div className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <i className="fas fa-broadcast-tower text-8xl"></i>
                </div>
                <h3 className="font-bold flex items-center gap-2 mb-4 relative z-10">
                    <i className="fas fa-bolt"></i> Live Signal Simulator
                </h3>
                <div className="space-y-3 relative z-10">
                    <div>
                        <label className="text-[10px] font-bold uppercase text-indigo-200 mb-1 block">Target Prospect</label>
                        <select 
                            value={selectedSignalProspectId}
                            onChange={(e) => setSelectedSignalProspectId(e.target.value)}
                            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-xs font-bold text-white outline-none focus:bg-white/20"
                        >
                            {prospects.map(p => <option key={p.id} value={p.id}>{p.company}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold uppercase text-indigo-200 mb-1 block">Signal Type</label>
                        <select 
                            value={selectedSignalType}
                            onChange={(e) => setSelectedSignalType(e.target.value)}
                            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-xs font-bold text-white outline-none focus:bg-white/20"
                        >
                            {['Funding Round', 'Job Change', 'Layoffs', 'Product Launch'].map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <button 
                        onClick={handleInjectSignal}
                        disabled={injectingSignal}
                        className="w-full bg-white text-indigo-600 py-2 rounded-lg font-bold text-xs hover:bg-indigo-50 transition-colors shadow-lg mt-2 flex items-center justify-center gap-2"
                    >
                        {injectingSignal ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-rss"></i>} 
                        Inject Signal
                    </button>
                </div>
            </div>

            {/* ALUMNI TRACKER WIDGET */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                        <i className="fas fa-user-graduate text-indigo-500"></i> Alumni Tracker
                    </h3>
                    <button 
                        onClick={handleScanJobChanges}
                        disabled={scanningJobChanges}
                        className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-2"
                    >
                        {scanningJobChanges ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-sync"></i>}
                        Run Scan
                    </button>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-center">
                    <p className="text-xs text-slate-500 mb-1">Scanning 142 past champions for job updates...</p>
                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div className={`h-full bg-indigo-500 rounded-full transition-all duration-1000 ${scanningJobChanges ? 'w-3/4' : 'w-0'}`}></div>
                    </div>
                </div>
            </div>

            {/* Event Triggers Feed */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 flex flex-col h-[500px]">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
                    <i className="fas fa-history text-indigo-500"></i> Event Intelligence
                </h3>
                <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin scrollbar-thumb-slate-200">
                    {automationLogs.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center text-slate-400">
                            <i className="fas fa-bell-slash text-3xl mb-2 opacity-30"></i>
                            <p className="text-xs">No signals detected</p>
                        </div>
                    ) : (
                        automationLogs.map(log => {
                            if (log.triggerType === 'SIGNAL_DETECTED') {
                                const result = log.actions[0]?.metadata as SignalAnalysisResult;
                                const decisionColor = result?.decision === 'ACCELERATE' ? 'text-green-600 bg-green-50 border-green-100' :
                                                      result?.decision === 'PAUSE' ? 'text-red-600 bg-red-50 border-red-100' :
                                                      'text-amber-600 bg-amber-50 border-amber-100';
                                return (
                                    <div key={log.id} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs">
                                                    <i className="fas fa-bolt"></i>
                                                </div>
                                                <span className="text-xs font-bold text-slate-700">{log.entityName}</span>
                                            </div>
                                            <span className="text-[9px] text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                        </div>
                                        
                                        {result ? (
                                            <div className="space-y-2">
                                                <div className={`flex items-center justify-between px-2 py-1 rounded text-[10px] font-bold border uppercase ${decisionColor}`}>
                                                    <span>Decision: {result.decision}</span>
                                                    <span>{Math.round(result.confidence_score)}% Conf.</span>
                                                </div>
                                                <p className="text-[10px] text-slate-500 leading-relaxed italic border-l-2 border-slate-200 pl-2">
                                                    "{result.reasoning}"
                                                </p>
                                                <div className="text-[10px] text-slate-600 font-medium bg-slate-50 px-2 py-1 rounded">
                                                    Action: {result.recommended_action}
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-xs text-slate-500">Signal processed.</p>
                                        )}
                                    </div>
                                );
                            } else if (log.triggerType === 'prospect_job_changed') {
                                const draft = log.actions[0]?.metadata?.draft;
                                return (
                                    <div key={log.id} className="bg-white border border-indigo-200 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow ring-1 ring-indigo-50">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded bg-indigo-600 text-white flex items-center justify-center text-xs shadow-sm">
                                                    <i className="fas fa-briefcase"></i>
                                                </div>
                                                <span className="text-xs font-bold text-slate-800">{log.entityName}</span>
                                            </div>
                                            <span className="text-[9px] text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                        </div>
                                        <div className="bg-indigo-50 p-2 rounded-lg border border-indigo-100 mb-2">
                                            <p className="text-[10px] text-indigo-800 font-medium">Job Change Detected &rarr; Congratulatory Draft Ready</p>
                                        </div>
                                        {draft && (
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-bold text-slate-700">Subject: {draft.subject}</p>
                                                <p className="text-[10px] text-slate-500 italic truncate">"{draft.body.substring(0, 60)}..."</p>
                                            </div>
                                        )}
                                    </div>
                                );
                            }
                            return (
                                <div key={log.id} className="border-l-2 border-indigo-100 pl-4 py-2 hover:bg-slate-50 transition-colors rounded-r-lg group">
                                    <div className="flex justify-between mb-1">
                                        <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wide group-hover:text-indigo-700">{log.triggerType?.replace(/_/g, ' ') || 'Event'}</span>
                                        <span className="text-[10px] text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                    </div>
                                    <p className="text-sm font-bold text-slate-700 truncate">{log.entityName}</p>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
