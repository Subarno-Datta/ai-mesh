import { AlertTriangle, CheckCircle, Clock, XCircle, Search, Wrench, Rocket, ShieldCheck, Download } from 'lucide-react';

const STATUS_CONFIG = {
  detected: { icon: AlertTriangle, color: 'text-neon-red', bg: 'bg-neon-red/10', label: 'Detected' },
  investigating: { icon: Search, color: 'text-neon-blue', bg: 'bg-neon-blue/10', label: 'Investigating' },
  patch_generated: { icon: Wrench, color: 'text-neon-purple', bg: 'bg-neon-purple/10', label: 'Patch Generated' },
  deploying: { icon: Rocket, color: 'text-neon-amber', bg: 'bg-neon-amber/10', label: 'Deploying' },
  verifying: { icon: ShieldCheck, color: 'text-neon-cyan', bg: 'bg-neon-cyan/10', label: 'Verifying' },
  resolved: { icon: CheckCircle, color: 'text-neon-green', bg: 'bg-neon-green/10', label: 'Resolved' },
  failed: { icon: XCircle, color: 'text-neon-red', bg: 'bg-neon-red/10', label: 'Failed' },
};

function formatTime(timestamp) {
  if (!timestamp) return '';
  try {
    const d = new Date(timestamp);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '';
  }
}

export default function IncidentTimeline({ incidents, onSelectIncident }) {
  if (!incidents || incidents.length === 0) {
    return (
      <div className="glass-card p-6 flex flex-col items-center justify-center min-h-[300px]">
        <ShieldCheck className="w-12 h-12 text-mesh-500 mb-3" />
        <p className="text-mesh-400 text-sm">No incidents detected</p>
        <p className="text-mesh-500 text-xs mt-1">The swarm is monitoring...</p>
      </div>
    );
  }

  const exportIncident = (e, incident) => {
    e.stopPropagation(); // Prevent triggering onSelectIncident
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(incident, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", `incident_report_${incident.incident_id.substring(0,8)}.json`);
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  return (
    <div className="glass-card p-4 overflow-y-auto max-h-[calc(100vh-320px)]">
      <h2 className="text-sm font-semibold text-mesh-200 uppercase tracking-wider mb-4 flex items-center gap-2">
        <Clock className="w-3.5 h-3.5" />
        Incident Timeline
        <span className="ml-auto text-[10px] text-mesh-400 font-mono">{incidents.length} total</span>
      </h2>

      <div className="space-y-2">
        {incidents.map((incident, idx) => {
          const statusConf = STATUS_CONFIG[incident.status] || STATUS_CONFIG.detected;
          const StatusIcon = statusConf.icon;

          return (
            <button
              key={incident.incident_id || idx}
              className="w-full text-left animate-slide-in-up group"
              style={{ animationDelay: `${idx * 50}ms` }}
              onClick={() => onSelectIncident?.(incident)}
            >
              <div className={`p-3 rounded-lg border transition-all duration-200 cursor-pointer
                ${incident.status === 'resolved'
                  ? 'bg-neon-green/5 border-neon-green/20 hover:border-neon-green/40'
                  : incident.status === 'failed'
                    ? 'bg-neon-red/5 border-neon-red/20 hover:border-neon-red/40'
                    : 'bg-mesh-800/50 border-mesh-700/30 hover:border-mesh-600'
                }`}
              >
                <div className="flex items-start gap-2">
                  {/* Status icon */}
                  <div className={`mt-0.5 p-1 rounded ${statusConf.bg}`}>
                    <StatusIcon className={`w-3 h-3 ${statusConf.color}`} />
                  </div>

                  <div className="flex-1 min-w-0 relative">
                    {/* Error message */}
                    <p className="text-xs text-mesh-200 truncate font-medium pr-6">
                      {incident.error_message || 'Unknown error'}
                    </p>
                    
                    {/* Export button */}
                    {(incident.status === 'resolved' || incident.status === 'failed') && (
                      <div 
                        onClick={(e) => exportIncident(e, incident)}
                        className="absolute right-0 top-0 p-1 rounded hover:bg-mesh-700/50 text-mesh-400 hover:text-neon-blue transition-colors z-10"
                        title="Export Report"
                      >
                        <Download className="w-3 h-3" />
                      </div>
                    )}

                    {/* File info */}
                    <p className="text-[10px] text-mesh-400 font-mono mt-0.5 truncate">
                      {incident.faulty_file
                        ? `${incident.faulty_file.split(/[/\\]/).pop()}:${incident.faulty_line || '?'}`
                        : 'Unknown location'
                      }
                    </p>

                    {/* Bottom row */}
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`status-badge text-[9px] ${statusConf.bg} ${statusConf.color}`}>
                        {statusConf.label}
                      </span>
                      <span className="text-[10px] text-mesh-500 font-mono">
                        {formatTime(incident.timestamp)}
                      </span>
                      {incident.resolution_time_ms && (
                        <span className="text-[10px] text-neon-green font-mono ml-auto">
                          {(incident.resolution_time_ms / 1000).toFixed(1)}s
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
