import { useMemo } from 'react';
import { FileCode2, GitBranch } from 'lucide-react';

export default function CodeDiffViewer({ incident }) {
  if (!incident) {
    return (
      <div className="glass-card p-6 flex flex-col items-center justify-center min-h-[300px]">
        <FileCode2 className="w-10 h-10 text-mesh-500 mb-3" />
        <p className="text-mesh-400 text-sm">Select an incident to view code diff</p>
      </div>
    );
  }

  const patchData = useMemo(() => {
    if (!incident.patched_code) return null;
    try {
      return JSON.parse(incident.patched_code);
    } catch {
      return null;
    }
  }, [incident.patched_code]);

  const fileName = incident.faulty_file
    ? incident.faulty_file.split(/[/\\]/).pop()
    : 'unknown file';

  return (
    <div className="glass-card p-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <GitBranch className="w-4 h-4 text-neon-purple" />
        <h2 className="text-sm font-semibold text-mesh-200 uppercase tracking-wider">Code Patch</h2>
        <span className="ml-auto text-[10px] font-mono text-mesh-400 bg-mesh-700/50 px-2 py-0.5 rounded">
          {fileName}:{incident.faulty_line || '?'}
        </span>
      </div>

      {/* Diagnosis */}
      {patchData?.diagnosis && (
        <div className="mb-3 p-2.5 rounded-lg bg-neon-purple/5 border border-neon-purple/20">
          <p className="text-xs text-mesh-200">
            <span className="text-neon-purple font-semibold">Diagnosis: </span>
            {patchData.diagnosis}
          </p>
          {patchData.confidence && (
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[10px] text-mesh-400">Confidence</span>
              <div className="flex-1 h-1 bg-mesh-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-neon-purple to-neon-blue rounded-full transition-all duration-1000"
                  style={{ width: `${(patchData.confidence || 0) * 100}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-neon-purple">
                {((patchData.confidence || 0) * 100).toFixed(0)}%
              </span>
            </div>
          )}
        </div>
      )}

      {/* Diff View */}
      <div className="space-y-2 overflow-auto max-h-[400px]">
        {/* Original */}
        {patchData?.original_code && (
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full bg-neon-red" />
              <span className="text-[10px] text-mesh-400 uppercase tracking-wider font-semibold">Original (Buggy)</span>
            </div>
            <pre className="terminal-text p-3 rounded-lg bg-neon-red/5 border border-neon-red/10 overflow-x-auto">
              <code className="text-mesh-200">
                {patchData.original_code}
              </code>
            </pre>
          </div>
        )}

        {/* Arrow */}
        {patchData?.original_code && patchData?.patched_code && (
          <div className="flex justify-center py-1">
            <div className="text-mesh-500 text-lg">↓</div>
          </div>
        )}

        {/* Patched */}
        {patchData?.patched_code && (
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full bg-neon-green" />
              <span className="text-[10px] text-mesh-400 uppercase tracking-wider font-semibold">Patched (Fixed)</span>
            </div>
            <pre className="terminal-text p-3 rounded-lg bg-neon-green/5 border border-neon-green/10 overflow-x-auto">
              <code className="text-mesh-200">
                {patchData.patched_code}
              </code>
            </pre>
          </div>
        )}

        {/* No patch yet */}
        {!patchData && (
          <div className="text-center py-8">
            <p className="text-mesh-400 text-sm">
              {incident.status === 'detected' || incident.status === 'investigating'
                ? 'Patch is being generated...'
                : 'No patch data available'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
