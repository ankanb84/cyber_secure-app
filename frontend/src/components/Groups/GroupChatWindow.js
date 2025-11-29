import React, { useEffect, useState, useRef } from "react";
import api from "../../services/api";
import socketService from "../../services/socket";
import { decryptMessageBase64, encryptMessageBase64, base64ToUint8Array, uint8ToBase64String } from "../../utils/crypto";
import { importAesKeyFromRaw, aesDecryptRaw } from "../../utils/crypto";

export default function GroupChatWindow({ token, selectedGroup, myUserId, onSecurityEvent, onBack }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [groupKey, setGroupKey] = useState(null);
  const [groupKeyRaw, setGroupKeyRaw] = useState(null); // Store raw key for re-encryption
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [friends, setFriends] = useState([]);
  const [selectedNewMembers, setSelectedNewMembers] = useState([]);
  const socketRef = useRef(null);
  const listRef = useRef();

  // Load and decrypt group key
  useEffect(() => {
    if (!selectedGroup) {
      setGroupKey(null);
      setGroupKeyRaw(null);
      return;
    }

    const loadGroupKey = async () => {
      try {
        const myMember = selectedGroup.members?.find(m =>
          m.userId?._id === myUserId || m.userId === myUserId || m.userId?.toString() === myUserId
        );

        if (!myMember || !myMember.encryptedGroupKey) {
          onSecurityEvent?.("Group key not found", "error");
          return;
        }

        // Try to get group key from localStorage first (if we created the group)
        const storedKey = localStorage.getItem(`group_key_${selectedGroup._id}`);
        if (storedKey) {
          try {
            const keyRaw = base64ToUint8Array(storedKey);
            const aesKey = await importAesKeyFromRaw(keyRaw);
            setGroupKey(aesKey);
            setGroupKeyRaw(keyRaw); // Store raw key
            onSecurityEvent?.("Group key loaded from cache", "success");
            return;
          } catch (err) {
            console.error("Failed to load cached key:", err);
          }
        }

        // Otherwise, decrypt group key from member data
        if (!myMember.encryptedGroupKey || myMember.encryptedGroupKey === 'pending') {
          onSecurityEvent?.("Group key not ready yet", "error");
          return;
        }

        const msgForKey = {
          encryptedContent: myMember.encryptedGroupKey,
          ephemeralPublicKey: myMember.ephemeralPublicKey,
          nonce: myMember.keyNonce
        };

        const keyPlain = await decryptMessageBase64(msgForKey);
        if (!keyPlain || keyPlain === "[decrypt-error]") {
          onSecurityEvent?.("Failed to decrypt group key", "error");
          return;
        }

        const keyRaw = base64ToUint8Array(keyPlain);
        const aesKey = await importAesKeyFromRaw(keyRaw);
        setGroupKey(aesKey);
        setGroupKeyRaw(keyRaw); // Store raw key

        // Cache the key
        localStorage.setItem(`group_key_${selectedGroup._id}`, keyPlain);
        onSecurityEvent?.("Group key loaded", "success");
      } catch (err) {
        console.error("Failed to load group key:", err);
        onSecurityEvent?.("Failed to load group key", "error");
      }
    };

    loadGroupKey();
  }, [selectedGroup, myUserId, onSecurityEvent]);

  // Load messages
  useEffect(() => {
    if (!selectedGroup || !groupKey) {
      setMessages([]);
      return;
    }

    const loadMessages = async () => {
      try {
        const res = await api.get(`/groups/${selectedGroup._id}/messages`);
        const decryptedMsgs = await Promise.all(
          (res.data || []).map(async msg => {
            try {
              const encrypted = base64ToUint8Array(msg.encryptedContent);
              const nonce = base64ToUint8Array(msg.nonce);
              const plain = await aesDecryptRaw(groupKeyRaw, nonce, encrypted);
              const decrypted = new TextDecoder().decode(plain);
              return { ...msg, decrypted };
            } catch (err) {
              console.error("Failed to decrypt message:", err);
              return { ...msg, decrypted: "[decrypt-error]" };
            }
          })
        );
        setMessages(decryptedMsgs);
      } catch (err) {
        console.error("Failed to load messages:", err);
        onSecurityEvent?.("Failed to load group messages", "error");
      }
    };

    loadMessages();
  }, [selectedGroup, groupKey, onSecurityEvent]);

  // Socket events
  useEffect(() => {
    if (!selectedGroup) return;

    socketRef.current = socketService.connect(token);

    socketRef.current.on("new_group_message", async (msg) => {
      if (msg.groupId === selectedGroup._id && groupKey) {
        try {
          const encrypted = base64ToUint8Array(msg.encryptedContent);
          const nonce = base64ToUint8Array(msg.nonce);
          const plain = await aesDecryptRaw(groupKeyRaw, nonce, encrypted);
          const decrypted = new TextDecoder().decode(plain);
          setMessages(prev => [...prev, { ...msg, decrypted }]);
        } catch (err) {
          console.error("Failed to decrypt message:", err);
        }
      }
    });

    socketRef.current.on("group_updated", (group) => {
      if (group._id === selectedGroup._id) {
        // Check if my key was updated
        const myNewMember = group.members.find(m => (m.userId._id || m.userId) === myUserId);
        const myOldMember = selectedGroup.members.find(m => (m.userId._id || m.userId) === myUserId);

        if (myNewMember && myOldMember && myNewMember.encryptedGroupKey !== myOldMember.encryptedGroupKey) {
          console.log("My group key was updated, reloading...");
          window.location.reload();
          return;
        }

        // Reload group key if it was rotated
        if (group.groupKeyVersion > selectedGroup.groupKeyVersion) {
          window.location.reload(); // Force reload to get new keys
        }
      }
    });

    return () => socketRef.current?.disconnect();
  }, [selectedGroup, groupKey, token, myUserId]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  // Load friends for adding members
  useEffect(() => {
    if (showAddMemberModal) {
      const loadFriends = async () => {
        try {
          const res = await api.get("/friends/list");
          // Filter out existing members
          const existingMemberIds = new Set(selectedGroup.members.map(m => m.userId._id || m.userId));
          const availableFriends = res.data.filter(f => !existingMemberIds.has(f._id));
          setFriends(availableFriends);
        } catch (err) {
          console.error("Failed to load friends:", err);
        }
      };
      loadFriends();
    }
  }, [showAddMemberModal, selectedGroup]);

  async function handleSend(e) {
    e.preventDefault();
    if (!text.trim() || !selectedGroup || !groupKey) return;

    setIsSending(true);
    try {
      // Encrypt message with group key
      const plaintext = new TextEncoder().encode(text);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const cipher = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        groupKey,
        plaintext
      );

      const payload = {
        encryptedContent: btoa(String.fromCharCode(...new Uint8Array(cipher))),
        nonce: btoa(String.fromCharCode(...iv)),
        messageNumber: Date.now()
      };

      await api.post(`/groups/${selectedGroup._id}/messages`, payload);

      // Store plaintext for display
      const msgId = `temp_${Date.now()}`;
      localStorage.setItem(`sent_group_msg_${msgId}`, text);

      setMessages(prev => [...prev, {
        _id: msgId,
        senderId: myUserId,
        encryptedContent: payload.encryptedContent,
        nonce: payload.nonce,
        decrypted: text,
        timestamp: new Date()
      }]);
      setText("");
      onSecurityEvent?.("Group message sent", "success");
    } catch (err) {
      console.error("Send error:", err);
      onSecurityEvent?.("Failed to send message", "error");
    } finally {
      setIsSending(false);
    }
  }

  async function handleDeleteGroup() {
    if (!window.confirm("Are you sure you want to delete this group? This action cannot be undone.")) return;

    console.log("Deleting group:", selectedGroup._id);
    try {
      await api.delete(`/groups/${selectedGroup._id}`);
      console.log("Group deleted successfully");
      onSecurityEvent?.("Group deleted", "warning");
      alert("Group deleted successfully.");
      window.location.reload(); // Or redirect to home
    } catch (err) {
      console.error("Failed to delete group:", err);
      onSecurityEvent?.("Failed to delete group", "error");

      if (err.response && err.response.status === 404) {
        alert("Group not found (it may have already been deleted). Refreshing...");
        window.location.reload();
      } else {
        alert("Failed to delete group: " + (err.response?.data?.error || err.message));
      }
    }
  }

  async function handleAddMembers() {
    if (selectedNewMembers.length === 0) return;
    if (!groupKeyRaw) {
      alert("Cannot add members: Group key not available.");
      return;
    }

    try {
      const groupKeyBase64 = uint8ToBase64String(groupKeyRaw);

      // Encrypt group key for new members
      const membersWithKeys = await Promise.all(
        selectedNewMembers.map(async (friend) => {
          const keysRes = await api.get(`/users/${friend._id}/keys`);
          const memberIdentity = keysRes.data.identityPublicKey;

          const { cipherBase64, nonceBase64, ephemeralPublicKeyBase64 } =
            await encryptMessageBase64(memberIdentity, groupKeyBase64);

          return {
            userId: friend._id,
            encryptedGroupKey: cipherBase64,
            ephemeralPublicKey: ephemeralPublicKeyBase64,
            keyNonce: nonceBase64
          };
        })
      );

      await api.patch(`/groups/${selectedGroup._id}`, {
        addMembers: selectedNewMembers.map(f => f._id),
        members: membersWithKeys
      });

      onSecurityEvent?.("Members added successfully", "success");
      setShowAddMemberModal(false);
      setSelectedNewMembers([]);
    } catch (err) {
      console.error("Failed to add members:", err);
      onSecurityEvent?.("Failed to add members", "error");
    }
  }

  async function handleFixEncryption() {
    console.log("Fix Encryption Triggered");
    if (!groupKeyRaw) {
      console.error("No group key raw found");
      alert("Cannot fix encryption: You don't have the group key loaded.");
      return;
    }

    if (!window.confirm("This will re-encrypt the group key for ALL members. Use this if members are seeing decryption errors.")) return;

    try {
      // Fetch latest group data to ensure we have all members
      const groupRes = await api.get(`/groups/${selectedGroup._id}`);
      const latestGroup = groupRes.data;
      console.log("Fetched latest group members:", latestGroup.members);

      const groupKeyBase64 = uint8ToBase64String(groupKeyRaw);

      // Re-encrypt for ALL members (including self)
      const allMembers = latestGroup.members.map(m => m.userId._id || m.userId);

      const membersWithKeys = await Promise.all(
        allMembers.map(async (memberId) => {
          try {
            const keysRes = await api.get(`/users/${memberId}/keys`);
            const memberIdentity = keysRes.data.identityPublicKey;

            const { cipherBase64, nonceBase64, ephemeralPublicKeyBase64 } =
              await encryptMessageBase64(memberIdentity, groupKeyBase64);

            return {
              userId: memberId,
              encryptedGroupKey: cipherBase64,
              ephemeralPublicKey: ephemeralPublicKeyBase64,
              keyNonce: nonceBase64
            };
          } catch (err) {
            console.error(`Failed to encrypt for member ${memberId}:`, err);
            return null;
          }
        })
      );

      const validMembers = membersWithKeys.filter(m => m !== null);

      await api.patch(`/groups/${selectedGroup._id}`, {
        members: validMembers,
        rotateKey: false // Just fixing keys, not rotating the actual key content
      });

      console.log("Keys synced successfully");
      onSecurityEvent?.("Group keys synced successfully", "success");
      alert("Encryption keys have been synced for all members.");
      window.location.reload();
    } catch (err) {
      console.error("Failed to fix encryption:", err);
      onSecurityEvent?.("Failed to sync keys", "error");
      alert("Failed to sync keys: " + err.message);
    }
  }

  if (!selectedGroup) {
    return (
      <section className="chat-panel">
        <div className="empty-state">
          <div>
            <h2>Select a Group</h2>
            <p>Choose a group from the sidebar to start chatting.</p>
          </div>
        </div>
      </section>
    );
  }

  if (!groupKey) {
    return (
      <section className="chat-panel">
        <div className="empty-state">
          <div>
            <h2>Loading Group Key</h2>
            <p>Decrypting group encryption key...</p>
          </div>
        </div>
      </section>
    );
  }

  const myId = myUserId || localStorage.getItem("myUserId");
  const isCreator = selectedGroup.creatorId?._id === myId || selectedGroup.creatorId === myId;
  const creatorName = selectedGroup.creatorId?.name || selectedGroup.creatorId?.username || "Unknown";
  const createdDate = new Date(selectedGroup.createdAt).toLocaleDateString();

  return (
    <section className="chat-panel">
      <header className="chat-header">
        <div className="user-meta" style={{ display: "flex", alignItems: "center", flex: 1 }}>
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
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <strong>{selectedGroup.name}</strong>
              {isCreator && (
                <span className="badge" style={{ background: "var(--primary)", color: "black" }}>Admin</span>
              )}
            </div>
            <div className="contact-meta" style={{ fontSize: "0.75rem", marginTop: "4px" }}>
              Created by {creatorName} on {createdDate} • {selectedGroup.members?.length || 0} members
            </div>
          </div>

          {isCreator && (
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                className="secondary-btn"
                onClick={handleFixEncryption}
                title="Fix Encryption (Sync Keys)"
                style={{ color: "var(--warning)", borderColor: "var(--warning)" }}
              >
                🔄
              </button>
              <button
                className="secondary-btn"
                onClick={() => setShowAddMemberModal(true)}
                title="Add Members"
              >
                ➕
              </button>
              <button
                className="secondary-btn"
                onClick={handleDeleteGroup}
                title="Delete Group"
                style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
              >
                🗑️
              </button>
            </div>
          )}
        </div>
      </header>

      <div ref={listRef} className="message-list">
        {messages.map((m, i) => {
          const mine = m.senderId === myId || m.senderId?._id === myId || m.senderId?.toString() === myId;
          const senderName = m.senderId?.name || m.senderId?.username || "Unknown";

          return (
            <div key={m._id || i} className={`message-row ${mine ? "mine" : ""}`}>
              <div className="message-bubble">
                {!mine && (
                  <div style={{ fontSize: "0.75rem", opacity: 0.7, marginBottom: "4px" }}>
                    {senderName}
                  </div>
                )}
                <div>{m.decrypted || "[encrypted]"}</div>
                <div className="message-timestamp">
                  {new Date(m.timestamp).toLocaleString()}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSend} className="composer">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Type a message to the group…"
        />
        <button className="primary-btn" type="submit" disabled={!text.trim() || isSending}>
          {isSending ? "Sending…" : "Send"}
        </button>
      </form>

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.7)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div style={{
            background: "var(--surface)",
            borderRadius: "var(--radius-lg)",
            padding: "24px",
            width: "90%",
            maxWidth: "400px",
            maxHeight: "80vh",
            overflowY: "auto",
            border: "1px solid var(--glass-border)",
            backdropFilter: "blur(20px)"
          }}>
            <h3 style={{ marginTop: 0 }}>Add Members</h3>
            <div style={{ marginBottom: "16px", maxHeight: "200px", overflowY: "auto" }}>
              {friends.length === 0 ? (
                <div className="contact-meta">No new friends to add.</div>
              ) : (
                friends.map(friend => (
                  <label
                    key={friend._id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px",
                      cursor: "pointer",
                      borderRadius: "4px",
                      background: selectedNewMembers.some(f => f._id === friend._id)
                        ? "rgba(90, 209, 255, 0.1)"
                        : "transparent"
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedNewMembers.some(f => f._id === friend._id)}
                      onChange={() => {
                        setSelectedNewMembers(prev =>
                          prev.some(f => f._id === friend._id)
                            ? prev.filter(f => f._id !== friend._id)
                            : [...prev, friend]
                        );
                      }}
                    />
                    <span>{friend.name || friend.username}</span>
                  </label>
                ))
              )}
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                className="secondary-btn"
                onClick={() => setShowAddMemberModal(false)}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                className="primary-btn"
                onClick={handleAddMembers}
                disabled={selectedNewMembers.length === 0}
                style={{ flex: 1 }}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
