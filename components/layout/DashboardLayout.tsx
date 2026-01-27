import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { MobileBottomNav } from './MobileBottomNav';
import { Button } from '../ui/Button';
import { SettingsModal } from '../teacher/SettingsModal';
import { GraduationCap } from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onNavigate: (tab: string) => void;
  onExit: () => void;
  teacherName?: string;
  onLogout?: () => void;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  activeTab,
  onNavigate,
  onExit,
  teacherName,
  onLogout
}) => {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onNavigate={onNavigate}
        onOpenSettings={() => setShowSettings(true)}
        teacherName={teacherName}
        onLogout={onLogout}
      />

      {/* Main Content Area */}
      <main className="flex-1 lg:ml-64 pb-20 lg:pb-0 transition-all duration-300">
        
        {/* Mobile Header */}
        <header className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-30 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
             <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-slate-900">LARA</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onExit} className="text-xs">
            Logout
          </Button>
        </header>

        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav activeTab={activeTab} onNavigate={onNavigate} />

      {/* Settings Modal */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
};