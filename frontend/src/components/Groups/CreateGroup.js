import React, { useState, useEffect } from "react";
import api from "../../services/api";
import { encryptMessageBase64 } from "../../utils/crypto";
import { generateAesKeyRaw, uint8ToBase64String } from "../../utils/crypto";

export default function CreateGroup({ onGroupCreated, myUserId }) {
  const [groupName, setGroupName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (showModal) {
      loadFriends();
    }
  }, [showModal]);

  const loadFriends = async () => {
    try {
      const res = await api.get("/friends/list");
      setFriends(res.data || []);
    } catch (err) {
      console.error("Failed to load friends:", err);
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupName.trim() || selectedFriends.length === 0) {
      alert("Please enter group name and select at least one friend");
      return;
    }

    setLoading(true);
    console.log("Creating group:", groupName, "with members:", selectedFriends.map(f => f._id));

    try {
      // Generate group key
      const groupKey = await generateAesKeyRaw();
      const groupKeyBase64 = uint8ToBase64String(groupKey);
      console.log("Generated group key");

      // Encrypt group key for each member (including creator)
      const memberIds = [myUserId, ...selectedFriends.map(f => f._id)];
      console.log("Encrypting keys for members:", memberIds);

      const membersWithKeys = await Promise.all(
        memberIds.map(async (memberId) => {
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
          } catch (keyErr) {
            console.error(`Failed to encrypt for member ${memberId}:`, keyErr);
            return null;
          }
        })
      );

      const validMembersWithKeys = membersWithKeys.filter(m => m !== null);

      if (validMembersWithKeys.length !== memberIds.length) {
        console.warn("Some members could not have keys encrypted");
      }

      // Create group
      console.log("Sending create group request...");
      const groupRes = await api.post("/groups", {
        name: groupName,
        description,
        memberIds: selectedFriends.map(f => f._id)
      });
      console.log("Group created:", groupRes.data._id);

      // Update group with encrypted keys
      console.log("Patching group with keys...");
      await api.patch(`/groups/${groupRes.data._id}`, {
        members: validMembersWithKeys.map(m => ({
          userId: m.userId,
          encryptedGroupKey: m.encryptedGroupKey,
          ephemeralPublicKey: m.ephemeralPublicKey,
          keyNonce: m.keyNonce
        }))
      });
      console.log("Group patched with keys");

      // Store group key locally for this group
      localStorage.setItem(`group_key_${groupRes.data._id}`, groupKeyBase64);

      setGroupName("");
      setDescription("");
      setSelectedFriends([]);
      setShowModal(false);
      onGroupCreated?.();
      alert("Group created successfully!");
    } catch (err) {
      console.error("Failed to create group:", err);
      alert("Failed to create group: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const toggleFriend = (friend) => {
    setSelectedFriends(prev =>
      prev.some(f => f._id === friend._id)
        ? prev.filter(f => f._id !== friend._id)
        : [...prev, friend]
    );
  };

  if (!showModal) {
    return (
      <button
        className="primary-btn"
        onClick={() => setShowModal(true)}
        style={{ width: "100%", marginBottom: "12px" }}
      >
        + Create Group
      </button>
    );
  }

  return (
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
        maxWidth: "500px",
        maxHeight: "80vh",
        overflowY: "auto"
      }}>
        <h3 style={{ marginTop: 0 }}>Create Group</h3>

        <form onSubmit={handleCreateGroup}>
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "8px" }}>Group Name *</label>
            <input
              type="text"
              className="input-field"
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              required
              placeholder="Enter group name"
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "8px" }}>Description</label>
            <textarea
              className="input-field"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "8px" }}>Select Friends *</label>
            <div style={{
              maxHeight: "200px",
              overflowY: "auto",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              padding: "8px"
            }}>
              {friends.length === 0 ? (
                <div className="contact-meta">No friends available</div>
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
                      background: selectedFriends.some(f => f._id === friend._id)
                        ? "rgba(90, 209, 255, 0.1)"
                        : "transparent"
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedFriends.some(f => f._id === friend._id)}
                      onChange={() => toggleFriend(friend)}
                    />
                    <span>{friend.name || friend.username}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => {
                setShowModal(false);
                setGroupName("");
                setDescription("");
                setSelectedFriends([]);
              }}
              style={{ flex: 1 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="primary-btn"
              disabled={loading || !groupName.trim() || selectedFriends.length === 0}
              style={{ flex: 1 }}
            >
              {loading ? "Creating..." : "Create Group"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

