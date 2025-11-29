import React, { useState, useEffect } from "react";
import api from "../../services/api";

export default function SettingsPanel({ onEvent }) {
  const [settings, setSettings] = useState({
    readReceiptsEnabled: true,
    typingIndicatorsEnabled: true,
    theme: 'dark'
  });
  const [userProfile, setUserProfile] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSettings();
    loadUserProfile();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await api.get("/settings");
      setSettings(res.data);
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  };

  const loadUserProfile = async () => {
    try {
      const res = await api.get("/users/me");
      setUserProfile(res.data);
    } catch (err) {
      console.error("Failed to load profile:", err);
    }
  };

  const handleProfilePictureChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Convert to base64
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result;
      try {
        setLoading(true);
        const res = await api.put("/users/me", { profilePicture: base64 });
        setUserProfile(res.data);
        onEvent?.("Profile picture updated", "success");
      } catch (err) {
        console.error("Failed to update profile picture:", err);
        onEvent?.("Failed to update profile picture", "error");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
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
      <div style={{ marginBottom: "24px", textAlign: "center" }}>
        <div style={{ 
          width: "100px", 
          height: "100px", 
          borderRadius: "50%", 
          margin: "0 auto 16px", 
          overflow: "hidden", 
          border: "2px solid var(--primary)",
          position: "relative",
          background: "var(--glass-surface)"
        }}>
          {userProfile.profilePicture ? (
            <img src={userProfile.profilePicture} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "40px" }}>
              👤
            </div>
          )}
          <label style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            background: "rgba(0,0,0,0.6)",
            color: "white",
            fontSize: "10px",
            padding: "4px",
            cursor: "pointer"
          }}>
            CHANGE
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleProfilePictureChange} 
              style={{ display: "none" }} 
            />
          </label>
        </div>
        <h3 style={{ margin: "0" }}>{userProfile.name || "User"}</h3>
        <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: "0.9rem" }}>@{userProfile.username}</p>
      </div>

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
    </div >
  );
}

