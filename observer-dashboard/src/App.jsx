import { useState, useEffect } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import SwarmStatus from './components/SwarmStatus';
import AgentCard from './components/AgentCard';
import IncidentTimeline from './components/IncidentTimeline';
import CodeDiffViewer from './components/CodeDiffViewer';
import LiveLogs from './components/LiveLogs';
import CrashTrigger from './components/CrashTrigger';
import SettingsPanel from './components/SettingsPanel';
import ApprovalModal from './components/ApprovalModal';
import LandingPage from './components/LandingPage';
import { Moon, Sun } from 'lucide-react';

const AGENT_NAMES = ['sentinel', 'debugger', 'deployer', 'verifier'];

function App() {
  const {
    connected, agents, incidents, logs,
    settings, settingsResponse, systemEvents,
    triggerCrash, listModels, updateLLM, updateTarget, getSettings,
    updateHITL, sendApproval
  } = useWebSocket();
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [isLightMode, setIsLightMode] = useState(false);

  // Apply light-mode class to body/document to affect scrollbars and root variables if needed
  useEffect(() => {
    if (isLightMode) {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }
  }, [isLightMode]);

  // Auto-select latest active incident
  const activeIncident = incidents.find(i => !['resolved', 'failed'].includes(i.status));

  const displayIncident = selectedIncident || activeIncident || (incidents.length > 0 ? incidents[0] : null);

  if (!hasStarted) {
    return (
      <LandingPage 
        onGetStarted={() => setHasStarted(true)}
        isLightMode={isLightMode}
        toggleLightMode={() => setIsLightMode(!isLightMode)}
        settings={settings}
        settingsResponse={settingsResponse}
        listModels={listModels}
        updateLLM={updateLLM}
        updateTarget={updateTarget}
        getSettings={getSettings}
        updateHITL={updateHITL}
        connected={connected}
      />
    );
  }

  return (
    <div className={`min-h-screen bg-mesh-900 text-mesh-100 relative scan-line overflow-hidden transition-colors duration-500 ${isLightMode ? 'light-mode' : ''}`}>
      <ApprovalModal systemEvents={systemEvents} onApprove={sendApproval} />

      {/* Background gradient orbs */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-neon-blue/3 blur-[120px]" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-neon-purple/3 blur-[120px]" />
        <div className="absolute top-[40%] left-[40%] w-[300px] h-[300px] rounded-full bg-neon-green/2 blur-[100px]" />
      </div>

      {/* Main layout */}
      <div className="relative z-10 p-4 max-w-[1920px] mx-auto">
        {/* Top: Swarm Status + Settings */}
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <SwarmStatus connected={connected} agents={agents} incidents={incidents} settings={settings} />
          </div>
          <div className="pt-1 flex items-center gap-2">
            <button
              onClick={() => setIsLightMode(!isLightMode)}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-mesh-800/60 border border-mesh-700/50 hover:border-neon-amber/50 hover:text-neon-amber transition-all text-mesh-300"
            >
              {isLightMode ? <Moon size={14} /> : <Sun size={14} />}
            </button>
            <SettingsPanel
              settings={settings}
              settingsResponse={settingsResponse}
              onListModels={listModels}
              onUpdateLLM={updateLLM}
              onUpdateTarget={updateTarget}
              onGetSettings={getSettings}
              onUpdateHITL={updateHITL}
              disabled={!connected}
            />
          </div>
        </div>

        {/* Agent Cards Row */}
        <div className="grid grid-cols-4 gap-3 mt-4">
          {AGENT_NAMES.map(name => (
            <AgentCard key={name} agentName={name} state={agents[name]} />
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-12 gap-4 mt-4">
          {/* Left column: Incident Timeline + Crash Trigger */}
          <div className="col-span-3 space-y-4">
            <IncidentTimeline
              incidents={incidents}
              onSelectIncident={setSelectedIncident}
            />
            <CrashTrigger onTrigger={triggerCrash} disabled={!connected} />
          </div>

          {/* Center column: Code Diff */}
          <div className="col-span-5">
            <CodeDiffViewer incident={displayIncident} />
          </div>

          {/* Right column: Live Logs */}
          <div className="col-span-4">
            <LiveLogs logs={logs} />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-mesh-500 text-[10px] font-mono uppercase tracking-[0.2em]">
            Aura-Mesh • The Sentinel Protocol • Autonomous Incident Resolution
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
