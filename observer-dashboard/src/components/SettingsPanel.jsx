import { useState, useEffect } from 'react';
import { Settings, Cpu, Globe, FolderGit2, ChevronDown, Check, AlertCircle, Loader2, X } from 'lucide-react';

/**
 * Settings Panel — configure LLM provider and target project from the dashboard.
 */
export default function SettingsPanel({
  settings,
  settingsResponse,
  onListModels,
  onUpdateLLM,
  onUpdateTarget,
  onGetSettings,
  onUpdateHITL,
  disabled
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState('llm'); // 'llm' | 'target'
  const [hitlEnabled, setHitlEnabled] = useState(() => {
    return localStorage.getItem('hitlEnabled') === 'true';
  });

  // LLM state
  const [llmProvider, setLlmProvider] = useState(() => localStorage.getItem('llmProvider') || 'ollama');
  const [ollamaModels, setOllamaModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem('selectedModel') || '');
  const [apiToken, setApiToken] = useState(() => localStorage.getItem('apiToken') || '');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('apiKey') || '');
  const [apiBaseUrl, setApiBaseUrl] = useState(() => localStorage.getItem('apiBaseUrl') || 'https://api.openai.com/v1');
  const [cloudModel, setCloudModel] = useState(() => localStorage.getItem('cloudModel') || '');
  const [hfModelId, setHfModelId] = useState(() => localStorage.getItem('hfModelId') || 'Qwen/Qwen2.5-Coder-32B-Instruct');
  const [loadingModels, setLoadingModels] = useState(false);

  // Target state
  const [targetSource, setTargetSource] = useState(() => localStorage.getItem('targetSource') || 'local');
  const [localPath, setLocalPath] = useState(() => localStorage.getItem('localPath') || '');
  const [githubUrl, setGithubUrl] = useState(() => localStorage.getItem('githubUrl') || '');
  const [entryPoint, setEntryPoint] = useState(() => localStorage.getItem('entryPoint') || '');
  const [targetPort, setTargetPort] = useState(() => localStorage.getItem('targetPort') || '4000');

  // Feedback
  const [feedback, setFeedback] = useState(null);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('hitlEnabled', hitlEnabled);
    localStorage.setItem('llmProvider', llmProvider);
    localStorage.setItem('selectedModel', selectedModel);
    localStorage.setItem('apiToken', apiToken);
    localStorage.setItem('apiKey', apiKey);
    localStorage.setItem('apiBaseUrl', apiBaseUrl);
    localStorage.setItem('cloudModel', cloudModel);
    localStorage.setItem('hfModelId', hfModelId);
    localStorage.setItem('targetSource', targetSource);
    localStorage.setItem('localPath', localPath);
    localStorage.setItem('githubUrl', githubUrl);
    localStorage.setItem('entryPoint', entryPoint);
    localStorage.setItem('targetPort', targetPort);
  }, [
    hitlEnabled, llmProvider, selectedModel, apiToken, apiKey, apiBaseUrl, cloudModel, 
    hfModelId, targetSource, localPath, githubUrl, entryPoint, targetPort
  ]);

  // Handle settings responses
  useEffect(() => {
    if (!settingsResponse) return;

    if (settingsResponse.type === 'models_list') {
      setOllamaModels(settingsResponse.data.models || []);
      setLoadingModels(false);
    } else if (settingsResponse.type === 'llm_updated') {
      setFeedback({ type: 'success', message: `LLM switched to ${settingsResponse.data.provider}` });
      setTimeout(() => setFeedback(null), 4000);
    } else if (settingsResponse.type === 'target_updated') {
      setFeedback({ type: 'success', message: 'Target project updated successfully' });
      setTimeout(() => setFeedback(null), 4000);
    } else if (settingsResponse.type === 'error') {
      setFeedback({ type: 'error', message: settingsResponse.data.message });
      setTimeout(() => setFeedback(null), 6000);
    }
  }, [settingsResponse]);

  // Sync settings from server
  useEffect(() => {
    if (settings?.llm?.provider_type) {
      const pType = settings.llm.provider_type;
      if (pType === 'OllamaProvider') setLlmProvider('ollama');
      else if (pType === 'HuggingFaceProvider') setLlmProvider('huggingface');
      else if (pType === 'OpenAIProvider') setLlmProvider('openai');
    }
    if (settings?.target?.target_dir) {
      setLocalPath(settings.target.target_dir);
    }
    if (settings?.target?.entry_point) {
      setEntryPoint(settings.target.entry_point);
    }
    if (settings?.hitl !== undefined) {
      setHitlEnabled(settings.hitl.enabled);
    }
  }, [settings]);

  const handleFetchModels = () => {
    setLoadingModels(true);
    onListModels();
  };

  const handleApplyLLM = () => {
    if (llmProvider === 'ollama') {
      if (!selectedModel) return;
      onUpdateLLM({ provider: 'ollama', model: selectedModel });
    } else if (llmProvider === 'huggingface') {
      onUpdateLLM({ provider: 'huggingface', api_token: apiToken, model_id: hfModelId });
    } else if (llmProvider === 'openai') {
      onUpdateLLM({ provider: 'openai', api_key: apiKey, base_url: apiBaseUrl, model: cloudModel });
    }
    setIsOpen(false);
  };

  const handleApplyTarget = () => {
    if (targetSource === 'local') {
      if (!localPath) return;
      onUpdateTarget({
        source: 'local',
        path: localPath,
        entry_point: entryPoint || undefined,
        port: parseInt(targetPort) || 4000,
      });
    } else {
      if (!githubUrl) return;
      onUpdateTarget({
        source: 'github',
        repo_url: githubUrl,
        entry_point: entryPoint || undefined,
        port: parseInt(targetPort) || 4000,
      });
    }
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => { setIsOpen(true); onGetSettings(); }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-mesh-800/60 border border-mesh-700/50
                   hover:border-neon-blue/30 hover:bg-mesh-700/40 transition-all text-mesh-300 text-xs font-mono"
      >
        <Settings size={14} className="text-neon-blue" />
        Settings
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-xl bg-mesh-800/95 border border-mesh-700/50 rounded-2xl shadow-2xl
                      shadow-neon-blue/5 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-mesh-700/50">
          <div className="flex items-center gap-2">
            <Settings size={16} className="text-neon-blue" />
            <span className="font-mono text-sm font-bold text-mesh-100">Configuration</span>
          </div>
          <button onClick={() => setIsOpen(false)}
            className="p-1 rounded-lg hover:bg-mesh-700/40 text-mesh-400 hover:text-mesh-200 transition-all">
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-mesh-700/50">
          <button
            onClick={() => setTab('llm')}
            className={`flex-1 px-4 py-2.5 text-xs font-mono font-medium flex items-center justify-center gap-2
              transition-all ${tab === 'llm'
                ? 'text-neon-blue border-b-2 border-neon-blue bg-neon-blue/5'
                : 'text-mesh-400 hover:text-mesh-200'}`}
          >
            <Cpu size={14} /> LLM Provider
          </button>
          <button
            onClick={() => setTab('target')}
            className={`flex-1 px-4 py-2.5 text-xs font-mono font-medium flex items-center justify-center gap-2
              transition-all ${tab === 'target'
                ? 'text-neon-purple border-b-2 border-neon-purple bg-neon-purple/5'
                : 'text-mesh-400 hover:text-mesh-200'}`}
          >
            <FolderGit2 size={14} /> Target Project
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">

          {/* Feedback banner */}
          {feedback && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono
              ${feedback.type === 'success' ? 'bg-neon-green/10 border border-neon-green/30 text-neon-green'
                : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
              {feedback.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
              {feedback.message}
            </div>
          )}

          {/* Current provider info */}
          {settings?.llm && (
            <div className="px-3 py-2 rounded-lg bg-mesh-900/60 border border-mesh-700/30 text-xs font-mono text-mesh-400">
              Active: <span className="text-neon-green">{settings.llm.provider}</span>
            </div>
          )}

          {tab === 'llm' && (
            <>
              {/* Provider selector */}
              <div>
                <label className="text-[10px] text-mesh-500 font-mono uppercase tracking-wider">Provider</label>
                <div className="flex gap-2 mt-1">
                  {[
                    { id: 'ollama', label: 'Ollama (Local)', icon: Cpu },
                    { id: 'huggingface', label: 'Hugging Face', icon: Globe },
                    { id: 'openai', label: 'OpenAI / Cloud', icon: Globe },
                  ].map(p => (
                    <button key={p.id} onClick={() => setLlmProvider(p.id)}
                      className={`flex-1 px-3 py-2 rounded-lg text-[11px] font-mono flex items-center justify-center gap-1.5
                        border transition-all ${llmProvider === p.id
                          ? 'border-neon-blue/50 bg-neon-blue/10 text-neon-blue'
                          : 'border-mesh-700/40 bg-mesh-900/40 text-mesh-400 hover:border-mesh-600'}`}
                    >
                      <p.icon size={12} /> {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ollama model selector */}
              {llmProvider === 'ollama' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <button onClick={handleFetchModels} disabled={loadingModels}
                      className="px-3 py-1.5 rounded-lg bg-neon-blue/10 border border-neon-blue/30
                        text-neon-blue text-[11px] font-mono hover:bg-neon-blue/20 transition-all
                        disabled:opacity-50 flex items-center gap-1.5">
                      {loadingModels ? <Loader2 size={12} className="animate-spin" /> : <Cpu size={12} />}
                      {loadingModels ? 'Scanning...' : 'Scan Local Models'}
                    </button>
                  </div>
                  {ollamaModels.length > 0 && (
                    <div className="space-y-1">
                      <label className="text-[10px] text-mesh-500 font-mono uppercase tracking-wider">
                        Available Models ({ollamaModels.length})
                      </label>
                      <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                        {ollamaModels.map(m => (
                          <button key={m.name} onClick={() => setSelectedModel(m.name)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-[11px] font-mono
                              border transition-all flex items-center justify-between
                              ${selectedModel === m.name
                                ? 'border-neon-green/50 bg-neon-green/10 text-neon-green'
                                : 'border-mesh-700/30 bg-mesh-900/40 text-mesh-300 hover:border-mesh-600'}`}
                          >
                            <span>{m.name}</span>
                            <span className="text-mesh-500 text-[10px]">
                              {m.params} • {m.size_gb}GB • {m.quantization}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Hugging Face config */}
              {llmProvider === 'huggingface' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] text-mesh-500 font-mono uppercase tracking-wider">
                      API Token <span className="text-mesh-600">(huggingface.co/settings/tokens)</span>
                    </label>
                    <input type="password" value={apiToken} onChange={e => setApiToken(e.target.value)}
                      placeholder="hf_xxxxxxxxxx"
                      className="w-full mt-1 px-3 py-2 rounded-lg bg-mesh-900/60 border border-mesh-700/40
                        text-mesh-200 text-xs font-mono placeholder:text-mesh-600
                        focus:border-neon-blue/50 focus:outline-none transition-all" />
                  </div>
                  <div>
                    <label className="text-[10px] text-mesh-500 font-mono uppercase tracking-wider">Model ID</label>
                    <input type="text" value={hfModelId} onChange={e => setHfModelId(e.target.value)}
                      placeholder="Qwen/Qwen2.5-Coder-32B-Instruct"
                      className="w-full mt-1 px-3 py-2 rounded-lg bg-mesh-900/60 border border-mesh-700/40
                        text-mesh-200 text-xs font-mono placeholder:text-mesh-600
                        focus:border-neon-blue/50 focus:outline-none transition-all" />
                  </div>
                  <div className="text-[10px] text-mesh-500 font-mono leading-relaxed px-1">
                    Suggested: Qwen/Qwen2.5-Coder-32B-Instruct • google/gemma-2-9b-it •
                    bigcode/starcoder2-15b-instruct-v0.1
                  </div>
                </div>
              )}

              {/* OpenAI-compat config */}
              {llmProvider === 'openai' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] text-mesh-500 font-mono uppercase tracking-wider">API Key</label>
                    <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
                      placeholder="sk-xxxxxxxx or gsk_xxxxxxxx"
                      className="w-full mt-1 px-3 py-2 rounded-lg bg-mesh-900/60 border border-mesh-700/40
                        text-mesh-200 text-xs font-mono placeholder:text-mesh-600
                        focus:border-neon-blue/50 focus:outline-none transition-all" />
                  </div>
                  <div>
                    <label className="text-[10px] text-mesh-500 font-mono uppercase tracking-wider">Base URL</label>
                    <input type="text" value={apiBaseUrl} onChange={e => setApiBaseUrl(e.target.value)}
                      placeholder="https://api.openai.com/v1"
                      className="w-full mt-1 px-3 py-2 rounded-lg bg-mesh-900/60 border border-mesh-700/40
                        text-mesh-200 text-xs font-mono placeholder:text-mesh-600
                        focus:border-neon-blue/50 focus:outline-none transition-all" />
                  </div>
                  <div>
                    <label className="text-[10px] text-mesh-500 font-mono uppercase tracking-wider">Model</label>
                    <input type="text" value={cloudModel} onChange={e => setCloudModel(e.target.value)}
                      placeholder="gpt-4o-mini"
                      className="w-full mt-1 px-3 py-2 rounded-lg bg-mesh-900/60 border border-mesh-700/40
                        text-mesh-200 text-xs font-mono placeholder:text-mesh-600
                        focus:border-neon-blue/50 focus:outline-none transition-all" />
                  </div>
                  <div className="text-[10px] text-mesh-500 font-mono leading-relaxed px-1">
                    Compatible: OpenAI • Groq (api.groq.com/openai/v1) •
                    Together • OpenRouter • Fireworks • llama.cpp
                  </div>
                </div>
              )}
            </>
          )}

          {tab === 'target' && (
            <>
              {/* Current target info */}
              {settings?.target && (
                <div className="px-3 py-2 rounded-lg bg-mesh-900/60 border border-mesh-700/30 text-xs font-mono text-mesh-400 space-y-1">
                  <div>Path: <span className="text-mesh-300">{settings.target.target_dir || 'Not set'}</span></div>
                  <div>Entry: <span className="text-mesh-300">{settings.target.entry_point}</span></div>
                  <div>Status: <span className={settings.target.is_running ? 'text-neon-green' : 'text-red-400'}>
                    {settings.target.is_running ? 'Running' : 'Stopped'}
                  </span></div>
                </div>
              )}

              {/* Source selector */}
              <div>
                <label className="text-[10px] text-mesh-500 font-mono uppercase tracking-wider">Source</label>
                <div className="flex gap-2 mt-1">
                  <button onClick={() => setTargetSource('local')}
                    className={`flex-1 px-3 py-2 rounded-lg text-[11px] font-mono flex items-center justify-center gap-1.5
                      border transition-all ${targetSource === 'local'
                        ? 'border-neon-purple/50 bg-neon-purple/10 text-neon-purple'
                        : 'border-mesh-700/40 bg-mesh-900/40 text-mesh-400 hover:border-mesh-600'}`}>
                    <FolderGit2 size={12} /> Local Path
                  </button>
                  <button onClick={() => setTargetSource('github')}
                    className={`flex-1 px-3 py-2 rounded-lg text-[11px] font-mono flex items-center justify-center gap-1.5
                      border transition-all ${targetSource === 'github'
                        ? 'border-neon-purple/50 bg-neon-purple/10 text-neon-purple'
                        : 'border-mesh-700/40 bg-mesh-900/40 text-mesh-400 hover:border-mesh-600'}`}>
                    <Globe size={12} /> GitHub URL
                  </button>
                </div>
              </div>

              {targetSource === 'local' ? (
                <div>
                  <label className="text-[10px] text-mesh-500 font-mono uppercase tracking-wider">Project Path</label>
                  <input type="text" value={localPath} onChange={e => setLocalPath(e.target.value)}
                    placeholder="C:\path\to\your\project or /home/user/project"
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-mesh-900/60 border border-mesh-700/40
                      text-mesh-200 text-xs font-mono placeholder:text-mesh-600
                      focus:border-neon-purple/50 focus:outline-none transition-all" />
                </div>
              ) : (
                <div>
                  <label className="text-[10px] text-mesh-500 font-mono uppercase tracking-wider">Repository URL</label>
                  <input type="text" value={githubUrl} onChange={e => setGithubUrl(e.target.value)}
                    placeholder="https://github.com/user/repo.git"
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-mesh-900/60 border border-mesh-700/40
                      text-mesh-200 text-xs font-mono placeholder:text-mesh-600
                      focus:border-neon-purple/50 focus:outline-none transition-all" />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-mesh-500 font-mono uppercase tracking-wider">
                    Entry Point <span className="text-mesh-600">(auto-detect if empty)</span>
                  </label>
                  <input type="text" value={entryPoint} onChange={e => setEntryPoint(e.target.value)}
                    placeholder="server.js"
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-mesh-900/60 border border-mesh-700/40
                      text-mesh-200 text-xs font-mono placeholder:text-mesh-600
                      focus:border-neon-purple/50 focus:outline-none transition-all" />
                </div>
                <div>
                  <label className="text-[10px] text-mesh-500 font-mono uppercase tracking-wider">Port</label>
                  <input type="text" value={targetPort} onChange={e => setTargetPort(e.target.value)}
                    placeholder="4000"
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-mesh-900/60 border border-mesh-700/40
                      text-mesh-200 text-xs font-mono placeholder:text-mesh-600
                      focus:border-neon-purple/50 focus:outline-none transition-all" />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-mesh-700/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-mesh-300 font-mono flex items-center gap-2 cursor-pointer hover:text-neon-purple transition-colors">
              <input 
                type="checkbox" 
                checked={hitlEnabled} 
                onChange={(e) => {
                  setHitlEnabled(e.target.checked);
                  onUpdateHITL(e.target.checked);
                }} 
                className="rounded border-mesh-600 bg-mesh-900/50 text-neon-purple focus:ring-neon-purple focus:ring-offset-mesh-800" 
              />
              HITL Mode (Man-in-the-Middle)
            </label>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setIsOpen(false)}
              className="px-4 py-1.5 rounded-lg text-xs font-mono text-mesh-400
                border border-mesh-700/40 hover:border-mesh-600 transition-all">
              Cancel
            </button>
            <button
              onClick={tab === 'llm' ? handleApplyLLM : handleApplyTarget}
              disabled={disabled}
              className="px-4 py-1.5 rounded-lg text-xs font-mono font-medium text-mesh-900
                bg-gradient-to-r from-neon-blue to-neon-purple hover:opacity-90
                disabled:opacity-50 transition-all flex items-center gap-1.5"
            >
              <Check size={12} /> Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
