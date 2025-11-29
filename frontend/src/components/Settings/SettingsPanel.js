import React, { useState, useEffect } from "react";
import api from "../../services/api";

export default function SettingsPanel({ onEvent }) {
  const [settings, setSettings] = useState({
    readReceiptsEnabled: true,
    typingIndicatorsEnabled: true,
    theme: 'dark'
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await api.get("/settings");
      setSettings(res.data);
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  };

  const updateSetting = async (key, value) => {
    setLoading(true);
    try {
      const res = await api.patch("/settings", { [key]: value });
      setSettings(res.data);
      
      // Apply theme immediately
      if (key === 'theme') {
        applyTheme(value);
      }
      
      onEvent?.("Settings updated", "success");
    } catch (err) {
      console.error("Failed to update settings:", err);
      onEvent?.("Failed to update settings", "error");
    } finally {
      setLoading(false);
    }
  };

  const applyTheme = (theme) => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.style.setProperty('--bg-gradient', 'linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 45%, #dde4eb 100%)');
      root.style.setProperty('--surface', '#ffffff');
      root.style.setProperty('--text', '#1a1a1a');
      root.style.setProperty('--text-muted', 'rgba(26, 26, 26, 0.68)');
    } else if (theme === 'dark') {
      root.style.setProperty('--bg-gradient', 'linear-gradient(135deg, #070a1a 0%, #111d3b 45%, #12294b 100%)');
      root.style.setProperty('--surface', '#111829');
      root.style.setProperty('--text', '#edf2ff');
      root.style.setProperty('--text-muted', 'rgba(237, 242, 255, 0.68)');
    } else {
      // Auto - use system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.style.setProperty('--bg-gradient', 'linear-gradient(135deg, #070a1a 0%, #111d3b 45%, #12294b 100%)');
        root.style.setProperty('--surface', '#111829');
        root.style.setProperty('--text', '#edf2ff');
        root.style.setProperty('--text-muted', 'rgba(237, 242, 255, 0.68)');
      } else {
        root.style.setProperty('--bg-gradient', 'linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 45%, #dde4eb 100%)');
        root.style.setProperty('--surface', '#ffffff');
        root.style.setProperty('--text', '#1a1a1a');
        root.style.setProperty('--text-muted', 'rgba(26, 26, 26, 0.68)');
      }
    }
  };

  useEffect(() => {
    // Apply theme on load
    if (settings.theme) {
      applyTheme(settings.theme);
    }
  }, []);

  return (
    <div className="info-section">
      <h4 style={{ marginTop: 0 }}>Privacy Settings</h4>
      
      <div style={{ marginBottom: "16px" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={settings.readReceiptsEnabled}
            onChange={e => updateSetting("readReceiptsEnabled", e.target.checked)}
            disabled={loading}
          />
          <span>Read Receipts</span>
        </label>
        <p className="contact-meta" style={{ marginTop: "4px", marginLeft: "24px" }}>
          Let others know when you've read their messages
        </p>
      </div>

      <div style={{ marginBottom: "16px" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={settings.typingIndicatorsEnabled}
            onChange={e => updateSetting("typingIndicatorsEnabled", e.target.checked)}
            disabled={loading}
          />
          <span>Typing Indicators</span>
        </label>
        <p className="contact-meta" style={{ marginTop: "4px", marginLeft: "24px" }}>
          Show when you're typing a message
        </p>
      </div>

      <div>
        <label style={{ display: "block", marginBottom: "8px" }}>Theme</label>
        <select
          value={settings.theme}
          onChange={e => updateSetting("theme", e.target.value)}
          disabled={loading}
          className="input-field"
          style={{ width: "100%" }}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="auto">Auto (System)</option>
        </select>
      </div>
    </div>
  );
}

