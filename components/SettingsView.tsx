
import React, { useState, useEffect } from 'react';
import { CompanyInfo, SellerPersona, ApiKeys, SequenceStep } from '../types';
import { adaptiveSequenceGenerator } from '../services/geminiService';
import { persistenceService } from '../services/persistenceService';

interface SettingsViewProps {
  company: CompanyInfo;
  setCompany: (c: CompanyInfo) => void;
  persona: SellerPersona;
  setPersona: (p: SellerPersona) => void;
  apiKeys: ApiKeys;
  setApiKeys: (k: ApiKeys) => void;
}

// Updated Sequence to demonstrate multi-channel branching logic with Apollo
const INITIAL_SEQUENCE: SequenceStep[] = [
  { id: '1', type: 'START', label: 'Lead Enrolled', nextId: '2' },
  { id: '2', type: 'EMAIL', label: 'Initial Cold Email', content: 'Value proposition...', subject: 'Quick question', nextId: '3' },
  { id: '3', type: 'WAIT', label: 'Wait 3 Days', delayDays: 3, nextId: '4' },
  { 
    id: '4', 
    type: 'BRANCH', 
    label: 'Check Reply Status', 
    condition: { field: 'replied', operator: 'equals', value: true }, 
    yesNextId: '5', // Replied
    noNextId: '6',  // No Reply
    adaptationLogic: "Gemini Monitor: If replied, classify sentiment. If no reply, switch channel."
  },
  // YES Branch (Replied)
  { 
    id: '5', 
    type: 'BRANCH', 
    label: 'Sentiment Analysis', 
    condition: { field: 'sentiment', operator: 'contains', value: 'negative' },
    yesNextId: '7', // Negative -> Objection
    noNextId: '8'   // Positive -> Book
  },
  // NO Branch (No Reply) -> Apollo LinkedIn Sequence
  { 
    id: '6', 
    type: 'APOLLO_SEQUENCE', // New Type
    label: 'Apollo: LinkedIn Seq', 
    apolloSequenceId: 'seq_linkedin_bump_v2', 
    content: 'Triggering Apollo API to add contact to LinkedIn automation.', 
    nextId: undefined 
  },
  // Objection Handling
  { id: '7', type: 'EMAIL', label: 'Objection Handler', content: 'Addressing concerns...', subject: 'Re: Concerns', nextId: undefined },
  // Booking Flow
  { id: '8', type: 'CALL', label: 'Manual Call Task', content: 'Positive sentiment detected. Call to book.', nextId: undefined }
];

const SettingsView: React.FC<SettingsViewProps> = ({ 
  company, 
  setCompany, 
  persona, 
  setPersona,
  apiKeys,
  setApiKeys
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'integrations' | 'automations'>('integrations');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  
  // Logic Builder State
  const [sequence, setSequence] = useState<SequenceStep[]>(INITIAL_SEQUENCE);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [simulationActive, setSimulationActive] = useState(false);
  const [simulationPath, setSimulationPath] = useState<string[]>([]);
  const [simulationLog, setSimulationLog] = useState<string[]>([]);
  const [prospectScenario, setProspectScenario] = useState<any>(null);
  const [thoughtSignature, setThoughtSignature] = useState<string>('');

  // Auto-Generator State
  const [showGenModal, setShowGenModal] = useState(false);
  const [genContext, setGenContext] = useState({ audience: '', goal: '' });
  const [isGeneratingSeq, setIsGeneratingSeq] = useState(false);

  // Sync Status
  const [syncStatus, setSyncStatus] = useState<string>('');

  const handleApiKeyChange = (key: keyof ApiKeys, value: string) => {
    setApiKeys({ ...apiKeys, [key]: value });
  };

  const handleForceSync = async () => {
      setSyncStatus('Syncing...');
      try {
          await persistenceService.save('company', company);
          await persistenceService.save('persona', persona);
          // Assuming these are current state, in a real app pass them in or fetch
          setSyncStatus('Success');
      } catch(e) {
          setSyncStatus('Error');
      }
      setTimeout(() => setSyncStatus(''), 2000);
  };

  const updateNode = (id: string, updates: Partial<SequenceStep>) => {
      setSequence(prev => prev.map(step => step.id === id ? { ...step, ...updates } : step));
  };

  const deleteNode = (id: string) => {
      setSequence(prev => prev.filter(step => step.id !== id));
      setSelectedNodeId(null);
  };

  const addNode = (parentId: string, branch: 'next' | 'yes' | 'no', type: SequenceStep['type']) => {
      const newId = `node_${Date.now()}`;
      const newNode: SequenceStep = {
          id: newId,
          type,
          label: type === 'EMAIL' ? 'New Email' : type === 'WAIT' ? 'Wait 1 Day' : 'New Step',
          content: '',
          delayDays: 1,
          condition: { field: 'opened', operator: 'equals', value: true }
      };

      setSequence(prev => {
          const newSeq = [...prev, newNode];
          return newSeq.map(step => {
              if (step.id === parentId) {
                  if (branch === 'yes') return { ...step, yesNextId: newId };
                  if (branch === 'no') return { ...step, noNextId: newId };
                  return { ...step, nextId: newId };
              }
              return step;
          });
      });
      setSelectedNodeId(newId);
  };

  const handleAutoGenerate = async () => {
      if (!genContext.audience || !genContext.goal) return;
      setIsGeneratingSeq(true);
      try {
          const result = await adaptiveSequenceGenerator(genContext.audience, genContext.goal, persona);
          if (result && result.steps.length > 0) {
              setSequence(result.steps);
              if (result.thoughtSignature) {
                  setThoughtSignature(result.thoughtSignature);
              }
              setShowGenModal(false);
          }
      } catch (e) {
          console.error("Sequence gen failed", e);
      }
      setIsGeneratingSeq(false);
  };

  const generateScenario = () => {
      const scenarios = [
          { name: "High Engagement (3+ Opens)", replied: false, opened: true, openCount: 4, visitedPricing: false, clicked: true, sentiment: 'neutral' },
          { name: "High Intent (Pricing Visit)", replied: false, opened: true, openCount: 1, visitedPricing: true, clicked: true, sentiment: 'neutral' },
          { name: "Ghosted (0 Opens)", replied: false, opened: false, openCount: 0, visitedPricing: false, clicked: false, sentiment: 'neutral' },
          { name: "Standard (1 Open)", replied: false, opened: true, openCount: 1, visitedPricing: false, clicked: false, sentiment: 'neutral' }
      ];
      return scenarios[Math.floor(Math.random() * scenarios.length)];
  };

  const simulateRun = () => {
      setSimulationActive(true);
      setSimulationPath([]);
      setSimulationLog([]);
      
      const scenario = generateScenario();
      setProspectScenario(scenario);
      setSimulationLog(prev => [`Simulating Scenario: ${scenario.name}`, ...prev]);

      let currentId: string | undefined = '1';
      const path: string[] = [];

      const runStep = () => {
          if (!currentId) {
              setSimulationActive(false);
              return;
          }
          path.push(currentId);
          setSimulationPath([...path]);

          const step = sequence.find(s => s.id === currentId);
          if (!step) return;

          let next: string | undefined;
          if (step.type === 'BRANCH') {
              // Advanced Branch Evaluation
              let conditionMet = false;
              if (step.condition) {
                  const { field, operator, value } = step.condition;
                  const prospectValue = scenario[field as keyof typeof scenario];
                  
                  if (operator === 'equals') conditionMet = prospectValue === value;
                  else if (operator === 'greater_than') conditionMet = (prospectValue as number) > (value as number);
                  else if (operator === 'contains') conditionMet = (prospectValue as string).includes(value as string);
                  
                  setSimulationLog(prev => [`Evaluated: ${field} (${prospectValue}) ${operator} ${value}? -> ${conditionMet}`, ...prev]);
              }
              
              next = conditionMet ? step.yesNextId : step.noNextId;
          } else {
              setSimulationLog(prev => [`Executed: ${step.label}`, ...prev]);
              next = step.nextId;
          }

          currentId = next;
          if (currentId) setTimeout(runStep, 1000);
          else setTimeout(() => setSimulationActive(false), 1000);
      };

      runStep();
  };

  // Recursive Tree Renderer
  const FlowNode = ({ nodeId }: { nodeId: string | undefined }) => {
      if (!nodeId) return null;
      const step = sequence.find(s => s.id === nodeId);
      if (!step) return null;

      const isSelected = selectedNodeId === nodeId;
      const isSimulated = simulationPath.includes(nodeId);

      const typeStyles = {
          START: 'bg-gray-800 text-white border-gray-700',
          EMAIL: 'bg-indigo-50 border-indigo-200 text-indigo-700',
          LINKEDIN: 'bg-blue-50 border-blue-200 text-blue-700',
          CALL: 'bg-green-50 border-green-200 text-green-700',
          WAIT: 'bg-gray-50 border-gray-300 text-gray-500 border-dashed',
          BRANCH: 'bg-amber-50 border-amber-300 text-amber-800',
          APOLLO_SEQUENCE: 'bg-teal-900 text-white border-teal-700'
      };

      const icon = {
          START: 'fa-flag-checkered',
          EMAIL: 'fa-envelope',
          LINKEDIN: 'fa-linkedin',
          CALL: 'fa-phone',
          WAIT: 'fa-hourglass-half',
          BRANCH: 'fa-code-branch',
          APOLLO_SEQUENCE: 'fa-rocket'
      }[step.type];

      return (
          <div className="flex flex-col items-center">
              <div 
                  onClick={() => setSelectedNodeId(nodeId)}
                  className={`relative w-48 p-3 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md hover:-translate-y-1 z-10 ${typeStyles[step.type]} ${isSelected ? 'ring-4 ring-indigo-200 shadow-lg scale-105' : ''} ${isSimulated ? 'ring-4 ring-green-400 shadow-green-200 scale-105' : ''}`}
              >
                  <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${step.type === 'APOLLO_SEQUENCE' ? 'bg-black/30' : 'bg-white/50'}`}>
                          <i className={`fas ${icon}`}></i>
                      </div>
                      <div className="text-xs font-bold truncate">{step.label}</div>
                  </div>
                  
                  {/* Quick Add Button */}
                  {step.type !== 'BRANCH' && !step.nextId && (
                      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 translate-y-full opacity-0 group-hover:opacity-100 transition-opacity z-20">
                          <button onClick={(e) => { e.stopPropagation(); addNode(step.id, 'next', 'EMAIL'); }} className="w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
                              <i className="fas fa-plus text-[10px]"></i>
                          </button>
                      </div>
                  )}
              </div>

              {step.adaptationLogic && isSelected && (
                  <div className="absolute -right-64 top-0 w-56 bg-white p-3 rounded-xl border border-indigo-100 shadow-xl text-xs z-50 animate-slideLeft">
                      <p className="font-bold text-indigo-600 mb-1"><i className="fas fa-brain"></i> AI Logic</p>
                      <p className="text-gray-600 italic">"{step.adaptationLogic}"</p>
                  </div>
              )}

              {step.type === 'BRANCH' ? (
                  <div className="flex gap-8 mt-8 relative">
                      {/* Branch Lines */}
                      <div className="absolute top-[-32px] left-1/2 w-0.5 h-8 bg-gray-300 -translate-x-1/2"></div>
                      <div className="absolute top-0 left-[25%] right-[25%] h-0.5 bg-gray-300"></div>
                      
                      <div className="flex flex-col items-center relative">
                          <div className="absolute -top-3 bg-green-100 text-green-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-green-200 z-10 shadow-sm">TRUE</div>
                          <div className="h-4 w-0.5 bg-gray-300 mb-4"></div>
                          {step.yesNextId ? (
                              <FlowNode nodeId={step.yesNextId} />
                          ) : (
                              <button onClick={() => addNode(step.id, 'yes', 'EMAIL')} className="w-8 h-8 rounded-full border-2 border-dashed border-gray-300 text-gray-300 hover:border-indigo-400 hover:text-indigo-400 flex items-center justify-center transition-colors">
                                  <i className="fas fa-plus"></i>
                              </button>
                          )}
                      </div>

                      <div className="flex flex-col items-center relative">
                          <div className="absolute -top-3 bg-red-100 text-red-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-red-200 z-10 shadow-sm">FALSE</div>
                          <div className="h-4 w-0.5 bg-gray-300 mb-4"></div>
                          {step.noNextId ? (
                              <FlowNode nodeId={step.noNextId} />
                          ) : (
                              <button onClick={() => addNode(step.id, 'no', 'EMAIL')} className="w-8 h-8 rounded-full border-2 border-dashed border-gray-300 text-gray-300 hover:border-indigo-400 hover:text-indigo-400 flex items-center justify-center transition-colors">
                                  <i className="fas fa-plus"></i>
                              </button>
                          )}
                      </div>
                  </div>
              ) : (
                  step.nextId && (
                      <div className="flex flex-col items-center">
                          <div className="h-8 w-0.5 bg-gray-300"></div>
                          <FlowNode nodeId={step.nextId} />
                      </div>
                  )
              )}
          </div>
      );
  };

  const IntegrationCard = ({ 
    id, 
    label, 
    icon, 
    description, 
    value, 
    colorClass, 
    bgClass,
    isBrandIcon = false,
    extraFields = []
  }: any) => {
    const isConnected = value && value.length > 5;
    const isExpanded = expandedKey === id;

    return (
      <div className={`border rounded-2xl transition-all duration-300 ${isConnected ? 'border-green-200 bg-white shadow-sm' : 'border-gray-200 bg-white hover:border-indigo-200'}`}>
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-5">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-inner ${bgClass} ${colorClass}`}>
                <i className={`${isBrandIcon ? 'fab' : 'fas'} ${icon}`}></i>
              </div>
              <div>
                <h4 className="font-bold text-lg text-gray-900">{label}</h4>
                <p className="text-xs text-gray-500 mt-1 max-w-[200px]">{description}</p>
                {isConnected && id === 'apollo' && <p className="text-[10px] text-teal-600 font-bold mt-1"><i className="fas fa-link"></i> Logic Sync Ready</p>}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${isConnected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-50 animate-pulse' : 'bg-gray-400'}`}></div>
                {isConnected ? 'Connected' : 'Inactive'}
              </div>
              <button 
                onClick={() => setExpandedKey(isExpanded ? null : id)}
                className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${isExpanded ? 'bg-gray-100 text-gray-600' : 'hover:bg-gray-50 text-gray-400'}`}
              >
                <i className={`fas ${isExpanded ? 'fa-chevron-up' : 'fa-cog'}`}></i>
              </button>
            </div>
          </div>
          
          {isExpanded && (
            <div className="mt-6 pt-6 border-t border-gray-100 animate-fadeIn">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                API Configuration Key / Token
              </label>
              <div className="relative group mb-3">
                <input 
                  type="password"
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-mono text-sm"
                  placeholder={`Enter ${label} API Key...`}
                  value={value || ''}
                  onChange={(e) => handleApiKeyChange(id, e.target.value)}
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors">
                  <i className="fas fa-key"></i>
                </div>
              </div>
              
              {extraFields.map((field: any) => (
                  <div key={field.id} className="relative group mb-3">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{field.label}</label>
                    <input 
                      type="text"
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-mono text-sm"
                      placeholder={field.placeholder}
                      value={apiKeys[field.id as keyof ApiKeys] || ''}
                      onChange={(e) => handleApiKeyChange(field.id as keyof ApiKeys, e.target.value)}
                    />
                    <div className="absolute left-3 top-9 text-gray-400 group-focus-within:text-indigo-500 transition-colors">
                      <i className={`fas ${field.icon}`}></i>
                    </div>
                  </div>
              ))}

              <div className="mt-4 flex justify-between items-center">
                <a href="#" className="text-xs text-indigo-500 hover:text-indigo-700 font-medium flex items-center gap-1">
                   <i className="fas fa-external-link-alt"></i> Get API Key
                </a>
                {isConnected && (
                    <button 
                        onClick={() => handleApiKeyChange(id, '')}
                        className="text-xs text-red-500 hover:text-red-700 font-bold bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors"
                    >
                        Disconnect
                    </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const activeNode = sequence.find(s => s.id === selectedNodeId);

  return (
    <div className="space-y-8 animate-fadeIn h-full flex flex-col">
      <header className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">Agent Configuration</h2>
          <p className="text-gray-500">Manage agent personality, market focus, and external integrations.</p>
        </div>
        {activeTab === 'integrations' && apiKeys.supabaseKey && (
            <button 
                onClick={handleForceSync}
                className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-green-700 transition-all flex items-center gap-2 shadow-sm"
            >
                {syncStatus ? <><i className="fas fa-circle-notch fa-spin"></i> {syncStatus}</> : <><i className="fas fa-cloud-upload-alt"></i> Force Sync to Supabase</>}
            </button>
        )}
      </header>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 shrink-0">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${
            activeTab === 'general' 
              ? 'border-indigo-600 text-indigo-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <i className="fas fa-sliders-h mr-2"></i> General Config
        </button>
        <button
          onClick={() => setActiveTab('integrations')}
          className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${
            activeTab === 'integrations' 
              ? 'border-indigo-600 text-indigo-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <i className="fas fa-network-wired mr-2"></i> Connection Dashboard
        </button>
        <button
          onClick={() => setActiveTab('automations')}
          className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${
            activeTab === 'automations' 
              ? 'border-indigo-600 text-indigo-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <i className="fas fa-project-diagram mr-2"></i> Logic Builder
        </button>
      </div>

      {activeTab === 'general' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fadeIn">
          {/* General Config Content - Kept from previous implementation */}
          <section className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 space-y-6">
            <h3 className="text-xl font-bold flex items-center gap-3">
              <i className="fas fa-building text-indigo-500"></i>
              Company Profile
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-500 uppercase mb-2">Company Name</label>
                <input 
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  value={company.name}
                  onChange={(e) => setCompany({ ...company, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-500 uppercase mb-2">Value Proposition</label>
                <textarea 
                  className="w-full h-24 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  value={company.valueProposition}
                  onChange={(e) => setCompany({ ...company, valueProposition: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-500 uppercase mb-2">Booking Link</label>
                <input 
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  value={company.calendarLink}
                  onChange={(e) => setCompany({ ...company, calendarLink: e.target.value })}
                />
              </div>
            </div>
          </section>

          <section className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 space-y-6">
            <h3 className="text-xl font-bold flex items-center gap-3">
              <i className="fas fa-id-card text-indigo-500"></i>
              Agent Persona
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-500 uppercase mb-2">Sender Name</label>
                  <input 
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    value={persona.name}
                    onChange={(e) => setPersona({ ...persona, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-500 uppercase mb-2">Job Title</label>
                  <input 
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    value={persona.title}
                    onChange={(e) => setPersona({ ...persona, title: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-500 uppercase mb-2">Communication Tone</label>
                <select 
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  value={persona.tone}
                  onChange={(e) => setPersona({ ...persona, tone: e.target.value as any })}
                >
                  <option value="professional">Professional</option>
                  <option value="casual">Casual</option>
                  <option value="friendly">Friendly</option>
                  <option value="authoritative">Authoritative</option>
                  <option value="consultative">Consultative</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-500 uppercase mb-2">Personalization Depth</label>
                <div className="flex gap-4">
                  {['light', 'moderate', 'deep'].map((depth) => (
                    <button
                      key={depth}
                      onClick={() => setPersona({ ...persona, personalizationDepth: depth as any })}
                      className={`flex-1 py-3 rounded-xl border-2 font-bold text-sm transition-all ${
                        persona.personalizationDepth === depth 
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-600' 
                          : 'border-gray-100 bg-gray-50 text-gray-400'
                      }`}
                    >
                      {depth.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {activeTab === 'integrations' && (
        <div className="space-y-8 animate-fadeIn">
          {/* Integration Content */}
          <div className="bg-white border border-indigo-100 rounded-2xl p-8 shadow-md relative overflow-hidden">
             <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full -mr-16 -mt-16 pointer-events-none"></div>
             <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-6">
                   <div className="w-16 h-16 bg-white border border-gray-100 rounded-2xl flex items-center justify-center shadow-md">
                      <img src="https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg" className="w-10 h-10" alt="Gemini" />
                   </div>
                   <div>
                      <h3 className="text-2xl font-bold text-gray-900">Google Gemini API</h3>
                      <p className="text-indigo-600 font-medium">Core Cognitive Intelligence Engine (v1.5 Pro)</p>
                   </div>
                </div>
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 px-4 py-2 rounded-xl backdrop-blur-sm">
                   <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(74,222,128,0.5)]"></div>
                   <span className="font-bold text-sm tracking-wide text-green-700">SYSTEM ACTIVE</span>
                </div>
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <section className="space-y-4">
              <h3 className="text-lg font-bold text-gray-700 flex items-center gap-2">
                 <i className="fas fa-database text-gray-400"></i> 
                 Persistence & CRM
              </h3>
              <div className="space-y-4">
                 <IntegrationCard 
                    id="supabaseKey"
                    label="Supabase"
                    icon="fa-bolt"
                    isBrandIcon={false}
                    description="Cloud persistence for application state (Postgres)."
                    value={apiKeys.supabaseKey}
                    bgClass="bg-green-50"
                    colorClass="text-green-600"
                    extraFields={[
                        { id: 'supabaseUrl', label: 'Supabase Project URL', placeholder: 'https://xyz.supabase.co', icon: 'fa-link' }
                    ]}
                 />
                 
                 {apiKeys.supabaseKey && (
                     <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-900 animate-fadeIn">
                         <h5 className="font-bold flex items-center gap-2 mb-2">
                             <i className="fas fa-info-circle"></i> Database Initialization
                         </h5>
                         <p className="mb-2 text-xs">If you see "Table not found" errors, run this SQL in your Supabase project's SQL Editor:</p>
                         <div className="relative group">
                             <pre className="bg-blue-100 p-3 rounded-lg border border-blue-200 font-mono text-[10px] overflow-x-auto select-all">
{`create table if not exists nexus_store (
  id text primary key,
  data jsonb,
  updated_at timestamptz default now()
);

alter table nexus_store enable row level security;

create policy "Public Access" on nexus_store 
for all using (true) with check (true);`}
                             </pre>
                         </div>
                     </div>
                 )}

                 <IntegrationCard 
                    id="salesforce"
                    label="Salesforce"
                    icon="fa-salesforce"
                    isBrandIcon={true}
                    description="Sync contacts, opportunities, and log activities bi-directionally."
                    value={apiKeys.salesforce}
                    bgClass="bg-blue-50"
                    colorClass="text-blue-600"
                 />
                 <IntegrationCard 
                    id="hubspot"
                    label="HubSpot"
                    icon="fa-hubspot"
                    isBrandIcon={true}
                    description="Manage deals, contacts, and marketing workflows."
                    value={apiKeys.hubspot}
                    bgClass="bg-orange-50"
                    colorClass="text-orange-600"
                 />
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-lg font-bold text-gray-700 flex items-center gap-2">
                 <i className="fas fa-search-plus text-gray-400"></i> 
                 Data Enrichment & Verification
              </h3>
              <div className="space-y-4">
                 <IntegrationCard 
                    id="apollo"
                    label="Apollo.io / Clearbit"
                    icon="fa-bolt"
                    description="Deep prospect research, tech stack data, and funding insights."
                    value={apiKeys.apollo}
                    bgClass="bg-teal-50"
                    colorClass="text-teal-600"
                 />
                 <IntegrationCard 
                    id="proxycurl"
                    label="Proxycurl (LinkedIn)"
                    icon="fa-linkedin"
                    description="Fetch rich LinkedIn profile data, activity, and articles."
                    value={apiKeys.proxycurl}
                    bgClass="bg-blue-50"
                    colorClass="text-blue-600"
                    isBrandIcon={true}
                 />
                 <IntegrationCard 
                    id="hunter"
                    label="Hunter.io / ZeroBounce"
                    icon="fa-check-double"
                    description="Real-time email verification and deliverability checks."
                    value={apiKeys.hunter}
                    bgClass="bg-emerald-50"
                    colorClass="text-emerald-600"
                 />
              </div>
            </section>
          </div>
        </div>
      )}

      {activeTab === 'automations' && (
          <div className="flex-1 flex gap-6 h-full overflow-hidden animate-fadeIn">
              {/* CANVAS AREA */}
              <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden relative">
                  {/* Toolbar */}
                  <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 backdrop-blur-sm z-10">
                      <div className="flex items-center gap-3">
                          <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                              <i className="fas fa-sitemap"></i>
                          </div>
                          <div>
                              <h3 className="font-bold text-gray-800 text-sm">Sequence Logic Visualizer</h3>
                              <p className="text-xs text-gray-500">{sequence.length} steps configured</p>
                          </div>
                          {thoughtSignature && (
                              <div className="ml-4 flex items-center gap-2 bg-purple-50 text-purple-700 px-3 py-1 rounded-full border border-purple-100">
                                  <i className="fas fa-fingerprint"></i>
                                  <span className="text-[10px] font-bold uppercase tracking-wider">Chain of Thought Active</span>
                              </div>
                          )}
                      </div>
                      <div className="flex gap-2">
                          <button onClick={() => setShowGenModal(true)} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700 shadow-md flex items-center gap-2">
                              <i className="fas fa-wand-magic-sparkles"></i> Auto-Generate
                          </button>
                          <button onClick={simulateRun} disabled={simulationActive} className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-50 shadow-sm flex items-center gap-2">
                              {simulationActive ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-play"></i>}
                              Test Run
                          </button>
                      </div>
                  </div>

                  {/* Graph Canvas */}
                  <div className="flex-1 overflow-auto p-10 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] relative">
                      <div className="min-w-max min-h-max flex justify-center pb-20">
                          <FlowNode nodeId="1" />
                      </div>

                      {/* Simulation Toast Overlay */}
                      {simulationActive && simulationLog.length > 0 && (
                          <div className="absolute top-4 right-4 z-50 w-80 space-y-2 pointer-events-none">
                              {simulationLog.slice(0, 3).map((log, i) => (
                                  <div key={i} className="bg-gray-900/90 backdrop-blur text-white p-3 rounded-lg text-xs shadow-xl border border-gray-700 animate-slideLeft">
                                      {log.startsWith('Evaluated:') ? (
                                          <div className="flex items-center gap-2">
                                              <i className="fas fa-code-branch text-amber-400"></i>
                                              <span>{log}</span>
                                          </div>
                                      ) : log.startsWith('Simulating') ? (
                                           <div className="flex items-center gap-2">
                                              <i className="fas fa-user-astronaut text-indigo-400"></i>
                                              <span className="font-bold">{log}</span>
                                          </div>
                                      ) : (
                                          <div className="flex items-center gap-2">
                                              <i className="fas fa-check text-green-400"></i>
                                              <span>{log}</span>
                                          </div>
                                      )}
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
                  
                  {/* Legend Overlay */}
                  <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur border border-gray-200 p-3 rounded-xl shadow-lg text-[10px] space-y-2">
                      <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-indigo-50 border border-indigo-200"></div> Email Action</div>
                      <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-amber-50 border border-amber-300"></div> Logic Branch</div>
                      <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-teal-900 border border-teal-700"></div> Apollo Sequence</div>
                      <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-gray-50 border border-gray-300 border-dashed"></div> Delay / Wait</div>
                  </div>
              </div>

              {/* PROPERTIES PANEL */}
              {selectedNodeId && activeNode ? (
                  <div className="w-80 bg-white rounded-2xl shadow-xl border border-gray-200 flex flex-col animate-slideLeft">
                      <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl">
                          <h4 className="font-bold text-gray-800">Step Properties</h4>
                          <button onClick={() => setSelectedNodeId(null)} className="text-gray-400 hover:text-gray-600"><i className="fas fa-times"></i></button>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto p-5 space-y-6">
                          {/* Properties editing controls same as before */}
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Step Type</label>
                              <select 
                                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold"
                                  value={activeNode.type}
                                  onChange={(e) => updateNode(activeNode.id, { type: e.target.value as any })}
                              >
                                  <option value="EMAIL">📧 Email</option>
                                  <option value="LINKEDIN">🔗 LinkedIn</option>
                                  <option value="CALL">📞 Call</option>
                                  <option value="APOLLO_SEQUENCE">🚀 Apollo Seq.</option>
                                  <option value="WAIT">⏳ Wait Delay</option>
                                  <option value="BRANCH">🔀 Branch Logic</option>
                              </select>
                          </div>
                          
                          {activeNode.type === 'APOLLO_SEQUENCE' && (
                              <div className="bg-teal-50 p-3 rounded-lg border border-teal-100">
                                  <label className="block text-xs font-bold text-teal-800 uppercase mb-2">Apollo Sequence ID</label>
                                  <input 
                                      className="w-full p-2 bg-white border border-teal-200 rounded-lg text-sm font-mono text-teal-900 focus:ring-2 focus:ring-teal-500 outline-none"
                                      placeholder="e.g. seq_123xyz"
                                      value={activeNode.apolloSequenceId || ''}
                                      onChange={(e) => updateNode(activeNode.id, { apolloSequenceId: e.target.value })}
                                  />
                                  <p className="text-[10px] text-teal-600 mt-2">
                                      <i className="fas fa-info-circle mr-1"></i> Contacts hitting this step will be automatically pushed to this Apollo Sequence via API.
                                  </p>
                              </div>
                          )}

                          {activeNode.type !== 'APOLLO_SEQUENCE' && activeNode.type !== 'BRANCH' && (
                              <div>
                                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Step Label</label>
                                  <input 
                                      className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold"
                                      value={activeNode.label}
                                      onChange={(e) => updateNode(activeNode.id, { label: e.target.value })}
                                  />
                              </div>
                          )}

                          {/* ... rest of existing form ... */}
                          <div className="pt-6 border-t border-gray-100">
                              <button 
                                  onClick={() => deleteNode(activeNode.id)}
                                  className="w-full py-2 border border-red-200 text-red-600 rounded-lg text-xs font-bold hover:bg-red-50 transition-colors"
                              >
                                  <i className="fas fa-trash-alt mr-2"></i> Delete Step
                              </button>
                          </div>
                      </div>
                  </div>
              ) : (
                  <div className="w-80 bg-gray-50/50 border-l border-gray-200 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                      <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4">
                          <i className="fas fa-mouse-pointer text-2xl text-gray-300"></i>
                      </div>
                      <p className="text-sm font-medium">Select a step in the sequence to edit its properties.</p>
                  </div>
              )}
          </div>
      )}

      {/* GENERATOR MODAL */}
      {showGenModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-8">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-2xl font-bold text-gray-800">Auto-Generate Sequence</h3>
                      <button onClick={() => setShowGenModal(false)} className="text-gray-400 hover:text-gray-600"><i className="fas fa-times text-xl"></i></button>
                  </div>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Target Audience</label>
                          <input 
                              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                              placeholder="e.g. CTOs at Series B SaaS companies"
                              value={genContext.audience}
                              onChange={e => setGenContext({...genContext, audience: e.target.value})}
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Campaign Goal</label>
                          <input 
                              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                              placeholder="e.g. Book a demo for our API security platform"
                              value={genContext.goal}
                              onChange={e => setGenContext({...genContext, goal: e.target.value})}
                          />
                      </div>
                      <div className="bg-indigo-50 p-4 rounded-xl text-xs text-indigo-700 leading-relaxed border border-indigo-100">
                          <i className="fas fa-info-circle mr-1"></i> The AI will design a complete multi-step cadence including branching logic for engagement, wait delays, and content templates tailored to your persona.
                      </div>
                      <button 
                          onClick={handleAutoGenerate}
                          disabled={!genContext.audience || !genContext.goal || isGeneratingSeq}
                          className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                          {isGeneratingSeq ? <><i className="fas fa-circle-notch fa-spin"></i> Designing Logic...</> : <><i className="fas fa-wand-magic-sparkles"></i> Generate Sequence</>}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default SettingsView;
