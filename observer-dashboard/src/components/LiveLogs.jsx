import { useEffect, useRef } from 'react';
import { Terminal, AlertCircle, Info, AlertTriangle } from 'lucide-react';

const LEVEL_STYLES = {
  error: { color: 'text-neon-red', icon: AlertCircle, bg: 'bg-neon-red/5' },
  warn: { color: 'text-neon-amber', icon: AlertTriangle, bg: 'bg-neon-amber/5' },
  info: { color: 'text-neon-blue', icon: Info, bg: '' },
};

function formatTimestamp(ts) {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  } catch {
    return '';
  }
}

export default function LiveLogs({ logs }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="glass-card p-4 flex flex-col h-full">
      <div className="flex items-center gap-2 mb-3">
        <Terminal className="w-4 h-4 text-neon-green" />
        <h2 className="text-sm font-semibold text-mesh-200 uppercase tracking-wider">Live Logs</h2>
        <span className="ml-auto text-[10px] text-mesh-400 font-mono">{logs.length} entries</span>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden space-y-0.5 min-h-0 max-h-[300px]"
      >
        {logs.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-mesh-500 text-xs">Waiting for log entries...</p>
          </div>
        ) : (
          logs.map((log, idx) => {
            const level = log.level || 'info';
            const style = LEVEL_STYLES[level] || LEVEL_STYLES.info;
            const Icon = style.icon;
            const message = log.message || log._raw || JSON.stringify(log).slice(0, 100);
            const isError = level === 'error';

            return (
              <div
                key={idx}
                className={`flex items-start gap-1.5 px-2 py-1 rounded text-[11px] font-mono transition-colors ${style.bg} ${isError ? 'border-l-2 border-neon-red/40' : ''}`}
              >
                <span className="text-mesh-500 whitespace-nowrap select-none">
                  {formatTimestamp(log.timestamp)}
                </span>
                <Icon className={`w-3 h-3 mt-0.5 shrink-0 ${style.color}`} />
                <span className={`${style.color} break-all`}>
                  {typeof message === 'string' ? message.slice(0, 200) : JSON.stringify(message).slice(0, 200)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
