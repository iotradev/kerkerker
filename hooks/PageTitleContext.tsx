'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

const PageTitleContext = createContext<{
  pageTitle: string | undefined;
  setPageTitle: (title: string | undefined) => void;
}>({
  pageTitle: undefined,
  setPageTitle: () => {},
});

export function PageTitleProvider({ children }: { children: ReactNode }) {
  const [pageTitle, setPageTitleState] = useState<string | undefined>(undefined);

  const setPageTitle = useCallback((title: string | undefined) => {
    setPageTitleState(title);
  }, []);

  return (
    <PageTitleContext.Provider value={{ pageTitle, setPageTitle }}>
      {children}
    </PageTitleContext.Provider>
  );
}

export function usePageTitle(title?: string) {
  const { pageTitle, setPageTitle } = useContext(PageTitleContext);

  useEffect(() => {
    setPageTitle(title);
  }, [title, setPageTitle]);

  return { pageTitle };
}
