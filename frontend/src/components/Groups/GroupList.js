import React, { useState, useEffect } from "react";
import api from "../../services/api";
import socketService from "../../services/socket";

export default function GroupList({ onSelectGroup, selectedGroupId, myUserId, token }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGroups();

    const socket = socketService.connect(token);

    const handleGroupCreated = (newGroup) => {
      // Only add if I'm a member (should be true if I received the event)
      const isMember = newGroup.members.some(m => {
        const id = m.userId._id || m.userId;
        return id.toString() === myUserId;
      });

      if (isMember) {
        setGroups(prev => [newGroup, ...prev]);
      }
    };

    const handleGroupUpdated = (updatedGroup) => {
      setGroups(prev => prev.map(g =>
        g._id === updatedGroup._id ? updatedGroup : g
      ));
    };

    const handleGroupLeft = ({ groupId }) => {
      setGroups(prev => prev.filter(g => g._id !== groupId));
    };

    socket.on("group_created", handleGroupCreated);
    socket.on("group_updated", handleGroupUpdated);
    socket.on("group_left", handleGroupLeft);

    return () => {
      socket.off("group_created", handleGroupCreated);
      socket.off("group_updated", handleGroupUpdated);
      socket.off("group_left", handleGroupLeft);
    };
  }, [token, myUserId]);

  const loadGroups = async () => {
    try {
      const res = await api.get("/groups");
      setGroups(res.data || []);
    } catch (err) {
      console.error("Failed to load groups:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="contact-meta">Loading groups...</div>;
  }

  return (
    <div>
      <div className="sidebar-header" style={{ borderBottom: "1px solid var(--border)" }}>
        <h3 style={{ margin: 0 }}>Groups</h3>
      </div>
      <div className="sidebar-body" style={{ maxHeight: "300px", overflowY: "auto" }}>
        {groups.length === 0 ? (
          <div className="contact-meta" style={{ textAlign: "center", padding: "20px" }}>
            No groups yet. Create a group to start chatting.
          </div>
        ) : (
          groups.map(group => (
            <div
              key={group._id}
              className={`contact-item ${selectedGroupId === group._id ? "selected" : ""}`}
              onClick={() => onSelectGroup(group)}
              style={{ display: "flex", alignItems: "center", gap: "12px" }}
            >
              <div style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                overflow: "hidden",
                flexShrink: 0,
                background: "var(--surface-muted)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                {group.avatar ? (
                  <img
                    src={group.avatar}
                    alt={group.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <span style={{ fontSize: "1.5rem" }}>👥</span>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="contact-name" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {group.name}
                </div>
                <div className="contact-meta">
                  {group.members?.length || 0} members
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

