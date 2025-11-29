import React, { useEffect, useState, useRef } from "react";
import api from "../../services/api";
import socketService from "../../services/socket";
import {
  encryptMessageBase64,
  decryptMessageBase64,
  generateAesKeyRaw,
  aesEncryptRaw,
  aesDecryptRaw,
  uint8ToBase64String,
  base64ToUint8Array
} from "../../utils/crypto";

export default function ChatWindow({ token, selectedUser, myUserId, onSecurityEvent }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [decryptedFiles, setDecryptedFiles] = useState({});
  const socketRef = useRef(null);
  const listRef = useRef();

  useEffect(() => {
    if (!selectedUser) {
      setMessages([]);
      return undefined;
    }

    let isMounted = true;
    (async () => {
      try {
        const res = await api.get(`/messages/${selectedUser._id || selectedUser.id}`);
        const myId = myUserId || localStorage.getItem("myUserId");

        const decryptedMsgs = await Promise.all(
          (res.data || []).map(async msg => {
            const isRecipient =
              msg.recipientId === myId ||
              msg.recipientId?._id === myId ||
              msg.recipientId?.toString() === myId;

            if (isRecipient) {
              const decrypted = await decryptMessageBase64(msg);
              return { ...msg, decrypted };
            }

            // For sent messages, try to restore plaintext from localStorage
            const sentTextKey = `sent_msg_${msg._id || msg.id}`;
            const storedText = localStorage.getItem(sentTextKey);
            if (storedText) {
              return { ...msg, decrypted: storedText };
            }

            return msg;
          })
        );

        if (isMounted) setMessages(decryptedMsgs);
        onSecurityEvent?.(`Secure session synced with ${selectedUser.username}`, "success");
      } catch (err) {
        console.error("Fetch history error:", err);
        onSecurityEvent?.("Unable to fetch message history", "error");
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [selectedUser, myUserId, onSecurityEvent]);

  useEffect(() => {
    socketRef.current = socketService.connect(token);

    socketRef.current.on("new_message", async (msg) => {
      try {
        const myId = myUserId || localStorage.getItem("myUserId");

        if (msg.recipientId === myId || msg.recipientId?._id === myId || msg.recipientId?.toString() === myId) {
          const decrypted = await decryptMessageBase64(msg);
          setMessages(prev => [...prev, { ...msg, decrypted }]);
          onSecurityEvent?.("Encrypted packet received", "info");
        } else {
          // For sent messages, try to restore plaintext
          const sentTextKey = `sent_msg_${msg._id || msg.id}`;
          const storedText = localStorage.getItem(sentTextKey);
          setMessages(prev => [...prev, { ...msg, decrypted: storedText || undefined }]);
        }
      } catch (err) {
        console.error("Realtime decrypt error", err);
        onSecurityEvent?.("Realtime message failed to decrypt", "error");
      }
    });

    socketRef.current.on("new_file", (fileInfo) => {
      setMessages(prev => [...prev, { type: "file_notice", fileInfo }]);
      onSecurityEvent?.(`Encrypted file from ${fileInfo.senderId}`, "info");
    });

    return () => socketRef.current?.disconnect();
  }, [token, onSecurityEvent]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSend(e) {
    e.preventDefault();
    if (!text.trim() || !selectedUser) return;
    setIsSending(true);

    try {
      const keysRes = await api.get(`/users/${selectedUser._id || selectedUser.id}/keys`);
      const recipientIdentity = keysRes.data.identityPublicKey;

      const { cipherBase64, nonceBase64, ephemeralPublicKeyBase64 } =
        await encryptMessageBase64(recipientIdentity, text);

      const payload = {
        recipientId: selectedUser._id || selectedUser.id,
        encryptedContent: cipherBase64,
        nonce: nonceBase64,
        messageNumber: Date.now(),
        ephemeralPublicKey: ephemeralPublicKeyBase64
      };

      const res = await api.post("/messages", payload);

      // Store plaintext in localStorage for sent messages (so we can show it after refresh)
      const msgId = res.data._id || res.data.id;
      if (msgId) {
        localStorage.setItem(`sent_msg_${msgId}`, text);
      }

      setMessages(prev => [...prev, { ...res.data, decrypted: text }]);
      setText("");
      onSecurityEvent?.("Message sealed with AES-256-GCM", "success");
    } catch (err) {
      console.error("Send error:", err);
      onSecurityEvent?.("Failed to encrypt or send message", "error");
    } finally {
      setIsSending(false);
    }
  }

  async function handleFileSelected(ev) {
    const file = ev.target.files[0];
    if (!file || !selectedUser) return;

    try {
      const ab = await file.arrayBuffer();
      const aesRaw = await generateAesKeyRaw();

      const { cipherUint8, ivUint8 } = await aesEncryptRaw(aesRaw, ab);

      const keysRes = await api.get(`/users/${selectedUser._id || selectedUser.id}/keys`);
      const recipientIdentity = keysRes.data.identityPublicKey;

      // Convert Uint8Array to base64 string before encrypting
      const aesKeyBase64 = uint8ToBase64String(aesRaw);
      const encKeyObj = await encryptMessageBase64(recipientIdentity, aesKeyBase64);

      const payload = {
        recipientId: selectedUser._id || selectedUser.id,
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        encryptedFile: uint8ToBase64String(cipherUint8),
        fileIv: uint8ToBase64String(ivUint8),
        encryptedFileKey: encKeyObj.cipherBase64,
        ephemeralPublicKey: encKeyObj.ephemeralPublicKeyBase64,
        fileKeyNonce: encKeyObj.nonceBase64
      };

      await api.post("/files", payload);

      setMessages(prev => [...prev, { type: "file", filename: file.name }]);
      onSecurityEvent?.(`File "${file.name}" encrypted & staged`, "success");
    } catch (err) {
      console.error("File upload error:", err);
      onSecurityEvent?.("File encryption failed", "error");
    } finally {
      ev.target.value = "";
    }
  }

  async function handleFileDownload(fileId) {
    if (decryptedFiles[fileId]) {
      // Already decrypted, just download
      const fileData = decryptedFiles[fileId];
      const url = URL.createObjectURL(fileData.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileData.filename;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    try {
      const res = await api.get(`/files/${fileId}`);
      const data = res.data;

      const msgForKey = {
        encryptedContent: data.encryptedFileKey,
        ephemeralPublicKey: data.ephemeralPublicKey,
        nonce: data.fileKeyNonce
      };
      const keyPlain = await decryptMessageBase64(msgForKey);
      if (!keyPlain || keyPlain === "[decrypt-error]" || keyPlain === "[no-secret-key]") {
        throw new Error("Failed to unwrap file key");
      }

      // keyPlain is a base64 string, convert to Uint8Array
      const aesRaw = base64ToUint8Array(keyPlain);

      const cipherU8 = base64ToUint8Array(data.encryptedFile);
      const ivU8 = base64ToUint8Array(data.fileIv);

      const plainU8 = await aesDecryptRaw(aesRaw, ivU8, cipherU8);

      const blob = new Blob([plainU8], { type: data.mimeType });
      
      // Store decrypted file for preview
      setDecryptedFiles(prev => ({
        ...prev,
        [fileId]: { blob, filename: data.filename, mimeType: data.mimeType }
      }));

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      a.click();

      URL.revokeObjectURL(url);
      onSecurityEvent?.(`Decrypted file "${data.filename}"`, "success");
    } catch (err) {
      console.error("Download error:", err);
      onSecurityEvent?.("Failed to download or decrypt file", "error");
      alert("Failed to download or decrypt.");
    }
  }

  if (!selectedUser) {
    return (
      <section className="chat-panel">
        <div className="empty-state">
          <div>
            <h2>Welcome to the secure cockpit</h2>
            <p>
              Pick a contact on the left to spin up a new ECDH session. We keep identities local, ratchet
              keys per message, and auto-manage the HKDF chain for you.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const formattedStatus = selectedUser.isOnline
    ? "Online now"
    : `Last seen ${new Date(selectedUser.lastSeen).toLocaleString()}`;

  return (
    <section className="chat-panel">
      <header className="chat-header">
        <div className="user-meta">
          <strong>{selectedUser.username}</strong>
          <span className="contact-meta">{formattedStatus}</span>
        </div>
        <span className="session-pill">Session pinned • AES-256-GCM</span>
      </header>

      <div ref={listRef} className="message-list">
        {messages.map((m, i) => {
          if (m.type === "file_notice") {
            const fileId = m.fileInfo._id;
            const decryptedFile = decryptedFiles[fileId];
            const isImage = m.fileInfo.mimeType?.startsWith("image/");
            const isAudio = m.fileInfo.mimeType?.startsWith("audio/");
            
            return (
              <div key={`${fileId}-${i}`} className="message-row">
                <div className="message-bubble">
                  {decryptedFile && isImage ? (
                    <div className="file-preview">
                      <img 
                        src={URL.createObjectURL(decryptedFile.blob)} 
                        alt={m.fileInfo.filename}
                        style={{ maxWidth: "300px", maxHeight: "300px", borderRadius: "8px", marginBottom: "8px", objectFit: "contain" }}
                      />
                      <div className="file-chip" style={{ marginTop: "8px" }}>
                        📷 <span>{m.fileInfo.filename}</span>
                        <button className="secondary-btn" onClick={() => handleFileDownload(fileId)}>
                          Download
                        </button>
                      </div>
                    </div>
                  ) : decryptedFile && isAudio ? (
                    <div>
                      <audio controls style={{ width: "100%", marginBottom: "8px" }}>
                        <source src={URL.createObjectURL(decryptedFile.blob)} type={decryptedFile.mimeType} />
                        Your browser does not support audio playback.
                      </audio>
                      <div className="file-chip">
                        🎵 <span>{m.fileInfo.filename}</span>
                        <button className="secondary-btn" onClick={() => handleFileDownload(fileId)}>
                          Download
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="file-chip">
                      {isImage ? "📷" : isAudio ? "🎵" : "📎"} <span>{m.fileInfo.filename}</span>
                      <button className="secondary-btn" onClick={() => handleFileDownload(fileId)}>
                        {decryptedFile ? "Download" : "Decrypt & Download"}
                      </button>
                    </div>
                  )}
                  <div className="message-timestamp">
                    {new Date(m.fileInfo.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
            );
          }

          if (m.type === "file") {
            return (
              <div key={`file-${i}`} className="message-row mine">
                <div className="message-bubble">
                  <div className="file-chip">📤 {m.filename}</div>
                </div>
              </div>
            );
          }

          const myId = myUserId || localStorage.getItem("myUserId");
          const mine =
            m.senderId === myId ||
            m.senderId?._id === myId ||
            m.senderId?.toString() === myId;

          const textToShow = m.decrypted || (mine ? "[sent securely]" : "[encrypted]");

          return (
            <div key={m._id || i} className={`message-row ${mine ? "mine" : ""}`}>
              <div className="message-bubble">
                <div>{textToShow}</div>
                <div className="message-timestamp">
                  {new Date(m.timestamp).toLocaleString()}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSend} className="composer">
        <label className="attachment-label" htmlFor="file-upload">
          📎
        </label>
        <input id="file-upload" type="file" className="file-input" onChange={handleFileSelected} />

        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Compose a zero-leakage message…"
        />

        <button className="primary-btn" type="submit" disabled={!text.trim() || isSending}>
          {isSending ? "Sealing…" : "Send"}
        </button>
      </form>
    </section>
  );
}
