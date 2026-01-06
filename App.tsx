
import React, { useState, useEffect } from 'react';
import { 
  AppView, 
  Prospect, 
  CompanyInfo, 
  SellerPersona, 
  MessageThread,
  ApiKeys,
  Channel,
  AgentLog,
  StrategicPlan
} from './types';
import { 
  INITIAL_COMPANY, 
  INITIAL_PERSONA, 
  DEFAULT_PROSPECTS, 
  DEFAULT_INBOX 
} from './constants';
import Sidebar from './components/Sidebar';
import DashboardView from './components/DashboardView';
import ProspectListView from './components/ProspectListView';
import OutreachView from './components/OutreachView';
import InboxView from './components/InboxView';
import SettingsView from './components/SettingsView';
import WarRoomView from './components/WarRoomView';
import { persistenceService } from './services/persistenceService';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.DASHBOARD);
  const [company, setCompany] = useState<CompanyInfo>(() => {
    const saved = localStorage.getItem('sdr_company');
    return saved ? JSON.parse(saved) : INITIAL_COMPANY;
  });
  const [persona, setPersona] = useState<SellerPersona>(() => {
    const saved = localStorage.getItem('sdr_persona');
    return saved ? JSON.parse(saved) : INITIAL_PERSONA;
  });
  const [prospects, setProspects] = useState<Prospect[]>(() => {
    const saved = localStorage.getItem('sdr_prospects');
    return saved ? JSON.parse(saved) : DEFAULT_PROSPECTS;
  });
  const [inbox, setInbox] = useState<MessageThread[]>(() => {
    const saved = localStorage.getItem('sdr_inbox');
    return saved ? JSON.parse(saved) : DEFAULT_INBOX;
  });
  const [apiKeys, setApiKeys] = useState<ApiKeys>(() => {
    const saved = localStorage.getItem('sdr_api_keys');
    const parsed = saved ? JSON.parse(saved) : {};
    // Merge with provided defaults if not present
    return {
        hunter: parsed.hunter || '',
        apollo: parsed.apollo || '',
        salesforce: parsed.salesforce || '',
        hubspot: parsed.hubspot || '',
        supabaseUrl: parsed.supabaseUrl || 'https://hpdrkrkfaqrkhasswczu.supabase.co',
        supabaseKey: parsed.supabaseKey || 'sb_publishable_z6T6JfAvChTa-u6rxONa5g__6TWqS9S'
    };
  });

  // Persistent Dashboard State
  const [agentLogs, setAgentLogs] = useState<AgentLog[]>([]);
  const [strategicPlan, setStrategicPlan] = useState<StrategicPlan | null>(null);

  const [activeProspectId, setActiveProspectId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Initial Load from Supabase (if empty local state or just to sync)
  useEffect(() => {
      const loadRemote = async () => {
          if (apiKeys.supabaseKey) {
              const remoteCompany = await persistenceService.load('company');
              if (remoteCompany) setCompany(remoteCompany);
              
              const remotePersona = await persistenceService.load('persona');
              if (remotePersona) setPersona(remotePersona);
              
              const remoteProspects = await persistenceService.load('prospects');
              if (remoteProspects) setProspects(remoteProspects);
              
              const remoteInbox = await persistenceService.load('inbox');
              if (remoteInbox) setInbox(remoteInbox);

              const remotePlan = await persistenceService.load('strategicPlan');
              if (remotePlan) setStrategicPlan(remotePlan);

              const remoteLogs = await persistenceService.load('agentLogs');
              if (remoteLogs) setAgentLogs(remoteLogs);
              
              setLastSaved(new Date());
          }
      };
      // Only attempt load on mount if keys exist
      loadRemote();
  }, []); // Run once on mount

  // Persistence (Local + Cloud Autosave)
  useEffect(() => {
    // Local Storage (Instant)
    localStorage.setItem('sdr_company', JSON.stringify(company));
    localStorage.setItem('sdr_persona', JSON.stringify(persona));
    localStorage.setItem('sdr_prospects', JSON.stringify(prospects));
    localStorage.setItem('sdr_inbox', JSON.stringify(inbox));
    localStorage.setItem('sdr_api_keys', JSON.stringify(apiKeys));

    // Cloud Storage (Autosave with reduced debounce)
    if (apiKeys.supabaseKey && apiKeys.supabaseUrl) {
        setIsSaving(true);
        const timeout = setTimeout(async () => {
            // Parallelize saves for speed
            await Promise.all([
                persistenceService.save('company', company),
                persistenceService.save('persona', persona),
                persistenceService.save('prospects', prospects),
                persistenceService.save('inbox', inbox),
                persistenceService.save('strategicPlan', strategicPlan),
                persistenceService.save('agentLogs', agentLogs)
            ]);
            setLastSaved(new Date());
            setIsSaving(false);
        }, 500); // 500ms delay for "instant" feel

        return () => clearTimeout(timeout);
    }
  }, [company, persona, prospects, inbox, apiKeys, strategicPlan, agentLogs]);

  const handleManualSave = async () => {
      setIsSaving(true);
      if (apiKeys.supabaseKey && apiKeys.supabaseUrl) {
          await Promise.all([
            persistenceService.save('company', company),
            persistenceService.save('persona', persona),
            persistenceService.save('prospects', prospects),
            persistenceService.save('inbox', inbox),
            persistenceService.save('strategicPlan', strategicPlan),
            persistenceService.save('agentLogs', agentLogs)
          ]);
          setLastSaved(new Date());
      }
      setTimeout(() => setIsSaving(false), 1000);
  };

  const handleNavigateToOutreach = (id: string) => {
    setActiveProspectId(id);
    setView(AppView.OUTREACH);
  };

  const addProspect = (p: Prospect) => setProspects([...prospects, p]);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden text-slate-900">
      <Sidebar 
        currentView={view} 
        onViewChange={setView} 
        onSave={handleManualSave}
        isSaving={isSaving}
        lastSaved={lastSaved}
      />
      
      <main className="flex-1 overflow-y-auto p-8 relative">
        {/* Subtle background pattern */}
        <div className="fixed inset-0 pointer-events-none opacity-40 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:24px_24px] z-0"></div>
        
        <div className="max-w-6xl mx-auto relative z-10">
          {view === AppView.DASHBOARD && (
            <DashboardView 
              prospects={prospects} 
              inbox={inbox} 
              apiKeys={apiKeys}
              agentLogs={agentLogs}
              setAgentLogs={setAgentLogs}
              strategicPlan={strategicPlan}
              setStrategicPlan={setStrategicPlan}
            />
          )}
          
          {view === AppView.PROSPECTS && (
            <ProspectListView 
              prospects={prospects} 
              onOutreach={handleNavigateToOutreach}
              onAdd={addProspect}
              onUpdate={(updatedProspect) => {
                setProspects(prev => prev.map(p => p.id === updatedProspect.id ? updatedProspect : p));
              }}
            />
          )}

          {view === AppView.WAR_ROOM && (
            <WarRoomView prospects={prospects} company={company} />
          )}
          
          {view === AppView.OUTREACH && (
            <OutreachView 
              company={company}
              persona={persona}
              activeProspect={prospects.find(p => p.id === activeProspectId) || prospects[0]}
              onUpdate={(updatedProspect) => {
                setProspects(prev => prev.map(p => p.id === updatedProspect.id ? updatedProspect : p));
              }}
              onSuccess={(pId, firstMessage, channel: Channel) => {
                setProspects(prev => prev.map(p => p.id === pId ? { ...p, status: 'engaged' } : p));
                const newThread: MessageThread = {
                  id: `t_${Date.now()}`,
                  prospectId: pId,
                  prospectName: prospects.find(p => p.id === pId)?.name || 'Prospect',
                  status: 'pending',
                  activeChannels: [channel],
                  messages: [{ role: 'sdr', channel: channel, content: firstMessage, timestamp: new Date().toISOString(), status: 'sent' }]
                };
                setInbox([newThread, ...inbox]);
                setView(AppView.INBOX);
              }}
            />
          )}
          
          {view === AppView.INBOX && (
            <InboxView 
              inbox={inbox} 
              company={company}
              prospects={prospects}
              onReply={(threadId, message) => {
                setInbox(prev => prev.map(t => 
                  t.id === threadId 
                    ? { ...t, messages: [...t.messages, message], status: message.role === 'sdr' ? 'pending' : 'replied' } 
                    : t
                ));
              }}
              onBookMeeting={(threadId, prospectId) => {
                 setInbox(prev => prev.map(t => t.id === threadId ? { ...t, status: 'booked' } : t));
                 setProspects(prev => prev.map(p => p.id === prospectId ? { ...p, status: 'booked' } : p));
              }}
            />
          )}
          
          {view === AppView.SETTINGS && (
            <SettingsView 
              company={company} 
              setCompany={setCompany}
              persona={persona}
              setPersona={setPersona}
              apiKeys={apiKeys}
              setApiKeys={setApiKeys}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
