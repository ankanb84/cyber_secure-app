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

export default function ChatWindowEnhanced({ token, selectedUser, myUserId, onSecurityEvent, onCallStart, onBack }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [decryptedFiles, setDecryptedFiles] = useState({});
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [reactions, setReactions] = useState({});
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editText, setEditText] = useState("");
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleDateTime, setScheduleDateTime] = useState("");
  const [selfDestructSeconds, setSelfDestructSeconds] = useState(0);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [showPinned, setShowPinned] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [isViewOnce, setIsViewOnce] = useState(false);
  const [viewingFileId, setViewingFileId] = useState(null); // For View Once overlay
  const socketRef = useRef(null);
  const listRef = useRef();
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);

  // Load reactions for messages
  useEffect(() => {
    if (!selectedUser || messages.length === 0) {
      setReactions({});
      return;
    }

    const loadReactions = async () => {
      const reactionsMap = {};
      const messageIds = messages.filter(m => m._id).map(m => m._id);

      // Load reactions for all messages in parallel
      const reactionPromises = messageIds.map(async (msgId) => {
        try {
          const res = await api.get(`/reactions/${msgId}`);
          return { msgId, reactions: res.data || [] };
        } catch (err) {
          console.error(`Failed to load reactions for ${msgId}:`, err);
          return { msgId, reactions: [] };
        }
      });

      const results = await Promise.all(reactionPromises);
      results.forEach(({ msgId, reactions }) => {
        if (reactions.length > 0) {
          reactionsMap[msgId] = reactions;
        }
      });

      setReactions(reactionsMap);
    };

    loadReactions();
  }, [selectedUser, messages]);

  // Load pinned messages
  useEffect(() => {
    if (!selectedUser) return;

    const loadPinned = async () => {
      try {
        const res = await api.get(`/messages/${selectedUser._id}/pinned`);
        setPinnedMessages(res.data || []);
      } catch (err) {
        console.error("Failed to load pinned messages:", err);
      }
    };

    loadPinned();
  }, [selectedUser]);

  // Typing indicator handler
  const handleTyping = () => {
    if (!selectedUser || !socketRef.current) return;

    socketRef.current.emit('typing', {
      recipientId: selectedUser._id,
      isTyping: true
    });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit('typing', {
        recipientId: selectedUser._id,
        isTyping: false
      });
    }, 3000);
  };

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

            if (isRecipient && !msg.deleted) {
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

          // Mark as read
          if (msg._id) {
            try {
              await api.patch(`/messages/${msg._id}/read`);
            } catch (err) {
              // Read receipts might be disabled
            }
          }
        } else {
          const sentTextKey = `sent_msg_${msg._id || msg.id}`;
          const storedText = localStorage.getItem(sentTextKey);
          setMessages(prev => [...prev, { ...msg, decrypted: storedText || undefined }]);
        }
      } catch (err) {
        console.error("Realtime decrypt error", err);
        onSecurityEvent?.("Realtime message failed to decrypt", "error");
      }
    });

    socketRef.current.on("user_typing", (data) => {
      if (data.isTyping) {
        setTypingUsers(prev => new Set([...prev, data.userId]));
      } else {
        setTypingUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(data.userId);
          return newSet;
        });
      }
    });

    socketRef.current.on("message_reaction", async (data) => {
      // Reload reactions for this message
      try {
        const reactionsRes = await api.get(`/reactions/${data.messageId}`);
        setReactions(prev => ({
          ...prev,
          [data.messageId]: reactionsRes.data || []
        }));
      } catch (err) {
        console.error("Failed to reload reactions:", err);
      }
    });

    socketRef.current.on("reaction_removed", async (data) => {
      // Reload reactions for this message
      try {
        const reactionsRes = await api.get(`/reactions/${data.messageId}`);
        setReactions(prev => ({
          ...prev,
          [data.messageId]: reactionsRes.data || []
        }));
      } catch (err) {
        console.error("Failed to reload reactions:", err);
      }
    });

    socketRef.current.on("message_edited", (data) => {
      setMessages(prev => prev.map(msg =>
        msg._id === data.messageId
          ? { ...msg, edited: true, editedAt: data.editedAt, encryptedContent: data.encryptedContent, nonce: data.nonce }
          : msg
      ));
    });

    socketRef.current.on("message_deleted", (data) => {
      setMessages(prev => prev.map(msg =>
        msg._id === data.messageId
          ? { ...msg, deleted: true, deletedAt: new Date() }
          : msg
      ));
    });

    socketRef.current.on("message_pinned", (data) => {
      if (data.pinned) {
        // Reload pinned messages
        api.get(`/messages/${selectedUser._id}/pinned`).then(res => {
          setPinnedMessages(res.data || []);
        });
      }
    });

    socketRef.current.on("message_read", (data) => {
      setMessages(prev => prev.map(msg =>
        msg._id === data.messageId
          ? { ...msg, read: true, readAt: data.readAt }
          : msg
      ));
    });

    socketRef.current.on("new_file", (fileInfo) => {
      setMessages(prev => [...prev, { type: "file_notice", fileInfo }]);
      onSecurityEvent?.(`Encrypted file from ${fileInfo.senderId}`, "info");
    });

    return () => socketRef.current?.disconnect();
  }, [token, onSecurityEvent, selectedUser]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  // Self-destruct countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setMessages(prev => prev.map(msg => {
        if (msg.selfDestructAt && new Date(msg.selfDestructAt) > new Date()) {
          const secondsLeft = Math.ceil((new Date(msg.selfDestructAt) - new Date()) / 1000);
          return { ...msg, secondsUntilDestruct: secondsLeft };
        }
        return msg;
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

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
        ephemeralPublicKey: ephemeralPublicKeyBase64,
        scheduledFor: showScheduleModal && scheduleDateTime ? scheduleDateTime : null,
        selfDestructAt: selfDestructSeconds > 0
          ? new Date(Date.now() + selfDestructSeconds * 1000).toISOString()
          : null
      };

      const res = await api.post("/messages", payload);

      const msgId = res.data._id || res.data.id;
      if (msgId) {
        localStorage.setItem(`sent_msg_${msgId}`, text);
      }

      if (!payload.scheduledFor) {
        setMessages(prev => [...prev, { ...res.data, decrypted: text }]);
      }

      setText("");
      setShowScheduleModal(false);
      setScheduleDateTime("");
      setSelfDestructSeconds(0);
      onSecurityEvent?.("Message sealed with AES-256-GCM", "success");
    } catch (err) {
      console.error("Send error:", err);
      onSecurityEvent?.("Failed to encrypt or send message", "error");
    } finally {
      setIsSending(false);
    }
  }

  async function handleEditMessage(messageId, newText) {
    if (!newText.trim() || !selectedUser) return;

    try {
      const keysRes = await api.get(`/users/${selectedUser._id}/keys`);
      const recipientIdentity = keysRes.data.identityPublicKey;

      const { cipherBase64, nonceBase64 } = await encryptMessageBase64(recipientIdentity, newText);

      await api.patch(`/messages/${messageId}/edit`, {
        encryptedContent: cipherBase64,
        nonce: nonceBase64
      });

      // Update local storage
      localStorage.setItem(`sent_msg_${messageId}`, newText);

      setEditingMessageId(null);
      setEditText("");
      onSecurityEvent?.("Message edited", "success");
    } catch (err) {
      console.error("Edit error:", err);
      onSecurityEvent?.("Failed to edit message", "error");
    }
  }

  async function handleDeleteMessage(messageId) {
    if (!window.confirm("Delete this message?")) return;

    try {
      await api.patch(`/messages/${messageId}/delete`);
      onSecurityEvent?.("Message deleted", "info");
    } catch (err) {
      console.error("Delete error:", err);
      onSecurityEvent?.("Failed to delete message", "error");
    }
  }

  async function handlePinMessage(messageId, pin) {
    try {
      await api.patch(`/messages/${messageId}/pin`, { pinned: pin });
      onSecurityEvent?.(pin ? "Message pinned" : "Message unpinned", "info");
    } catch (err) {
      console.error("Pin error:", err);
      onSecurityEvent?.("Failed to pin message", "error");
    }
  }

  async function handleAddReaction(messageId, emoji) {
    try {
      const res = await api.post(`/reactions/${messageId}`, { emoji });
      // Reload reactions for this message
      const reactionsRes = await api.get(`/reactions/${messageId}`);
      setReactions(prev => ({
        ...prev,
        [messageId]: reactionsRes.data || []
      }));
    } catch (err) {
      console.error("Reaction error:", err);
      onSecurityEvent?.("Failed to add reaction", "error");
    }
  }

  async function handleRemoveReaction(messageId) {
    try {
      await api.delete(`/reactions/${messageId}`);
      // Reload reactions for this message
      const reactionsRes = await api.get(`/reactions/${messageId}`);
      setReactions(prev => ({
        ...prev,
        [messageId]: reactionsRes.data || []
      }));
    } catch (err) {
      console.error("Remove reaction error:", err);
      onSecurityEvent?.("Failed to remove reaction", "error");
    }
  }

  // Voice message recording
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        await handleVoiceMessage(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err) {
      console.error("Recording error:", err);
      onSecurityEvent?.("Failed to start recording", "error");
    }
  }

  function stopRecording() {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);
    }
  }

  async function handleVoiceMessage(audioBlob) {
    if (!selectedUser) return;

    try {
      const ab = await audioBlob.arrayBuffer();
      const aesRaw = await generateAesKeyRaw();
      const { cipherUint8, ivUint8 } = await aesEncryptRaw(aesRaw, ab);

      const keysRes = await api.get(`/users/${selectedUser._id}/keys`);
      const recipientIdentity = keysRes.data.identityPublicKey;
      const aesKeyBase64 = uint8ToBase64String(aesRaw);
      const encKeyObj = await encryptMessageBase64(recipientIdentity, aesKeyBase64);

      const payload = {
        recipientId: selectedUser._id,
        filename: `voice-${Date.now()}.webm`,
        mimeType: "audio/webm",
        size: audioBlob.size,
        encryptedFile: uint8ToBase64String(cipherUint8),
        fileIv: uint8ToBase64String(ivUint8),
        encryptedFileKey: encKeyObj.cipherBase64,
        ephemeralPublicKey: encKeyObj.ephemeralPublicKeyBase64,
        fileKeyNonce: encKeyObj.nonceBase64
      };

      const fileRes = await api.post("/files", payload);
      onSecurityEvent?.("Voice message encrypted & sent", "success");

      // Add voice message to chat
      setMessages(prev => [...prev, {
        type: "file_notice",
        fileInfo: {
          _id: fileRes.data.id,
          filename: payload.filename,
          mimeType: payload.mimeType,
          size: payload.size,
          timestamp: new Date(),
          senderId: myUserId || localStorage.getItem("myUserId")
        }
      }]);
    } catch (err) {
      console.error("Voice message error:", err);
      onSecurityEvent?.("Failed to send voice message", "error");
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
        fileKeyNonce: encKeyObj.nonceBase64,
        isViewOnce: isViewOnce // Add flag to payload
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

      const aesRaw = base64ToUint8Array(keyPlain);
      const cipherU8 = base64ToUint8Array(data.encryptedFile);
      const ivU8 = base64ToUint8Array(data.fileIv);
      const plainU8 = await aesDecryptRaw(aesRaw, ivU8, cipherU8);
      const blob = new Blob([plainU8], { type: data.mimeType });

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

  const myId = myUserId || localStorage.getItem("myUserId");
  const formattedStatus = selectedUser.isOnline
    ? "Online now"
    : `Last seen ${new Date(selectedUser.lastSeen).toLocaleString()}`;

  const commonEmojis = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '⭐'];

  return (
    <section className="chat-panel">
      <header className="chat-header">
        <div className="user-meta">
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* Back Button for Mobile */}
            <button
              className="secondary-btn mobile-only"
              onClick={onBack}
              style={{
                marginRight: "8px",
                padding: "8px",
                display: "none" // Hidden by default, shown via CSS media query
              }}
            >
              ←
            </button>

            <div className="user-avatar" style={{ width: "40px", height: "40px" }}>
              {selectedUser.profilePicture ? (
                <img src={selectedUser.profilePicture} alt={selectedUser.username} />
              ) : (
                <span>{selectedUser.username?.[0]?.toUpperCase()}</span>
              )}
            </div>
            <div>
              <div style={{ fontWeight: "600", fontSize: "1.1rem" }}>{selectedUser.name || selectedUser.username}</div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="contact-meta">{formattedStatus}</span>
                {typingUsers.has(selectedUser._id) && (
                  <span className="typing-indicator" style={{ color: "var(--primary)", fontSize: "0.8rem" }}>typing...</span>
                )}
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <button
            className="secondary-btn"
            onClick={() => onCallStart?.("voice")}
            title="Voice Call"
          >
            📞
          </button>
          <button
            className="secondary-btn"
            onClick={() => onCallStart?.("video")}
            title="Video Call"
          >
            📹
          </button>

          {pinnedMessages.length > 0 && (
            <button
              className="secondary-btn"
              onClick={() => setShowPinned(!showPinned)}
              title={`${pinnedMessages.length} Pinned Messages`}
              style={{
                background: showPinned ? "rgba(255,255,255,0.1)" : "transparent",
                borderColor: showPinned ? "var(--primary)" : "var(--glass-border)"
              }}
            >
              📌 <span style={{ marginLeft: "4px", fontSize: "0.8rem" }}>{pinnedMessages.length}</span>
            </button>
          )}
        </div>
      </header>

      {showPinned && pinnedMessages.length > 0 && (
        <div className="pinned-messages-section" style={{ padding: "10px", borderBottom: "1px solid var(--glass-border)", maxHeight: "200px", overflowY: "auto" }}>
          <h5 style={{ margin: "0 0 10px 0" }}>Pinned Messages</h5>
          {pinnedMessages.map(msg => (
            <div key={msg._id} style={{
              padding: "8px",
              marginBottom: "8px",
              background: "rgba(255,255,255,0.05)",
              borderRadius: "4px",
              fontSize: "12px"
            }}>
              {msg.decrypted || "[Encrypted]"}
              <button
                className="secondary-btn"
                onClick={() => handlePinMessage(msg._id, false)}
                style={{ float: "right", fontSize: "10px", padding: "2px 6px" }}
              >
                Unpin
              </button>
            </div>
          ))}
        </div>
      )}


      <div ref={listRef} className="message-list">
        {messages.map((m, i) => {
          if (m.deleted) {
            return (
              <div key={m._id || i} className={`message-row ${m.senderId === myId ? "mine" : ""}`}>
                <div className="message-bubble" style={{ opacity: 0.5, fontStyle: "italic" }}>
                  [Message deleted]
                </div>
              </div>
            );
          }

          if (m.type === "file_notice") {
            const fileId = m.fileInfo._id;
            const decryptedFile = decryptedFiles[fileId];
            const isImage = m.fileInfo.mimeType?.startsWith("image/");
            const isAudio = m.fileInfo.mimeType?.startsWith("audio/");
            const isViewOnceMsg = m.fileInfo.isViewOnce;

            return (
              <div key={`${fileId}-${i}`} className="message-row">
                <div className="message-bubble">
                  {isViewOnceMsg ? (
                    <div className="file-chip" style={{ border: "1px solid var(--primary)", background: "rgba(0, 240, 255, 0.1)" }}>
                      👁️ <span>View Once Photo</span>
                      {decryptedFile ? (
                        <button
                          className="primary-btn"
                          onClick={() => setViewingFileId(fileId)}
                          style={{ marginLeft: "10px", fontSize: "12px", padding: "4px 8px" }}
                        >
                          View Photo
                        </button>
                      ) : (
                        <button
                          className="secondary-btn"
                          onClick={() => handleFileDownload(fileId)}
                          style={{ marginLeft: "10px", fontSize: "12px", padding: "4px 8px" }}
                        >
                          Decrypt to View
                        </button>
                      )}
                    </div>
                  ) : decryptedFile && isImage ? (
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
                    {isViewOnceMsg && <span style={{ marginLeft: "5px", color: "var(--primary)" }}>• Ephemeral</span>}
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

          const mine = m.senderId === myId || m.senderId?._id === myId || m.senderId?.toString() === myId;
          const textToShow = m.decrypted || (mine ? "[sent securely]" : "[encrypted]");
          const messageReactions = reactions[m._id] || [];
          const userReaction = messageReactions.find(r => {
            const rUserId = r.userId?._id || r.userId || r.userId?.toString();
            return rUserId === myId || rUserId?.toString() === myId;
          });

          return (
            <div key={m._id || i} className={`message-row ${mine ? "mine" : ""}`}>
              <div className="message-bubble">
                {editingMessageId === m._id ? (
                  <div>
                    <textarea
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      style={{ width: "100%", minHeight: "60px", marginBottom: "8px" }}
                    />
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button className="primary-btn" onClick={() => handleEditMessage(m._id, editText)}>
                        Save
                      </button>
                      <button className="secondary-btn" onClick={() => { setEditingMessageId(null); setEditText(""); }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      {textToShow}
                      {m.edited && <span style={{ fontSize: "11px", opacity: 0.7, marginLeft: "8px" }}>(edited)</span>}
                      {m.selfDestructAt && m.secondsUntilDestruct > 0 && (
                        <span style={{
                          fontSize: "11px",
                          color: "#ff6b6b",
                          marginLeft: "8px"
                        }}>
                          ⏱️ {m.secondsUntilDestruct}s
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                      <div className="message-timestamp">
                        {new Date(m.timestamp).toLocaleString()}
                        {mine && (
                          <span style={{ marginLeft: "8px", fontSize: "10px" }}>
                            {m.read ? "✓✓ Read" : m.delivered ? "✓✓ Delivered" : "✓ Sent"}
                          </span>
                        )}
                      </div>
                      {mine && (
                        <div style={{ display: "flex", gap: "4px" }}>
                          <button
                            className="secondary-btn"
                            onClick={() => { setEditingMessageId(m._id); setEditText(textToShow); }}
                            style={{ fontSize: "10px", padding: "2px 6px" }}
                          >
                            ✏️
                          </button>
                          <button
                            className="secondary-btn"
                            onClick={() => handleDeleteMessage(m._id)}
                            style={{ fontSize: "10px", padding: "2px 6px" }}
                          >
                            🗑️
                          </button>
                          <button
                            className="secondary-btn"
                            onClick={() => handlePinMessage(m._id, !m.pinned)}
                            style={{ fontSize: "10px", padding: "2px 6px" }}
                          >
                            {m.pinned ? "📌" : "📍"}
                          </button>
                        </div>
                      )}
                    </div>
                    {messageReactions.length > 0 && (
                      <div style={{ display: "flex", gap: "4px", marginTop: "8px", flexWrap: "wrap" }}>
                        {messageReactions.map((r, idx) => {
                          const rUserId = r.userId?._id || r.userId || r.userId?.toString();
                          const isMyReaction = rUserId === myId || rUserId?.toString() === myId;
                          return (
                            <button
                              key={r._id || idx}
                              className="secondary-btn"
                              onClick={() => isMyReaction
                                ? handleRemoveReaction(m._id)
                                : handleAddReaction(m._id, r.emoji)
                              }
                              style={{ fontSize: "12px", padding: "2px 6px" }}
                            >
                              {r.emoji} {r.userId?.username || r.userId?.name || "User"}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {!mine && (
                      <div style={{ marginTop: "8px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        {commonEmojis.map(emoji => (
                          <button
                            key={emoji}
                            className="secondary-btn"
                            onClick={() => handleAddReaction(m._id, emoji)}
                            style={{
                              fontSize: "1.1rem",
                              padding: "0",
                              width: "28px",
                              height: "28px",
                              borderRadius: "50%",
                              background: "rgba(255,255,255,0.05)",
                              border: "1px solid var(--glass-border)"
                            }}
                            title="React"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSend} className="composer">
        <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
          <label className="attachment-label" htmlFor="file-upload">
            📎
          </label>
          <input
            id="file-upload"
            type="file"
            className="file-input"
            onChange={handleFileSelected}
            ref={fileInputRef}
            style={{ display: "none" }}
          />
          <button
            type="button"
            className={`secondary-btn ${isRecording ? "recording" : ""}`}
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            style={{ fontSize: "18px", padding: "4px 12px" }}
            title="Hold to record voice message"
          >
            🎤
          </button>
          <button
            type="button"
            className="secondary-btn"
            onClick={() => setShowScheduleModal(!showScheduleModal)}
            style={{ fontSize: "14px", padding: "4px 8px" }}
          >
            ⏰ Schedule
          </button>
          <button
            type="button"
            className={`secondary-btn ${isViewOnce ? "active-neon" : ""}`}
            onClick={() => setIsViewOnce(!isViewOnce)}
            style={{ fontSize: "14px", padding: "4px 8px", borderColor: isViewOnce ? "var(--primary)" : "" }}
            title="View Once (Burn after viewing)"
          >
            👁️ {isViewOnce ? "1" : "Once"}
          </button>
          <button
            type="button"
            className="secondary-btn"
            onClick={() => setSelfDestructSeconds(selfDestructSeconds > 0 ? 0 : 60)}
            style={{ fontSize: "14px", padding: "4px 8px" }}
          >
            💣 {selfDestructSeconds > 0 ? `${selfDestructSeconds}s` : "Self-destruct"}
          </button>
        </div>

        {showScheduleModal && (
          <div style={{ marginBottom: "8px", padding: "8px", background: "rgba(255,255,255,0.05)", borderRadius: "4px" }}>
            <input
              type="datetime-local"
              value={scheduleDateTime}
              onChange={e => setScheduleDateTime(e.target.value)}
              style={{ width: "100%", padding: "4px", marginBottom: "4px" }}
            />
            <button
              type="button"
              className="secondary-btn"
              onClick={() => { setShowScheduleModal(false); setScheduleDateTime(""); }}
              style={{ fontSize: "12px" }}
            >
              Cancel
            </button>
          </div>
        )}

        {selfDestructSeconds > 0 && (
          <div style={{ marginBottom: "8px", padding: "8px", background: "rgba(255,107,107,0.1)", borderRadius: "4px" }}>
            <label style={{ fontSize: "12px" }}>
              Self-destruct in:
              <input
                type="number"
                min="10"
                max="3600"
                value={selfDestructSeconds}
                onChange={e => setSelfDestructSeconds(parseInt(e.target.value) || 0)}
                style={{ marginLeft: "8px", width: "80px", padding: "4px" }}
              />
              seconds
            </label>
          </div>
        )}

        <textarea
          value={text}
          onChange={e => { setText(e.target.value); handleTyping(); }}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend(e);
            }
          }}
          placeholder="Compose a zero-leakage message…"
        />

        <button className="primary-btn" type="submit" disabled={!text.trim() || isSending}>
          {isSending ? "Sealing…" : "Send"}
        </button>
      </form>
      {viewingFileId && decryptedFiles[viewingFileId] && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "black", zIndex: 10000,
          display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column"
        }}>
          <img
            src={URL.createObjectURL(decryptedFiles[viewingFileId].blob)}
            style={{ maxWidth: "100%", maxHeight: "90vh", objectFit: "contain" }}
            alt="View Once"
          />
          <div style={{ marginTop: "20px", color: "white", fontFamily: "var(--font-mono)" }}>
            ⚠️ This photo will self-destruct when closed.
          </div>
          <button
            className="primary-btn"
            style={{ marginTop: "20px" }}
            onClick={() => {
              setViewingFileId(null);
              setMessages(prev => prev.filter(m => {
                if (m.type === "file_notice" && m.fileInfo._id === viewingFileId) return false;
                return true;
              }));
            }}
          >
            Close & Burn
          </button>
        </div>
      )}
    </section>
  );
}
