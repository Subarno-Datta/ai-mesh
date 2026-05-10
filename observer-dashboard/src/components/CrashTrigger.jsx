import { Bomb, Zap } from 'lucide-react';

const CRASH_OPTIONS = [
  { id: 'null_user', label: 'Null User Name', desc: 'POST /api/users with null name', icon: '💥' },
  { id: 'missing_user', label: 'Missing User', desc: 'GET /api/users/999', icon: '👻' },
  { id: 'missing_product', label: 'Missing Product', desc: 'GET /api/products/999', icon: '📦' },
  { id: 'bad_regex', label: 'Bad Regex', desc: 'Search with invalid regex', icon: '🔍' },
  { id: 'null_order', label: 'Null Order Items', desc: 'POST /api/orders without items', icon: '🛒' },
  { id: 'null_profile', label: 'Null Profile Bio', desc: 'PUT /api/users/1 with null bio', icon: '👤' },
  { id: 'division_zero', label: 'Division by Zero', desc: '100% discount', icon: '➗' },
];

export default function CrashTrigger({ onTrigger, disabled }) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Bomb className="w-4 h-4 text-neon-red" />
        <h2 className="text-sm font-semibold text-mesh-200 uppercase tracking-wider">Crash Simulator</h2>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {CRASH_OPTIONS.map(crash => (
          <button
            key={crash.id}
            onClick={() => onTrigger(crash.id)}
            disabled={disabled}
            className={`flex items-start gap-2 p-2.5 rounded-lg text-left transition-all duration-200
              border border-mesh-700/30 bg-mesh-800/30
              hover:border-neon-red/30 hover:bg-neon-red/5 hover:shadow-[0_0_12px_rgba(255,51,102,0.1)]
              active:scale-[0.97]
              disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-mesh-700/30 disabled:hover:bg-mesh-800/30`}
          >
            <span className="text-base mt-0.5">{crash.icon}</span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-mesh-200 truncate">{crash.label}</p>
              <p className="text-[10px] text-mesh-500 font-mono truncate">{crash.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
