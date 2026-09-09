import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { App } from './App';
import { ToastProvider } from './components/ui/Toast';
import { ApiError } from './lib/api';
import { queryKeys } from './lib/queries';
import './index.css';

/** A session that expired mid-use should drop straight back to the login screen. */
function handleAuthFailure(error: unknown) {
  if (error instanceof ApiError && error.isUnauthorized) {
    queryClient.setQueryData(queryKeys.session, null);
  }
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleAuthFailure }),
  mutationCache: new MutationCache({ onError: handleAuthFailure }),
  defaultOptions: {
    queries: {
      // Other people are editing the same data, so refresh when the tab regains focus.
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 1,
    },
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element is missing from index.html');

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          <App />
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
