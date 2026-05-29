import { create } from "zustand";

/** Per-app-session unlock state for the device passcode gate. Resets on
 * relaunch and on sign-out, so a passcode-protected device asks again. */
interface LockState {
  unlocked: boolean;
  unlock: () => void;
  lock: () => void;
}

export const useUnlock = create<LockState>((set) => ({
  unlocked: false,
  unlock: () => set({ unlocked: true }),
  lock: () => set({ unlocked: false }),
}));
