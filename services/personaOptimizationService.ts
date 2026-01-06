
import { Prospect, PersonaProfile } from '../types';

const STORAGE_KEY_PERSONAS = 'sdr_persona_profiles';

export const personaOptimizationService = {
  getProfiles(): PersonaProfile[] {
    try {
        const saved = localStorage.getItem(STORAGE_KEY_PERSONAS);
        return saved ? JSON.parse(saved) : [];
    } catch {
        return [];
    }
  },

  getSegmentForProspect(prospect: Prospect): PersonaProfile | null {
      const profiles = this.getProfiles();
      const title = prospect.title.toLowerCase();
      const industry = prospect.industry.toLowerCase();
      
      // Real-world dynamic matching logic
      const matched = profiles.find(p => {
          const seg = p.segment.toLowerCase();
          return seg.split(' ').some(word => title.includes(word) || industry.includes(word));
      });
      return matched || null;
  }
};
