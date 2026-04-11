import { create } from 'zustand';

interface BillingState {
  balance: number; // In kobo
  timeLeft: number; // In seconds
  isWarning: boolean;
  setBalance: (bal: number) => void;
  updateTimer: (seconds: number) => void;
}

export const useBillingStore = create<BillingState>((set) => ({
  balance: 0,
  timeLeft: 1800, 
  isWarning: false,
  setBalance: (balance) => set({ balance }),
  updateTimer: (timeLeft) => set({ timeLeft, isWarning: timeLeft <= 300 }),
}));
