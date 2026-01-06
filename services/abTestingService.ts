
import { Experiment, ExperimentVariant } from '../types';

const STORAGE_KEY_EXPERIMENTS = 'sdr_experiments';

function calculateSignificance(control: ExperimentVariant, variation: ExperimentVariant): number {
  const p1 = control.stats.replied / (control.stats.sent || 1);
  const p2 = variation.stats.replied / (variation.stats.sent || 1);
  const n1 = control.stats.sent;
  const n2 = variation.stats.sent;
  if (n1 < 30 || n2 < 30) return 0;
  const p = (control.stats.replied + variation.stats.replied) / (n1 + n2);
  const z = Math.abs(p1 - p2) / Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
  if (z > 2.58) return 99;
  if (z > 1.96) return 95;
  return Math.floor(Math.min(z / 1.96 * 95, 80));
}

export const abTestingService = {
  getExperiments(): Experiment[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_EXPERIMENTS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  },

  saveExperiments(experiments: Experiment[]) {
    localStorage.setItem(STORAGE_KEY_EXPERIMENTS, JSON.stringify(experiments));
  },

  getActiveExperiments(): Experiment[] {
    return this.getExperiments().filter(e => e.status === 'running');
  },

  assignVariant(experimentId: string): ExperimentVariant | null {
    const experiments = this.getExperiments();
    const exp = experiments.find(e => e.id === experimentId);
    if (!exp) return null;
    if (exp.status === 'completed' && exp.winner) {
        return exp.variants.find(v => v.id === exp.winner) || exp.variants[0];
    }
    const random = Math.random() * 100;
    return random <= exp.variants[0].allocation ? exp.variants[0] : exp.variants[1];
  },

  trackSend(experimentId: string, variantId: 'A' | 'B') {
    const experiments = this.getExperiments();
    const expIndex = experiments.findIndex(e => e.id === experimentId);
    if (expIndex === -1) return;
    const vIndex = experiments[expIndex].variants.findIndex(v => v.id === variantId);
    if (vIndex === -1) return;
    experiments[expIndex].variants[vIndex].stats.sent += 1;
    experiments[expIndex].significance = calculateSignificance(experiments[expIndex].variants[0], experiments[expIndex].variants[1]);
    this.saveExperiments(experiments);
  },

  trackReply(experimentId: string, variantId: 'A' | 'B') {
    const experiments = this.getExperiments();
    const expIndex = experiments.findIndex(e => e.id === experimentId);
    if (expIndex === -1) return;
    const vIndex = experiments[expIndex].variants.findIndex(v => v.id === variantId);
    if (vIndex === -1) return;
    experiments[expIndex].variants[vIndex].stats.replied += 1;
    experiments[expIndex].significance = calculateSignificance(experiments[expIndex].variants[0], experiments[expIndex].variants[1]);
    this.saveExperiments(experiments);
  }
};
