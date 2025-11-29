import React, { useState, useEffect } from "react";
import api from "../../services/api";
import { encodeBase64 } from "../../utils/crypto";

export default function DeviceSync({ myUserId, onEvent }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deviceName, setDeviceName] = useState("");

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    try {
      const res = await api.get("/devices");
      setDevices(res.data || []);
    } catch (err) {
      console.error("Failed to load devices:", err);
    }
  };

  const registerDevice = async () => {
    if (!deviceName.trim()) {
      alert("Please enter a device name");
      return;
    }

    setLoading(true);
    try {
      // Get current keys
      const identitySecretKey = localStorage.getItem("identitySecretKey");
      const identityPublicKey = localStorage.getItem("identityPublicKey");
      const preKeySecrets = localStorage.getItem("preKeySecrets");

      if (!identitySecretKey || !identityPublicKey) {
        alert("No keys found. Please generate keys first.");
        return;
      }

      // Generate device key (derived from user password + device name)
      // In production, use PBKDF2 with user password
      const deviceKey = btoa(`${myUserId}_${deviceName}_${Date.now()}`);

      // Encrypt keys (in production, encrypt with device-specific key derived from password)
      // For now, we'll store them encrypted with a simple key
      const encryptedIdentityKey = btoa(identitySecretKey); // Simplified - should be properly encrypted
      const encryptedPreKeys = preKeySecrets ? btoa(preKeySecrets) : null;

      await api.post("/devices/register", {
        deviceName: deviceName.trim(),
        deviceType: "browser",
        userAgent: navigator.userAgent,
        encryptedIdentityKey,
        encryptedPreKeys,
        deviceKey
      });

      // Store device key locally
      localStorage.setItem("deviceKey", deviceKey);
      localStorage.setItem("deviceName", deviceName.trim());

      setDeviceName("");
      await loadDevices();
      onEvent?.("Device registered successfully", "success");
    } catch (err) {
      console.error("Failed to register device:", err);
      onEvent?.("Failed to register device", "error");
    } finally {
      setLoading(false);
    }
  };

  const syncFromDevice = async (deviceKey) => {
    setLoading(true);
    try {
      const res = await api.get(`/devices/keys?deviceKey=${deviceKey}`);
      
      // Decrypt and restore keys
      const identitySecretKey = atob(res.data.encryptedIdentityKey);
      const preKeySecrets = res.data.encryptedPreKeys ? atob(res.data.encryptedPreKeys) : null;

      localStorage.setItem("identitySecretKey", identitySecretKey);
      if (preKeySecrets) {
        localStorage.setItem("preKeySecrets", preKeySecrets);
      }

      // Update device sync time
      await api.post("/devices/sync", {
        deviceKey,
        encryptedIdentityKey: res.data.encryptedIdentityKey,
        encryptedPreKeys: res.data.encryptedPreKeys
      });

      onEvent?.("Keys synced from device. Please refresh the page.", "success");
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      console.error("Failed to sync keys:", err);
      onEvent?.("Failed to sync keys", "error");
    } finally {
      setLoading(false);
    }
  };

  const removeDevice = async (deviceId) => {
    if (!window.confirm("Remove this device?")) return;

    try {
      await api.delete(`/devices/${deviceId}`);
      await loadDevices();
      onEvent?.("Device removed", "info");
    } catch (err) {
      console.error("Failed to remove device:", err);
      onEvent?.("Failed to remove device", "error");
    }
  };

  const currentDeviceKey = localStorage.getItem("deviceKey");

  return (
    <div className="info-section">
      <h4 style={{ marginTop: 0 }}>Multi-Device Sync</h4>
      <p className="contact-meta" style={{ marginBottom: "16px" }}>
        Sync your encryption keys across multiple devices for seamless access.
      </p>

      <div style={{ marginBottom: "16px" }}>
        <input
          type="text"
          className="input-field"
          placeholder="Device name (e.g., My Laptop)"
          value={deviceName}
          onChange={e => setDeviceName(e.target.value)}
          style={{ marginBottom: "8px" }}
        />
        <button
          className="primary-btn"
          onClick={registerDevice}
          disabled={loading || !deviceName.trim()}
          style={{ width: "100%" }}
        >
          {loading ? "Registering..." : "Register This Device"}
        </button>
      </div>

      {devices.length > 0 && (
        <div>
          <h5 style={{ fontSize: "0.9rem", marginBottom: "12px" }}>Your Devices</h5>
          {devices.map(device => (
            <div
              key={device._id}
              style={{
                padding: "12px",
                marginBottom: "8px",
                background: "rgba(255, 255, 255, 0.05)",
                borderRadius: "8px",
                border: "1px solid var(--border)"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{device.deviceName}</div>
                  <div className="contact-meta" style={{ fontSize: "0.75rem" }}>
                    {device.deviceType} • Last sync: {new Date(device.lastSyncAt).toLocaleString()}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  {device.deviceKey !== currentDeviceKey && (
                    <button
                      className="secondary-btn"
                      onClick={() => syncFromDevice(device.deviceKey)}
                      disabled={loading}
                      style={{ fontSize: "10px", padding: "4px 8px" }}
                    >
                      Sync
                    </button>
                  )}
                  <button
                    className="secondary-btn"
                    onClick={() => removeDevice(device._id)}
                    style={{ fontSize: "10px", padding: "4px 8px" }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

