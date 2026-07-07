'use client';

import { useState } from 'react';

import { AuthGate } from '@/components/AuthGate';
import { ChatWindow } from '@/components/ChatWindow';
import { ConfigScreen } from '@/components/ConfigScreen';
import { LoadingScreen } from '@/components/LoadingScreen';
import { Sidebar } from '@/components/Sidebar';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ChatProvider } from '@/context/ChatContext';

export function AppShell() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const { isSupabaseConfigured, isLoading, isAuthenticated } = useAuth();

  if (!isSupabaseConfigured) {
    return <ConfigScreen />;
  }

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <AuthGate />;
  }

  return (
    <ChatProvider>
      <Workspace />
    </ChatProvider>
  );
}

function Workspace() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="relative flex h-screen overflow-hidden bg-field">
      {isSidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-20 bg-ink/30 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-label="Close sidebar overlay"
        />
      )}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <ChatWindow onOpenSidebar={() => setIsSidebarOpen(true)} />
    </div>
  );
}
