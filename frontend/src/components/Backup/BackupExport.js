import React, { useState } from "react";
import api from "../../services/api";

export default function BackupExport({ myUserId, onEvent }) {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      // Get all messages
      const messagesRes = await api.get("/messages/export");
      const messages = messagesRes.data || [];

      // Get user data
      const userRes = await api.get("/users/me");
      const userData = userRes.data;

      // Get keys from localStorage
      const identitySecretKey = localStorage.getItem("identitySecretKey");
      const identityPublicKey = localStorage.getItem("identityPublicKey");
      const preKeySecrets = localStorage.getItem("preKeySecrets");

      const backup = {
        version: "1.0",
        exportDate: new Date().toISOString(),
        userId: myUserId,
        userData: {
          username: userData.username,
          name: userData.name,
          email: userData.email
        },
        messages: messages.map(msg => ({
          _id: msg._id,
          senderId: msg.senderId,
          recipientId: msg.recipientId,
          encryptedContent: msg.encryptedContent,
          nonce: msg.nonce,
          timestamp: msg.timestamp,
          decrypted: msg.decrypted // Include decrypted for backup
        })),
        keys: {
          identitySecretKey,
          identityPublicKey,
          preKeySecrets
        }
      };

      // Download as JSON
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chat-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      onEvent?.("Backup exported successfully", "success");
    } catch (err) {
      console.error("Export error:", err);
      onEvent?.("Failed to export backup", "error");
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      // Restore keys
      if (backup.keys) {
        if (backup.keys.identitySecretKey) {
          localStorage.setItem("identitySecretKey", backup.keys.identitySecretKey);
        }
        if (backup.keys.identityPublicKey) {
          localStorage.setItem("identityPublicKey", backup.keys.identityPublicKey);
        }
        if (backup.keys.preKeySecrets) {
          localStorage.setItem("preKeySecrets", backup.keys.preKeySecrets);
        }
      }

      // Restore sent message plaintexts
      if (backup.messages) {
        backup.messages.forEach(msg => {
          if (msg.decrypted && msg._id) {
            localStorage.setItem(`sent_msg_${msg._id}`, msg.decrypted);
          }
        });
      }

      onEvent?.("Backup imported successfully. Please refresh the page.", "success");
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      console.error("Import error:", err);
      onEvent?.("Failed to import backup. Invalid file format.", "error");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  return (
    <div className="info-section">
      <h4 style={{ marginTop: 0 }}>Backup & Export</h4>
      <p className="contact-meta" style={{ marginBottom: "16px" }}>
        Export your chat history and keys for backup. Import to restore on another device.
      </p>
      
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <button
          className="primary-btn"
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? "Exporting..." : "📥 Export Backup"}
        </button>
        
        <label className="secondary-btn" style={{ textAlign: "center", cursor: "pointer" }}>
          {importing ? "Importing..." : "📤 Import Backup"}
          <input
            type="file"
            accept=".json"
            onChange={handleImport}
            disabled={importing}
            style={{ display: "none" }}
          />
        </label>
      </div>
    </div>
  );
}

