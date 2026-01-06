
import React, { useState } from 'react';
import { Prospect } from '../types';
import { calculateLeadScore, enrichProspect, runIcpFitScoring } from '../services/geminiService';
import { INITIAL_COMPANY } from '../constants'; // Fallback config

interface ProspectListViewProps {
  prospects: Prospect[];
  onOutreach: (id: string) => void;
  onAdd: (prospect: Prospect) => void;
  onUpdate: (prospect: Prospect) => void;
}

const ProspectListView: React.FC<ProspectListViewProps> = ({ prospects, onOutreach, onAdd, onUpdate }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('');
  const [enriching, setEnriching] = useState(false);
  const [analyzingIcp, setAnalyzingIcp] = useState<string | null>(null);
  
  // Cache for enriched data to display preview
  const [enrichedDataCache, setEnrichedDataCache] = useState<any | null>(null);

  const [newProspect, setNewProspect] = useState<Partial<Prospect>>({
    name: '',
    title: '',
    company: '',
    email: '',
    linkedinUrl: '',
    industry: '',
    location: ''
  });

  const handleAutoEnrich = async () => {
      if ((!newProspect.company && !newProspect.linkedinUrl) && !newProspect.name) return;
      
      setEnriching(true);
      setEnrichedDataCache(null); // Reset previous cache
      try {
          const data = await enrichProspect(
              newProspect.name || '',
              newProspect.company || '',
              newProspect.linkedinUrl
          );
          
          if (data) {
              setEnrichedDataCache(data);
              setNewProspect(prev => ({
                  ...prev,
                  title: data.title || prev.title,
                  industry: data.industry || prev.industry,
                  company: data.company || prev.company || '',
                  location: data.location || prev.location,
                  email: data.email || prev.email,
                  linkedinUrl: data.linkedinUrl || prev.linkedinUrl
              }));
          }
      } catch (e) {
          console.error("Enrichment failed", e);
      } finally {
          setEnriching(false);
      }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProspect.name || !newProspect.company) return;

    setSyncStatus('Finalizing...');
    
    // Create base prospect
    const baseProspect: Prospect = {
        id: `p_${Date.now()}`,
        name: newProspect.name || '',
        title: newProspect.title || '',
        company: newProspect.company || '',
        email: newProspect.email || '',
        linkedinUrl: newProspect.linkedinUrl || '',
        industry: newProspect.industry || 'Technology',
        location: newProspect.location || 'Unknown',
        score: 50, // Default
        status: 'cold',
        lastActivity: 'New Lead'
    };

    try {
        // Use cached enriched data if available, otherwise fetch minimal or use defaults
        // Note: We don't re-fetch here if auto-enrich was already used.
        const enrichmentSource = enrichedDataCache || {};
        
        // Merge enriched data properly
        const mergedProspect: Prospect = { 
            ...baseProspect, 
            ...enrichmentSource, // Spread enriched root fields like technologies, funding, etc.
            
            // Explicit user overrides take precedence if they edited the form
            title: newProspect.title || enrichmentSource.title || baseProspect.title,
            email: newProspect.email || enrichmentSource.email || baseProspect.email,
            industry: newProspect.industry || enrichmentSource.industry || baseProspect.industry,
            location: newProspect.location || enrichmentSource.location || baseProspect.location,
            
            // Map structured intelligence fields
            intelligence: { 
                enrichment: enrichmentSource,
                pain_points: enrichmentSource.painPoints || [], 
                lead_score: { total: 50, breakdown: { budget: 0, authority: 0, need: 0, timing: 0 } },
                recommended_approach: enrichmentSource.painPoints?.length > 0 ? `Focus on: ${enrichmentSource.painPoints[0]}` : "Research first"
            }
        };

        const bant = await calculateLeadScore(mergedProspect);
        mergedProspect.score = bant.total;
        mergedProspect.bantData = bant;

        onAdd(mergedProspect);
        setShowAddForm(false);
        setNewProspect({ name: '', title: '', company: '', email: '', linkedinUrl: '', industry: '', location: '' });
        setEnrichedDataCache(null);
    } catch (error) {
        console.error("Failed to add prospect", error);
        // Fallback add
        onAdd(baseProspect);
        setShowAddForm(false);
    } finally {
        setSyncStatus('');
    }
  };

  const handleRunIcpAnalysis = async (prospect: Prospect) => {
      setAnalyzingIcp(prospect.id);
      try {
          const analysis = await runIcpFitScoring(prospect, INITIAL_COMPANY);
          onUpdate({ ...prospect, icpAnalysis: analysis });
      } catch (e) {
          console.error("ICP Analysis failed", e);
      }
      setAnalyzingIcp(null);
  };

  const getTierColor = (tier?: string) => {
      switch(tier) {
          case 'Hot': return 'bg-rose-50 text-rose-700 border-rose-200';
          case 'Warm': return 'bg-amber-50 text-amber-700 border-amber-200';
          case 'Nurture': return 'bg-blue-50 text-blue-700 border-blue-200';
          case 'Low Priority': return 'bg-gray-100 text-gray-500 border-gray-200';
          case 'Disqualified': return 'bg-red-50 text-red-500 border-red-200 opacity-75';
          default: return 'bg-slate-50 text-slate-500 border-slate-200';
      }
  };

  const getIcpBadgeColor = (grade?: string) => {
      switch(grade) {
          case 'Excellent': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
          case 'Strong': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
          case 'Moderate': return 'bg-amber-100 text-amber-800 border-amber-200';
          case 'Poor': return 'bg-red-100 text-red-800 border-red-200';
          default: return 'bg-slate-100 text-slate-500';
      }
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
       <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Prospect Pipeline</h2>
          <p className="text-slate-500 mt-1">Manage high-value targets and automated lead scoring.</p>
        </div>
        <button 
          onClick={() => setShowAddForm(true)}
          className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all flex items-center gap-2"
        >
          <i className="fas fa-plus"></i> Add Prospect
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-indigo-100 mb-8 animate-slideDown relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full -mr-20 -mt-20 opacity-50 pointer-events-none"></div>
            <div className="flex justify-between items-center mb-6 relative z-10">
                <h3 className="text-xl font-bold text-slate-800">New Prospect Details</h3>
                <button 
                    type="button" 
                    onClick={handleAutoEnrich} 
                    disabled={enriching || (!newProspect.company && !newProspect.linkedinUrl && !newProspect.name)}
                    className="bg-blue-50 text-blue-600 px-4 py-2 rounded-lg font-bold text-xs hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 border border-blue-100"
                >
                    {enriching ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-bolt"></i>} 
                    Run Deep Enrichment
                </button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10">
                <form onSubmit={handleAdd} className="lg:col-span-2 space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-xs font-extrabold text-slate-400 uppercase mb-2 tracking-wider">Company *</label>
                            <input 
                                required 
                                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-900 placeholder-slate-400" 
                                value={newProspect.company} 
                                onChange={e => setNewProspect({...newProspect, company: e.target.value})} 
                                placeholder="e.g. Acme Corp"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-extrabold text-slate-400 uppercase mb-2 tracking-wider">Full Name *</label>
                            <input 
                                required 
                                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-900 placeholder-slate-400" 
                                value={newProspect.name} 
                                onChange={e => setNewProspect({...newProspect, name: e.target.value})} 
                                placeholder="e.g. Jane Doe"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-extrabold text-slate-400 uppercase mb-2 tracking-wider">Job Title</label>
                            <input 
                                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-900 placeholder-slate-400" 
                                value={newProspect.title} 
                                onChange={e => setNewProspect({...newProspect, title: e.target.value})} 
                                placeholder="e.g. VP of Engineering"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-extrabold text-slate-400 uppercase mb-2 tracking-wider">Email Address</label>
                            <input 
                                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-900 placeholder-slate-400" 
                                value={newProspect.email} 
                                onChange={e => setNewProspect({...newProspect, email: e.target.value})} 
                                placeholder="e.g. jane@acme.com"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-extrabold text-slate-400 uppercase mb-2 tracking-wider">LinkedIn URL</label>
                            <input 
                                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-900 placeholder-slate-400" 
                                value={newProspect.linkedinUrl} 
                                onChange={e => setNewProspect({...newProspect, linkedinUrl: e.target.value})} 
                                placeholder="https://linkedin.com/in/..."
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-extrabold text-slate-400 uppercase mb-2 tracking-wider">Industry</label>
                                <input 
                                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-900 placeholder-slate-400" 
                                    value={newProspect.industry} 
                                    onChange={e => setNewProspect({...newProspect, industry: e.target.value})} 
                                    placeholder="e.g. SaaS"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-extrabold text-slate-400 uppercase mb-2 tracking-wider">Location</label>
                                <input 
                                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-900 placeholder-slate-400" 
                                    value={newProspect.location} 
                                    onChange={e => setNewProspect({...newProspect, location: e.target.value})} 
                                    placeholder="e.g. SF, CA"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-3 pt-4 border-t border-slate-100">
                        <button type="button" onClick={() => setShowAddForm(false)} className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors">Cancel</button>
                        <button type="submit" disabled={!!syncStatus} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-md transition-all flex items-center justify-center gap-2">
                            {syncStatus ? <><i className="fas fa-circle-notch fa-spin"></i> {syncStatus}</> : "Save to Pipeline"}
                        </button>
                    </div>
                </form>

                {/* Intelligence Preview Panel */}
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 h-full flex flex-col">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <i className="fas fa-brain text-purple-500"></i> Intelligence Preview
                    </h4>
                    
                    {enriching ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 space-y-3">
                            <i className="fas fa-circle-notch fa-spin text-3xl text-indigo-400"></i>
                            <p className="text-xs text-center font-medium">Deep diving the web for insights...</p>
                        </div>
                    ) : enrichedDataCache ? (
                        <div className="space-y-4 overflow-y-auto flex-1 text-xs">
                            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                <span className="block font-bold text-slate-700 mb-1">Company Size & Funding</span>
                                <div className="flex flex-wrap gap-2">
                                    <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-md">{enrichedDataCache.companySize || 'Unknown'}</span>
                                    <span className="bg-green-50 text-green-700 px-2 py-1 rounded-md">{enrichedDataCache.funding || 'Unknown'}</span>
                                    <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-md">{enrichedDataCache.revenueRange || 'Unknown Rev'}</span>
                                </div>
                            </div>

                            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                <span className="block font-bold text-slate-700 mb-1">Tech Stack Detected</span>
                                <div className="flex flex-wrap gap-1">
                                    {enrichedDataCache.technologies?.slice(0, 5).map((tech: string, i: number) => (
                                        <span key={i} className="bg-slate-50 text-slate-500 px-1.5 py-0.5 rounded border border-slate-100">{tech}</span>
                                    ))}
                                    {!enrichedDataCache.technologies?.length && <span className="text-slate-400 italic">No stack data found.</span>}
                                </div>
                            </div>

                            {enrichedDataCache.recentNews && (
                                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                    <span className="block font-bold text-slate-700 mb-1">Latest Signals</span>
                                    <p className="text-slate-500 line-clamp-3 italic leading-relaxed">"{enrichedDataCache.recentNews}"</p>
                                </div>
                            )}

                            {enrichedDataCache.painPoints?.length > 0 && (
                                <div className="bg-amber-50 p-3 rounded-xl border border-amber-100">
                                    <span className="block font-bold text-amber-800 mb-1">Inferred Pain Points</span>
                                    <ul className="list-disc list-inside text-amber-700 space-y-1">
                                        {enrichedDataCache.painPoints.slice(0, 2).map((pp: string, i: number) => (
                                            <li key={i}>{pp}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-slate-200 rounded-xl">
                            <i className="fas fa-search text-3xl mb-2"></i>
                            <p className="text-xs text-center px-4">Run enrichment to populate intelligence data before saving.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {prospects.map(prospect => (
            <div key={prospect.id} className={`bg-white p-6 rounded-3xl shadow-sm border border-slate-200 hover:shadow-xl hover:border-indigo-200 hover:-translate-y-1 transition-all duration-300 group flex flex-col relative overflow-hidden ${prospect.bantData?.tier === 'Disqualified' ? 'opacity-70 grayscale-[0.5]' : ''}`}>
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-slate-50 to-transparent rounded-bl-3xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                
                <div className="flex justify-between items-start mb-5 relative z-10">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xl uppercase shadow-sm border border-indigo-100">
                            {prospect.name[0]}
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 text-lg leading-tight">{prospect.name}</h3>
                            <p className="text-xs text-slate-500 font-medium">{prospect.title}</p>
                        </div>
                    </div>
                    <div className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider border ${getTierColor(prospect.bantData?.tier)}`}>
                        {prospect.bantData?.tier || 'Unscored'}
                    </div>
                </div>
                
                <div className="space-y-3 mb-6 flex-1 relative z-10">
                    <div className="flex items-center gap-3 text-sm text-slate-600">
                        <div className="w-6 flex justify-center"><i className="fas fa-building text-slate-400"></i></div>
                        <span className="font-medium">{prospect.company}</span>
                        {prospect.revenueRange && (
                            <span className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded border border-green-100">{prospect.revenueRange}</span>
                        )}
                        {prospect.companySize && (
                            <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100"><i className="fas fa-users mr-1"></i>{prospect.companySize}</span>
                        )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-600">
                         <div className="w-6 flex justify-center"><i className="fas fa-industry text-slate-400"></i></div>
                         {prospect.industry}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-600">
                         <div className="w-6 flex justify-center"><i className="fas fa-map-marker-alt text-slate-400"></i></div>
                         {prospect.location}
                    </div>
                    
                    {/* Tech Stack Badge */}
                    {prospect.technologies && prospect.technologies.length > 0 && (
                        <div className="mt-2 pl-9 flex flex-wrap gap-1">
                            {prospect.technologies.slice(0, 3).map((tech, i) => (
                                <span key={i} className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">{tech}</span>
                            ))}
                            {prospect.technologies.length > 3 && <span className="text-[9px] text-slate-400">+{prospect.technologies.length - 3}</span>}
                        </div>
                    )}
                    
                    {/* BANT Scorecard */}
                    {prospect.bantData && (
                        <div className="mt-4 pt-4 border-t border-slate-100">
                            <div className="flex justify-between text-[10px] uppercase font-bold text-slate-400 mb-2">
                                <span>BANT Score: {prospect.bantData.total}</span>
                                {prospect.bantData.tier === 'Disqualified' || prospect.bantData.tier === 'Low Priority' ? (
                                    <span className="text-red-500 font-bold flex items-center gap-1 cursor-help" title={prospect.bantData.reasoning}>
                                        <i className="fas fa-shield-alt"></i> Gatekeeper Blocked
                                    </span>
                                ) : (
                                    <span className="text-indigo-500 cursor-help" title={prospect.bantData.reasoning}>Why?</span>
                                )}
                            </div>
                            <div className="grid grid-cols-4 gap-1 h-1.5 w-full">
                                {Object.entries(prospect.bantData.breakdown || {}).map(([key, val]) => (
                                    <div key={key} className="bg-slate-100 rounded-full overflow-hidden" title={`${key.toUpperCase()}: ${val}${prospect.bantData?.reasoning_breakdown ? `\nReasoning: ${prospect.bantData.reasoning_breakdown[key as keyof typeof prospect.bantData.reasoning_breakdown]}` : ''}`}>
                                        <div 
                                            className={`h-full ${
                                                (val as number) >= 70 ? 'bg-emerald-400' : (val as number) >= 40 ? 'bg-amber-400' : 'bg-slate-300'
                                            }`} 
                                            style={{width: '100%'}}
                                        ></div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-between text-[8px] text-slate-400 mt-1 uppercase font-bold tracking-widest">
                                <span>B</span><span>A</span><span>N</span><span>T</span>
                            </div>
                        </div>
                    )}

                    {/* ICP Analysis Result */}
                    {prospect.icpAnalysis && (
                        <div className="mt-3 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">ICP Fit</span>
                                <span className={`text-[10px] px-2 py-0.5 rounded border font-bold uppercase ${getIcpBadgeColor(prospect.icpAnalysis.icp_fit.grade)}`}>
                                    {prospect.icpAnalysis.icp_fit.grade}
                                </span>
                            </div>
                            <p className="text-xs text-slate-600 line-clamp-2 italic leading-relaxed mt-1">
                                "{prospect.icpAnalysis.recommended_outreach_angle.primary_hook}"
                            </p>
                        </div>
                    )}
                </div>

                <div className="pt-4 border-t border-slate-100 flex gap-3 relative z-10">
                    <button 
                        onClick={() => handleRunIcpAnalysis(prospect)}
                        disabled={analyzingIcp === prospect.id}
                        className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm"
                        title="Run Deep ICP Fit Analysis"
                    >
                         {analyzingIcp === prospect.id ? <i className="fas fa-circle-notch fa-spin text-indigo-500"></i> : <i className="fas fa-chart-line"></i>}
                    </button>
                    
                    <button 
                        onClick={() => onOutreach(prospect.id)}
                        disabled={prospect.bantData?.tier === 'Disqualified'}
                        className="flex-1 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none"
                    >
                        {prospect.bantData?.tier === 'Disqualified' ? 'Outreach Blocked' : 'Initialize Outreach'}
                    </button>
                </div>
            </div>
        ))}
      </div>
    </div>
  );
};

export default ProspectListView;
