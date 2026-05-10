import { Wifi, WifiOff, Activity, Shield, AlertTriangle, CheckCircle, Server } from 'lucide-react';

export default function SwarmStatus({ connected, agents, incidents, settings }) {
  const totalResolved = incidents.filter(i => i.status === 'resolved').length;
  const totalFailed = incidents.filter(i => i.status === 'failed').length;
  const activeIncidents = incidents.filter(i => !['resolved', 'failed'].includes(i.status)).length;

  const activeAgents = Object.values(agents).filter(a => a.status !== 'idle').length;
  const totalAgents = Math.max(Object.keys(agents).length, 4);

  const targetIsRunning = settings?.target?.is_running;
  const targetLabel = targetIsRunning ? "ONLINE" : "OFFLINE";
  const targetColor = targetIsRunning ? "neon-green" : "neon-red";

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-neon-blue" />
          <h1 className="text-lg font-bold bg-gradient-to-r from-neon-blue to-neon-purple bg-clip-text text-transparent">
            AURA-MESH
          </h1>
        </div>

        {/* Connection Status */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
          ${connected
            ? 'bg-neon-green/10 text-neon-green'
            : 'bg-neon-red/10 text-neon-red'
          }`}
        >
          {connected
            ? <><Wifi className="w-3 h-3" /> Live</>
            : <><WifiOff className="w-3 h-3" /> Offline</>
          }
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-5 gap-3">
        <StatBox
          icon={<Server className={`w-3.5 h-3.5 text-${targetColor}`} />}
          label="Target API"
          value={targetLabel}
          sublabel={settings?.target?.source_type || 'local'}
          color={targetColor}
        />
        <StatBox
          icon={<Activity className="w-3.5 h-3.5 text-neon-blue" />}
          label="Agents"
          value={`${activeAgents}/${totalAgents}`}
          sublabel="active"
          color="neon-blue"
        />
        <StatBox
          icon={<AlertTriangle className="w-3.5 h-3.5 text-neon-amber" />}
          label="Active"
          value={activeIncidents}
          sublabel="incidents"
          color="neon-amber"
        />
        <StatBox
          icon={<CheckCircle className="w-3.5 h-3.5 text-neon-green" />}
          label="Resolved"
          value={totalResolved}
          sublabel="incidents"
          color="neon-green"
        />
        <StatBox
          icon={<AlertTriangle className="w-3.5 h-3.5 text-neon-red" />}
          label="Failed"
          value={totalFailed}
          sublabel="incidents"
          color="neon-red"
        />
      </div>
    </div>
  );
}

function StatBox({ icon, label, value, sublabel, color }) {
  return (
    <div className="text-center p-2 rounded-lg bg-mesh-800/50 border border-mesh-700/30">
      <div className="flex justify-center mb-1">{icon}</div>
      <div className={`text-xl font-bold font-mono text-${color}`}>{value}</div>
      <div className="text-[10px] text-mesh-400 uppercase tracking-wider">{label}</div>
    </div>
  );
}
