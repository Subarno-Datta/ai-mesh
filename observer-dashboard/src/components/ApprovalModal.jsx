import { useState, useEffect } from 'react';
import { ShieldAlert, Check, X } from 'lucide-react';

export default function ApprovalModal({ systemEvents, onApprove }) {
  const [activeRequest, setActiveRequest] = useState(null);

  // Look for the most recent unhandled approval request
  useEffect(() => {
    // A simple way to handle this is to look at the latest event.
    // If it's an approval request, show it.
    if (systemEvents.length === 0) return;
    
    const latestEvent = systemEvents[0];
    if (latestEvent.event === 'approval_required') {
      // Check if we already handled it by looking at our local state or if it's new
      if (activeRequest?.action_id !== latestEvent.details.action_id) {
        setActiveRequest(latestEvent.details);
      }
    }
  }, [systemEvents]);

  if (!activeRequest) return null;

  const handleAction = (approved) => {
    onApprove(activeRequest.action_id, approved);
    setActiveRequest(null);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md bg-mesh-800 border-2 border-neon-purple rounded-2xl shadow-2xl shadow-neon-purple/20 overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="bg-neon-purple/20 px-5 py-4 border-b border-neon-purple/30 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-neon-purple/20 flex items-center justify-center text-neon-purple">
            <ShieldAlert size={24} />
          </div>
          <div>
            <h2 className="text-neon-purple font-mono font-bold text-lg">Human Approval Required</h2>
            <p className="text-neon-purple/80 text-xs font-mono uppercase tracking-wider">Man in the Middle Protocol</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <h3 className="text-mesh-100 font-semibold text-lg">{activeRequest.title}</h3>
          <p className="text-mesh-300 text-sm leading-relaxed">
            {activeRequest.description}
          </p>

          {activeRequest.details && Object.keys(activeRequest.details).length > 0 && (
            <div className="bg-mesh-900/50 border border-mesh-700/50 rounded-lg p-3">
              <pre className="text-[10px] text-mesh-400 font-mono whitespace-pre-wrap break-all">
                {JSON.stringify(activeRequest.details, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-mesh-700/50 flex gap-3">
          <button 
            onClick={() => handleAction(false)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 border-red-500/50 text-red-400 hover:bg-red-500/10 font-mono text-sm transition-all"
          >
            <X size={16} /> Reject
          </button>
          <button 
            onClick={() => handleAction(true)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-neon-purple text-mesh-900 hover:opacity-90 font-mono font-bold text-sm shadow-lg shadow-neon-purple/20 transition-all"
          >
            <Check size={16} /> Approve
          </button>
        </div>

      </div>
    </div>
  );
}
