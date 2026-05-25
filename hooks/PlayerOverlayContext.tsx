'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export const PlayerOverlayContext = createContext<{
  isOverlayOpen: boolean;
  setOverlayOpen: (open: boolean) => void;
}>({
  isOverlayOpen: false,
  setOverlayOpen: () => {},
});

export function PlayerOverlayProvider({ children }: { children: ReactNode }) {
  const [openCount, setOpenCount] = useState(0);

  const setOverlayOpen = useCallback((open: boolean) => {
    setOpenCount((prev) => Math.max(0, prev + (open ? 1 : -1)));
  }, []);

  return (
    <PlayerOverlayContext.Provider
      value={{ isOverlayOpen: openCount > 0, setOverlayOpen }}
    >
      {children}
    </PlayerOverlayContext.Provider>
  );
}

export function useIsPlayerOverlayOpen() {
  const { isOverlayOpen } = useContext(PlayerOverlayContext);
  return isOverlayOpen;
}
