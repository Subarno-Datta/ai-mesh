import { Shield, Cpu, Zap, CheckCircle2 } from 'lucide-react';

const AGENT_CONFIG = {
  sentinel: {
    label: 'Sentinel',
    role: 'Monitor',
    icon: Shield,
    color: 'neon-blue',
    colorClass: 'text-neon-blue',
    glowClass: 'glow-blue',
    description: 'Monitors log stream for crashes'
  },
  debugger: {
    label: 'Debugger',
    role: 'Solver',
    icon: Cpu,
    color: 'neon-purple',
    colorClass: 'text-neon-purple',
    glowClass: 'glow-purple',
    description: 'Diagnoses bugs & generates patches'
  },
  deployer: {
    label: 'Deployer',
    role: 'Executor',
    icon: Zap,
    color: 'neon-amber',
    colorClass: 'text-neon-amber',
    glowClass: 'glow-amber',
    description: 'Applies patches & restarts server'
  },
  verifier: {
    label: 'Verifier',
    role: 'Validator',
    icon: CheckCircle2,
    color: 'neon-green',
    colorClass: 'text-neon-green',
    glowClass: 'glow-green',
    description: 'Replays requests to verify fix'
  }
};

const STATUS_STYLES = {
  idle: { bg: 'bg-mesh-600/50', text: 'text-mesh-300', dot: 'bg-mesh-400' },
  detecting: { bg: 'bg-neon-blue/10', text: 'text-neon-blue', dot: 'bg-neon-blue' },
  investigating: { bg: 'bg-neon-purple/10', text: 'text-neon-purple', dot: 'bg-neon-purple' },
  generating_patch: { bg: 'bg-neon-purple/10', text: 'text-neon-purple', dot: 'bg-neon-purple' },
  deploying: { bg: 'bg-neon-amber/10', text: 'text-neon-amber', dot: 'bg-neon-amber' },
  verifying: { bg: 'bg-neon-green/10', text: 'text-neon-green', dot: 'bg-neon-green' },
};

export default function AgentCard({ agentName, state }) {
  const config = AGENT_CONFIG[agentName];
  if (!config) return null;

  const Icon = config.icon;
  const status = state?.status || 'idle';
  const isActive = status !== 'idle';
  const styles = STATUS_STYLES[status] || STATUS_STYLES.idle;

  // Pick the key stat for this agent
  const statValue = state?.incidents_detected
    ?? state?.patches_generated
    ?? state?.deployments
    ?? state?.verifications
    ?? 0;
  const statLabel = agentName === 'sentinel' ? 'Detected'
    : agentName === 'debugger' ? 'Patched'
    : agentName === 'deployer' ? 'Deployed'
    : 'Verified';

  return (
    <div className={`glass-card p-4 relative overflow-hidden transition-all duration-300 ${isActive ? config.glowClass : ''}`}>
      {/* Active scanner overlay */}
      {isActive && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-transparent opacity-20"
            style={{
              background: `linear-gradient(180deg, transparent 0%, ${
                config.color === 'neon-blue' ? 'rgba(0,212,255,0.05)' :
                config.color === 'neon-purple' ? 'rgba(168,85,247,0.05)' :
                config.color === 'neon-amber' ? 'rgba(251,191,36,0.05)' :
                'rgba(0,255,136,0.05)'
              } 50%, transparent 100%)`
            }}
          />
        </div>
      )}

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${isActive ? 'bg-white/5' : 'bg-mesh-700'}`}>
              <Icon className={`w-4 h-4 ${config.colorClass}`} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-mesh-100">{config.label}</h3>
              <p className="text-[10px] text-mesh-400 uppercase tracking-wider">{config.role}</p>
            </div>
          </div>

          {/* Status badge */}
          <div className={`status-badge ${styles.bg} ${styles.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${styles.dot} ${isActive ? 'animate-status-pulse' : ''}`} />
            {status.replace('_', ' ')}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-mesh-700/50">
          <span className="text-[11px] text-mesh-400">{statLabel}</span>
          <span className={`text-lg font-bold font-mono ${config.colorClass}`}>{statValue}</span>
        </div>
      </div>
    </div>
  );
}
