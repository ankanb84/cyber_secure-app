import React, { useState } from "react";
import { generatePreKeys, encodeBase64 } from "../../utils/crypto";

export default function KeyManager({ onEvent }) {
  const [status, setStatus] = useState("");
  const [identityPublicKey, setIdentityPublicKey] = useState(
    () => localStorage.getItem("identityPublicKey")
  );

  async function regenPreKeys() {
    try {
      setStatus("Generating fresh one-time prekeys…");
      const newPreKeys = await generatePreKeys(5);
      const preKeySecrets = JSON.parse(localStorage.getItem("preKeySecrets") || "{}");
      newPreKeys.forEach(pk => {
        preKeySecrets[pk.keyId] = encodeBase64(pk.secretKey);
      });
      localStorage.setItem("preKeySecrets", JSON.stringify(preKeySecrets));
      setStatus("Stored locally. Upload when backend requests new batch.");
      onEvent?.("Local prekeys rotated", "success");
    } catch (err) {
      console.error(err);
      setStatus("Error: " + err.message);
      onEvent?.("Prekey regeneration failed", "error");
    }
  }

  function clearSessionKeys() {
    localStorage.removeItem("identitySecretKey");
    localStorage.removeItem("identityPublicKey");
    localStorage.removeItem("preKeySecrets");
    setStatus("Ephemeral session keys cleared from this browser.");
    setIdentityPublicKey(null);
    onEvent?.("Cleared active identity keys", "warn");
  }

  return (
    <div className="info-section">
      <h4 style={{ marginTop: 0 }}>Key Management</h4>
      <p className="contact-meta">
        Identity keys remain on-device. Rotate one-time prekeys anytime for additional forward secrecy.
      </p>
      <div style={{ marginBottom: 12 }}>
        <div className="contact-meta">Public Identity</div>
        <code style={{
          display: "block",
          wordBreak: "break-all",
          fontSize: "0.78rem",
          marginTop: 4,
          background: "rgba(255,255,255,0.05)",
          padding: "10px",
          borderRadius: "10px"
        }}>
          {identityPublicKey?.slice(0, 60) || "Not generated on this device"}
          {identityPublicKey && "…"}
        </code>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="secondary-btn" onClick={regenPreKeys}>
          Rotate PreKeys
        </button>
        <button className="secondary-btn" onClick={clearSessionKeys}>
          Clear Session Keys
        </button>
      </div>
      <div className={`status-text ${status.includes("Error") ? "error" : "success"}`} style={{ marginTop: 12 }}>
        {status}
      </div>
    </div>
  );
}
