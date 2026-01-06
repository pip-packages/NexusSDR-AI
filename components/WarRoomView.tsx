
import React, { useState } from 'react';
import { Prospect, CompetitorIntelligenceResult, BuyingCommitteeIntelligence, AccountIntelligenceResult, CompanyInfo } from '../types';
import { runCompetitorIntelligenceAgent, mapBuyingCommittee, runAccountIntelligenceAgent } from '../services/geminiService';
import { memoryService } from '../services/memoryService';

interface WarRoomViewProps {
    prospects: Prospect[];
    company: CompanyInfo;
}

const WarRoomView: React.FC<WarRoomViewProps> = ({ prospects, company }) => {
    const [selectedProspectId, setSelectedProspectId] = useState<string>(prospects[0]?.id || '');
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'committee' | 'battlecard' | 'competitors'>('overview');

    // Intelligence State
    const [competitorIntel, setCompetitorIntel] = useState<CompetitorIntelligenceResult | null>(null);
    const [buyingCommittee, setBuyingCommittee] = useState<BuyingCommitteeIntelligence | null>(null);
    const [accountIntel, setAccountIntel] = useState<AccountIntelligenceResult | null>(null);

    const handleRunIntel = async () => {
        const prospect = prospects.find(p => p.id === selectedProspectId);
        if (!prospect) return;
        
        setLoading(true);
        setCompetitorIntel(null);
        setBuyingCommittee(null);
        setAccountIntel(null);

        // Gather basic signals for buying committee context
        const mem = memoryService.getMemory(prospect.id);
        const signals = {
            budget: mem?.extracted_intelligence?.budget_indicators?.length ? true : false,
            timeline: mem?.extracted_intelligence?.timeline_indicators?.[0],
            pain_points: mem?.extracted_intelligence?.stated_pain_points || []
        };

        try {
            // Run all 3 Agents in parallel for max speed
            const [compResult, commResult, accResult] = await Promise.all([
                runCompetitorIntelligenceAgent(prospect, company),
                mapBuyingCommittee(prospect.company, [prospect], signals),
                runAccountIntelligenceAgent(prospect, company)
            ]);

            setCompetitorIntel(compResult);
            setBuyingCommittee(commResult);
            setAccountIntel(accResult);
        } catch (e) {
            console.error("War Room Analysis Failed", e);
        }
        setLoading(false);
    };

    // Safe accessors
    const detectedTools = Array.isArray(competitorIntel?.competitor_intelligence?.detected_tools) 
        ? competitorIntel.competitor_intelligence.detected_tools 
        : [];
    
    return (
        <div className="space-y-6 animate-fadeIn pb-12 h-full flex flex-col">
            <header className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Strategic War Room</h2>
                    <p className="text-slate-500 mt-1">Deep account penetration strategy & competitive analysis.</p>
                </div>
            </header>

            {/* Controls */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm shrink-0">
                <div className="flex gap-4 items-end">
                    <div className="flex-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Select Target Account</label>
                        <select 
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 transition-all"
                            value={selectedProspectId}
                            onChange={(e) => setSelectedProspectId(e.target.value)}
                        >
                            {prospects.map(p => (
                                <option key={p.id} value={p.id}>{p.company} - {p.name}</option>
                            ))}
                        </select>
                    </div>
                    <button 
                        onClick={handleRunIntel}
                        disabled={loading}
                        className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 transition-all hover:-translate-y-0.5"
                    >
                        {loading ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-search-dollar"></i>}
                        {loading ? 'Running Multi-Agent Analysis...' : 'Deploy War Room Agents'}
                    </button>
                </div>
            </div>

            {/* Analysis Content */}
            {(accountIntel || buyingCommittee || competitorIntel) && (
                <div className="flex-1 flex flex-col bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden animate-slideUp">
                    
                    {/* Tabs */}
                    <div className="flex border-b border-slate-100 bg-slate-50/50">
                        <button onClick={() => setActiveTab('overview')} className={`px-6 py-4 text-sm font-bold transition-all border-b-2 ${activeTab === 'overview' ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                            <i className="fas fa-radar mr-2"></i> Strategic Radar
                        </button>
                        <button onClick={() => setActiveTab('committee')} className={`px-6 py-4 text-sm font-bold transition-all border-b-2 ${activeTab === 'committee' ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                            <i className="fas fa-users mr-2"></i> Buying Committee
                        </button>
                        <button onClick={() => setActiveTab('battlecard')} className={`px-6 py-4 text-sm font-bold transition-all border-b-2 ${activeTab === 'battlecard' ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                            <i className="fas fa-shield-alt mr-2"></i> Battlecard
                        </button>
                        <button onClick={() => setActiveTab('competitors')} className={`px-6 py-4 text-sm font-bold transition-all border-b-2 ${activeTab === 'competitors' ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                            <i className="fas fa-chess mr-2"></i> Competitor Recon
                        </button>
                    </div>

                    <div className="p-8 flex-1 overflow-y-auto bg-slate-50/30">
                        
                        {/* TAB: OVERVIEW */}
                        {activeTab === 'overview' && accountIntel && (
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <div className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-sm relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                                        <h4 className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-3">Primary Account Strategy</h4>
                                        <p className="text-lg font-bold text-slate-800 leading-snug">"{accountIntel.summary.primary_message_for_this_account}"</p>
                                    </div>
                                    <div className="bg-red-50 p-6 rounded-2xl border border-red-100">
                                        <h4 className="text-xs font-bold text-red-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <i className="fas fa-ban"></i> Do Not Pitch (Risk Zones)
                                        </h4>
                                        <ul className="space-y-2">
                                            {accountIntel.summary.do_not_pitch?.map((item: string, i: number) => (
                                                <li key={i} className="flex gap-2 text-sm text-red-800">
                                                    <i className="fas fa-times mt-1 opacity-50"></i> {item}
                                                </li>
                                            ))}
                                            {(!accountIntel.summary.do_not_pitch || accountIntel.summary.do_not_pitch.length === 0) && (
                                                <li className="text-sm text-red-800/50 italic">No pitch restrictions identified.</li>
                                            )}
                                        </ul>
                                    </div>
                                </div>
                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Internal Dynamics</h4>
                                    {buyingCommittee?.internal_dynamics ? (
                                        <div className="space-y-4">
                                            <div>
                                                <span className="block text-xs font-bold text-slate-600 mb-1">Power Center</span>
                                                <span className="bg-slate-100 px-3 py-1 rounded-full text-sm font-bold text-slate-800">{buyingCommittee.internal_dynamics.likely_power_center}</span>
                                            </div>
                                            <div>
                                                <span className="block text-xs font-bold text-slate-600 mb-1">Deal Complexity</span>
                                                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                                    <div className={`h-full ${buyingCommittee.internal_dynamics.deal_complexity === 'High' ? 'bg-red-500 w-3/4' : 'bg-green-500 w-1/3'}`}></div>
                                                </div>
                                                <span className="text-xs text-slate-400 mt-1 block">{buyingCommittee.internal_dynamics.deal_complexity} Friction Expected</span>
                                            </div>
                                            <div>
                                                <span className="block text-xs font-bold text-slate-600 mb-1">Influence Path</span>
                                                <ul className="text-xs text-slate-500 list-disc list-inside">
                                                    {buyingCommittee.internal_dynamics.who_influences_whom?.map((path: string, i: number) => (
                                                        <li key={i}>{path}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    ) : <p className="text-slate-400 italic text-sm">No dynamics mapped.</p>}
                                </div>
                            </div>
                        )}

                        {/* TAB: BUYING COMMITTEE */}
                        {activeTab === 'committee' && buyingCommittee && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {Object.entries(buyingCommittee.buying_committee).map(([role, details]: [string, any]) => (
                                    <div key={role} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                            <i className={`fas ${role.includes('economic') ? 'fa-money-bill-wave' : role.includes('champion') ? 'fa-trophy' : 'fa-user'} text-6xl`}></i>
                                        </div>
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{role.replace(/_/g, ' ')}</h4>
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold">
                                                {details?.name ? details.name[0] : '?'}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800 text-sm">{details?.name || 'Unknown'}</p>
                                                <p className="text-xs text-slate-500">{details?.title || 'TBD'}</p>
                                            </div>
                                        </div>
                                        <div className="bg-slate-50 p-3 rounded-xl text-xs text-slate-600 italic leading-relaxed border border-slate-100">
                                            "{details?.likely_perspective || 'Perspective analysis pending...'}"
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* TAB: BATTLECARD */}
                        {activeTab === 'battlecard' && accountIntel && (
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                        <i className="fas fa-check-circle text-green-500"></i> Winning Pitch Points
                                    </h4>
                                    {accountIntel.account_intelligence.best_fit_pitch_points.map((point: any, idx: number) => (
                                        <div key={idx} className="bg-green-50/50 p-4 rounded-xl border border-green-100">
                                            <p className="text-sm font-bold text-green-900 mb-1">{point.pitch_point}</p>
                                            <p className="text-xs text-green-700 italic">{point.why_it_resonates_with_persona}</p>
                                            <div className="mt-2 flex justify-end">
                                                <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded border border-green-200 text-green-600">
                                                    {Math.round(point.confidence * 100)}% Match
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="space-y-4">
                                    <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                        <i className="fas fa-shield-alt text-amber-500"></i> Anticipated Objections
                                    </h4>
                                    {accountIntel.account_intelligence.persona_specific_objections_and_responses.map((obj: any, idx: number) => (
                                        <div key={idx} className="bg-amber-50/50 p-4 rounded-xl border border-amber-100">
                                            <p className="text-sm font-bold text-amber-900 mb-2">"{obj.objection}"</p>
                                            <div className="bg-white p-3 rounded-lg border border-amber-100 text-xs text-amber-800">
                                                <strong className="block mb-1 text-amber-600">Counter:</strong>
                                                {obj.recommended_response}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* TAB: COMPETITORS */}
                        {activeTab === 'competitors' && competitorIntel && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                                    <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                        <i className="fas fa-layer-group text-blue-500"></i> Detected Tech Stack
                                    </h4>
                                    <div className="grid grid-cols-1 gap-3">
                                        {detectedTools.length > 0 ? (
                                            detectedTools.map((tool: any, idx: number) => (
                                                <div key={idx} className="bg-gray-50 p-3 rounded-lg border border-gray-100 flex justify-between items-center">
                                                    <div>
                                                        <span className="font-bold text-gray-800 text-sm block">{tool.tool_name}</span>
                                                        <span className="text-[10px] text-gray-500 uppercase">{tool.category}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${tool.confidence > 0.8 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
                                                            {Math.round(tool.confidence * 100)}%
                                                        </span>
                                                        <span className="block text-[9px] text-gray-400 mt-1">via {tool.where_detected}</span>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-sm text-gray-400 italic">No specific tools detected publicly.</p>
                                        )}
                                    </div>
                                </div>

                                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                                    <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                        <i className="fas fa-chess-knight text-purple-500"></i> Competitive Positioning
                                    </h4>
                                    <div className="space-y-4">
                                        <div>
                                            <span className="text-xs font-bold text-slate-500 uppercase block mb-1">Strategy</span>
                                            <p className="text-sm font-medium text-slate-800">{competitorIntel.competitive_positioning.positioning_strategy}</p>
                                        </div>
                                        {competitorIntel.competitive_positioning.why_this_positioning && (
                                            <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                                                <p className="text-xs text-purple-800 italic leading-relaxed">"{competitorIntel.competitive_positioning.why_this_positioning}"</p>
                                            </div>
                                        )}
                                        <div>
                                            <span className="text-xs font-bold text-slate-500 uppercase block mb-2">Talking Points</span>
                                            <ul className="space-y-2">
                                                {(competitorIntel.competitive_positioning.recommended_talking_points as string[])?.map((tp: string, i: number) => (
                                                    <li key={i} className="flex gap-2 text-sm text-slate-700">
                                                        <i className="fas fa-check text-green-500 mt-1 shrink-0"></i>
                                                        <span>{tp}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* EMPTY STATE */}
                        {!loading && !accountIntel && !buyingCommittee && !competitorIntel && (
                            <div className="h-full flex flex-col items-center justify-center text-slate-300">
                                <i className="fas fa-satellite-dish text-6xl mb-6"></i>
                                <p className="text-xl font-bold text-slate-400">Ready for Strategic Analysis</p>
                                <p className="text-sm">Select an account and deploy agents to build your War Room.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default WarRoomView;
