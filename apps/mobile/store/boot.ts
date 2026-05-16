import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { BootMode } from "@squarely/types";

interface BootState {
  mode: BootMode | null;
  hydrated: boolean;
  setMode: (mode: BootMode) => void;
  clear: () => void;
  hydrate: () => Promise<void>;
}

const STORAGE_KEY = "squarely:boot-mode";

export const useBootMode = create<BootState>((set) => ({
  mode: null,
  hydrated: false,
  setMode: (mode) => {
    AsyncStorage.setItem(STORAGE_KEY, mode);
    set({ mode });
  },
  clear: () => {
    AsyncStorage.removeItem(STORAGE_KEY);
    set({ mode: null });
  },
  hydrate: async () => {
    const v = (await AsyncStorage.getItem(STORAGE_KEY)) as BootMode | null;
    set({ mode: v, hydrated: true });
  },
}));
