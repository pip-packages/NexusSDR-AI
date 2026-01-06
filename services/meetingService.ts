
import { Prospect } from '../types';

export const meetingService = {
  // Mock function to determine if a nudge is needed based on time elapsed
  getConversionStatus(lastMessageDate: string): 'on_track' | 'needs_nudge' | 'risk' {
      const now = new Date();
      const msgDate = new Date(lastMessageDate);
      const hoursElapsed = (now.getTime() - msgDate.getTime()) / (1000 * 60 * 60);

      if (hoursElapsed > 48) return 'risk';
      if (hoursElapsed > 24) return 'needs_nudge';
      return 'on_track';
  },

  getNudgeStrategy(status: 'needs_nudge' | 'risk'): string {
      if (status === 'risk') {
          return "Offer async alternative (Loom/Docs) or switch channel.";
      }
      return "Send gentle bump with 2 specific time slots.";
  }
};
