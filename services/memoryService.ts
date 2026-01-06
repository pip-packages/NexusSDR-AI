
import { Prospect, ProspectMemory, InteractionEvent, ExtractedIntelligence, BehavioralProfile, EpisodicLesson, SequenceAdaptation } from '../types';

const STORAGE_KEY_MEMORY = 'sdr_prospect_memory';

export const memoryService = {
  getAllMemories(): Record<string, ProspectMemory> {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MEMORY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  },

  getMemory(prospectId: string): ProspectMemory | null {
    const memories = this.getAllMemories();
    return memories[prospectId] || null;
  },

  saveMemory(memory: ProspectMemory) {
    const memories = this.getAllMemories();
    memories[memory.prospect_id] = memory;
    localStorage.setItem(STORAGE_KEY_MEMORY, JSON.stringify(memories));
  },

  initializeMemory(prospect: Prospect): ProspectMemory {
    const existing = this.getMemory(prospect.id);
    if (existing) return existing;

    const newMemory: ProspectMemory = {
      prospect_id: prospect.id,
      basic_info: {
        name: prospect.name,
        email: prospect.email || '',
        title: prospect.title,
        company: prospect.company,
        linkedin: prospect.linkedinUrl
      },
      enrichment_data: {
        technologies: prospect.technologies || [],
        funding: prospect.funding || '',
        recentNews: prospect.recentNews || ''
      },
      behavioral_profile: {
        disc_type: "Unknown",
        communication_preference: "Unknown",
        decision_style: "Unknown"
      },
      interaction_history: [],
      extracted_intelligence: {
        stated_pain_points: [],
        stated_priorities: [],
        mentioned_competitors: [],
        budget_indicators: [],
        timeline_indicators: [],
        decision_makers_mentioned: [],
        objections_raised: [],
        questions_asked: []
      },
      engagement_score: prospect.bantData?.engagement || 0,
      lead_status: prospect.status,
      next_action: "Initial Outreach",
      topics_to_avoid: [],
      topics_that_resonated: [],
      episodicLessons: [],
      sequence_adaptations: { reason: 'Initial State' }
    };

    this.saveMemory(newMemory);
    return newMemory;
  },

  addInteraction(prospectId: string, interaction: InteractionEvent) {
    const memory = this.getMemory(prospectId);
    if (!memory) return;
    memory.interaction_history.push(interaction);
    this.saveMemory(memory);
  },

  addEpisodicLesson(prospectId: string, lesson: Partial<EpisodicLesson>) {
    const memory = this.getMemory(prospectId);
    if (!memory) return;
    const newLesson: EpisodicLesson = {
      prospectId,
      outcome: lesson.outcome || 'won',
      keyLearning: lesson.keyLearning || 'Observation',
      timestamp: new Date().toISOString()
    };
    memory.episodicLessons.push(newLesson);
    this.saveMemory(memory);
  },

  updateIntelligence(prospectId: string, updates: Partial<ExtractedIntelligence>) {
      const memory = this.getMemory(prospectId);
      if (!memory) return;
      memory.extracted_intelligence = { ...memory.extracted_intelligence, ...updates };
      this.saveMemory(memory);
  },
  
  updateBehavior(prospectId: string, updates: Partial<BehavioralProfile>) {
      const memory = this.getMemory(prospectId);
      if (!memory) return;
      memory.behavioral_profile = { ...memory.behavioral_profile, ...updates };
      this.saveMemory(memory);
  },

  updateAdaptation(prospectId: string, adaptation: SequenceAdaptation) {
      const memory = this.getMemory(prospectId);
      if (!memory) return;
      memory.sequence_adaptations = { ...memory.sequence_adaptations, ...adaptation };
      this.saveMemory(memory);
  }
};
