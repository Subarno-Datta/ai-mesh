import { useState, useEffect, useCallback, useRef } from 'react';

const WS_URL = 'ws://localhost:8765';

/**
 * Custom hook for managing the WebSocket connection to the Swarm Engine.
 * Provides real-time agent states, incidents, log entries, and settings.
 */
export function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const [agents, setAgents] = useState({});
  const [incidents, setIncidents] = useState([]);
  const [logs, setLogs] = useState([]);
  const [systemEvents, setSystemEvents] = useState([]);
  const [settings, setSettings] = useState({});
  const [settingsResponse, setSettingsResponse] = useState(null);
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log('[WS] Connected to Swarm Engine');
      setConnected(true);
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleMessage(msg);
      } catch (e) {
        console.error('[WS] Parse error:', e);
      }
    };

    ws.onclose = () => {
      console.log('[WS] Disconnected');
      setConnected(false);
      reconnectRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = (error) => {
      console.error('[WS] Error:', error);
    };

    wsRef.current = ws;
  }, []);

  const handleMessage = useCallback((msg) => {
    switch (msg.type) {
      case 'state_snapshot':
        if (msg.data.agents) setAgents(msg.data.agents);
        if (msg.data.incidents) {
          const incMap = new Map();
          msg.data.incidents.forEach(i => incMap.set(i.incident_id, i));
          setIncidents(Array.from(incMap.values()));
        }
        if (msg.data.logs) setLogs(prev => [...prev, ...msg.data.logs].slice(-200));
        if (msg.data.settings) setSettings(msg.data.settings);
        break;

      case 'agent_state':
        setAgents(prev => ({
          ...prev,
          [msg.data.agent]: msg.data
        }));
        break;

      case 'incident_update':
        setIncidents(prev => {
          const existing = prev.findIndex(i => i.incident_id === msg.data.incident_id);
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = msg.data;
            return updated;
          }
          return [msg.data, ...prev].slice(0, 50);
        });
        break;

      case 'log_entry':
        setLogs(prev => [...prev, msg.data].slice(-200));
        break;

      case 'system_event':
        setSystemEvents(prev => [msg.data, ...prev].slice(0, 30));
        break;

      case 'settings_response':
        setSettingsResponse({ type: msg.response_type, data: msg.data });
        if (msg.response_type === 'current_settings') {
          setSettings(msg.data);
        }
        break;

      default:
        break;
    }
  }, []);

  const sendMessage = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const triggerCrash = useCallback((crashType) => {
    sendMessage({ type: 'trigger_crash', data: { crash_type: crashType } });
  }, [sendMessage]);

  // --- Settings Commands ---
  const listModels = useCallback(() => {
    sendMessage({ type: 'list_models' });
  }, [sendMessage]);

  const updateLLM = useCallback((config) => {
    sendMessage({ type: 'update_llm', data: config });
  }, [sendMessage]);

  const updateTarget = useCallback((config) => {
    sendMessage({ type: 'update_target', data: config });
  }, [sendMessage]);

  const getSettings = useCallback(() => {
    sendMessage({ type: 'get_settings' });
  }, [sendMessage]);

  const updateHITL = useCallback((enabled) => {
    sendMessage({ type: 'update_hitl', data: { enabled } });
  }, [sendMessage]);

  const sendApproval = useCallback((actionId, approved) => {
    sendMessage({ type: 'action_approval', data: { action_id: actionId, approved } });
  }, [sendMessage]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  return {
    connected,
    agents,
    incidents,
    logs,
    systemEvents,
    settings,
    settingsResponse,
    triggerCrash,
    sendMessage,
    listModels,
    updateLLM,
    updateTarget,
    getSettings,
    updateHITL,
    sendApproval,
  };
}
