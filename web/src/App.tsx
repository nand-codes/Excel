import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import { ClientActionsProvider } from '@/components/clients/ClientActions';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { Spinner } from '@/components/ui/Misc';
import { SearchProvider, useSearch } from '@/hooks/useSearch';
import { useTheme } from '@/hooks/useTheme';
import { useLogout, useSession } from '@/lib/queries';
import type { User } from '@/lib/types';
import { ClientFormPage } from '@/pages/ClientFormPage';
import { ClientsPage } from '@/pages/ClientsPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { LoginPage } from '@/pages/LoginPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { SettingsPage } from '@/pages/SettingsPage';

function pageTitle(pathname: string): string {
  if (pathname === '/') return 'Dashboard';
  if (pathname === '/clients') return 'All Clients';
  if (pathname === '/clients/new') return 'Add Client';
  if (pathname.startsWith('/clients/') && pathname.endsWith('/edit')) return 'Edit Client';
  if (pathname === '/reports') return 'Reports & Analytics';
  if (pathname === '/settings') return 'Settings';
  return 'Excel Driving School';
}

function AppShell({ user }: { user: User }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { appearance, toggle } = useTheme();
  const logout = useLogout();
  const { inputRef } = useSearch();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!event.ctrlKey && !event.metaKey) return;

      if (event.key === 'n') {
        event.preventDefault();
        navigate('/clients/new');
      }
      if (event.key === 'f') {
        event.preventDefault();
        navigate('/clients');
        // Wait for the toolbar field to mount before focusing it.
        window.setTimeout(() => inputRef.current?.focus(), 60);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate, inputRef]);

  return (
    <div className="min-h-screen">
      <Sidebar open={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />

      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-20 bg-black/20 backdrop-blur-[2px] lg:hidden"
        />
      ) : null}

      <div className="lg:pl-[240px]">
        <Topbar
          title={pageTitle(location.pathname)}
          showSearch={location.pathname === '/clients'}
          appearance={appearance}
          onToggleAppearance={toggle}
          onToggleSidebar={() => setSidebarOpen((open) => !open)}
          user={user}
          onSignOut={() => logout.mutate()}
        />

        <main className="mx-auto w-full max-w-[1280px] px-4 py-6 lg:px-8 lg:py-8">
          <ClientActionsProvider>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/clients" element={<ClientsPage />} />
              <Route path="/clients/new" element={<ClientFormPage />} />
              <Route path="/clients/:id/edit" element={<ClientFormPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ClientActionsProvider>
        </main>
      </div>
    </div>
  );
}

export function App() {
  const session = useSession();

  if (session.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (session.isError) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="font-display text-ink text-[18px] font-bold">Cannot reach the server</h1>
        <p className="text-muted text-[13px]">
          The app could not load your session. Check your connection and reload the page.
        </p>
      </div>
    );
  }

  if (!session.data) return <LoginPage />;

  return (
    <SearchProvider>
      <AppShell user={session.data} />
    </SearchProvider>
  );
}
