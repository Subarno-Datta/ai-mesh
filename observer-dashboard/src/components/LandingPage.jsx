import React from 'react';
import { Settings, Play, Moon, Sun, ShieldAlert, Cpu, Network } from 'lucide-react';
import SettingsPanel from './SettingsPanel';

export default function LandingPage({ 
  onGetStarted, 
  isLightMode, 
  toggleLightMode,
  settings,
  settingsResponse,
  listModels,
  updateLLM,
  updateTarget,
  getSettings,
  updateHITL,
  connected
}) {
  return (
    <div className="min-h-screen bg-mesh-900 text-mesh-100 relative scan-line overflow-hidden flex flex-col transition-colors duration-500">
      {/* Background gradient orbs */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-neon-blue/3 blur-[120px]" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-neon-purple/3 blur-[120px]" />
        <div className="absolute top-[40%] left-[40%] w-[300px] h-[300px] rounded-full bg-neon-green/2 blur-[100px]" />
      </div>

      {/* Header Controls */}
      <div className="relative z-50 flex justify-end items-center p-6 gap-3">
        <button
          onClick={toggleLightMode}
          className="flex items-center justify-center w-9 h-9 rounded-lg bg-mesh-800/60 border border-mesh-700/50 hover:border-neon-amber/50 hover:text-neon-amber transition-all text-mesh-300"
        >
          {isLightMode ? <Moon size={16} /> : <Sun size={16} />}
        </button>
        <div className="flex items-center">
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

      {/* Hero Section */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 mb-8 rounded-2xl bg-gradient-to-br from-neon-blue/20 to-neon-purple/20 border border-mesh-700/50 flex items-center justify-center animate-pulse-glow shadow-2xl shadow-neon-blue/20">
          <Network size={48} className="text-neon-blue" />
        </div>
        
        <h1 className="text-6xl md:text-8xl font-bold font-sans tracking-tight mb-4 text-mesh-100 drop-shadow-xl">
          Aura<span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-blue to-neon-purple">-Mesh</span>
        </h1>
        
        <p className="text-lg md:text-xl text-mesh-300 font-mono tracking-widest uppercase mb-12 max-w-2xl">
          The Sentinel Protocol • Autonomous Incident Resolution
        </p>

        <div className="flex flex-col sm:flex-row gap-4 items-center justify-center w-full max-w-md">
          <button 
            onClick={onGetStarted}
            className="w-full flex items-center justify-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-neon-blue to-neon-purple text-white font-mono font-bold text-lg hover:opacity-90 hover:scale-105 transition-all shadow-[0_0_30px_rgba(0,212,255,0.3)]"
          >
            <Play size={20} fill="currentColor" />
            Launch Observer
          </button>
        </div>
        
        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 max-w-5xl w-full text-left">
          <div className="p-6 rounded-2xl bg-mesh-800/40 border border-mesh-700/30 glass-card">
            <ShieldAlert size={24} className="text-neon-green mb-4" />
            <h3 className="font-bold text-mesh-100 mb-2">Proactive Defense</h3>
            <p className="text-mesh-400 text-sm">Real-time log interception automatically catches server crashes before they cascade.</p>
          </div>
          <div className="p-6 rounded-2xl bg-mesh-800/40 border border-mesh-700/30 glass-card">
            <Cpu size={24} className="text-neon-blue mb-4" />
            <h3 className="font-bold text-mesh-100 mb-2">Agentic Swarm</h3>
            <p className="text-mesh-400 text-sm">A multi-agent architecture diagnoses, patches, and verifies fixes autonomously.</p>
          </div>
          <div className="p-6 rounded-2xl bg-mesh-800/40 border border-mesh-700/30 glass-card">
            <Settings size={24} className="text-neon-purple mb-4" />
            <h3 className="font-bold text-mesh-100 mb-2">Dynamic Configuration</h3>
            <p className="text-mesh-400 text-sm">Switch LLMs and target repositories instantly, with full Human-in-the-Loop oversight.</p>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <div className="p-6 text-center relative z-10">
        <p className="text-mesh-500 text-[10px] font-mono tracking-widest uppercase">
          Initializing secure connection to the grid...
        </p>
      </div>
    </div>
  );
}
