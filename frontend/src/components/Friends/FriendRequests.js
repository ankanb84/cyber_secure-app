import React, { useState, useEffect } from "react";
import api from "../../services/api";

export default function FriendRequests({ onFriendAccepted }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    try {
      const res = await api.get("/friends/requests");
      setRequests(res.data || []);
    } catch (err) {
      console.error("Failed to load friend requests", err);
    } finally {
      setLoading(false);
    }
  }

  async function searchUsers(query) {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await api.get(`/users/search/${query}`);
      setSearchResults(res.data || []);
    } catch (err) {
      console.error("Search failed", err);
    }
  }

  async function sendFriendRequest(userId) {
    try {
      await api.post("/friends/request", { recipientId: userId });
      await loadRequests();
      setShowSearch(false);
      setSearchTerm("");
      setSearchResults([]);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to send friend request");
    }
  }

  async function acceptRequest(requestId) {
    try {
      await api.post(`/friends/accept/${requestId}`);
      await loadRequests();
      onFriendAccepted?.();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to accept request");
    }
  }

  async function rejectRequest(requestId) {
    try {
      await api.post(`/friends/reject/${requestId}`);
      await loadRequests();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to reject request");
    }
  }

  const myUserId = localStorage.getItem("myUserId");
  const receivedRequests = requests.filter(r => r.recipientId?._id === myUserId || r.recipientId === myUserId);
  const sentRequests = requests.filter(r => r.senderId?._id === myUserId || r.senderId === myUserId);

  return (
    <div>
      <div className="sidebar-header" style={{ borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h3 style={{ margin: 0 }}>Friends</h3>
          <button 
            className="secondary-btn" 
            onClick={() => setShowSearch(!showSearch)}
            style={{ padding: "6px 12px", fontSize: "0.85rem" }}
          >
            {showSearch ? "Cancel" : "+ Add Friend"}
          </button>
        </div>
        {showSearch && (
          <input
            className="input-field"
            placeholder="Search by username or name..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              searchUsers(e.target.value);
            }}
          />
        )}
      </div>

      <div className="sidebar-body" style={{ maxHeight: "300px", overflowY: "auto" }}>
        {showSearch && (
          <div style={{ marginBottom: "20px" }}>
            <h4 style={{ fontSize: "0.9rem", marginBottom: "12px" }}>Search Results</h4>
            {searchResults.length === 0 && searchTerm && (
              <div className="contact-meta">No users found</div>
            )}
            {searchResults.map(user => {
              const alreadyRequested = requests.some(r => 
                (r.senderId?._id === myUserId || r.senderId === myUserId) &&
                (r.recipientId?._id === user._id || r.recipientId === user._id)
              );
              return (
                <div key={user._id} className="contact-item" style={{ marginBottom: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ 
                      width: "40px", 
                      height: "40px", 
                      borderRadius: "50%", 
                      overflow: "hidden",
                      background: "var(--surface-muted)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}>
                      {user.profilePicture ? (
                        <img 
                          src={user.profilePicture} 
                          alt={user.name || user.username}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <span style={{ fontSize: "1.2rem" }}>👤</span>
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{user.name || user.username}</div>
                      <div className="contact-meta">@{user.username}</div>
                    </div>
                    {alreadyRequested ? (
                      <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Requested</span>
                    ) : (
                      <button 
                        className="secondary-btn"
                        onClick={() => sendFriendRequest(user._id)}
                        style={{ padding: "6px 12px", fontSize: "0.85rem" }}
                      >
                        Add
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {receivedRequests.length > 0 && (
          <div style={{ marginBottom: "20px" }}>
            <h4 style={{ fontSize: "0.9rem", marginBottom: "12px" }}>Friend Requests</h4>
            {receivedRequests.map(req => (
              <div key={req._id} className="contact-item" style={{ marginBottom: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                  <div style={{ 
                    width: "40px", 
                    height: "40px", 
                    borderRadius: "50%", 
                    overflow: "hidden",
                    background: "var(--surface-muted)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                    {req.senderId?.profilePicture ? (
                      <img 
                        src={req.senderId.profilePicture} 
                        alt={req.senderId.name || req.senderId.username}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <span style={{ fontSize: "1.2rem" }}>👤</span>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{req.senderId?.name || req.senderId?.username}</div>
                    <div className="contact-meta">wants to be friends</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button 
                    className="primary-btn"
                    onClick={() => acceptRequest(req._id)}
                    style={{ flex: 1, padding: "8px", fontSize: "0.85rem" }}
                  >
                    Accept
                  </button>
                  <button 
                    className="secondary-btn"
                    onClick={() => rejectRequest(req._id)}
                    style={{ flex: 1, padding: "8px", fontSize: "0.85rem" }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {sentRequests.length > 0 && (
          <div>
            <h4 style={{ fontSize: "0.9rem", marginBottom: "12px" }}>Sent Requests</h4>
            {sentRequests.map(req => (
              <div key={req._id} className="contact-item" style={{ marginBottom: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ 
                    width: "40px", 
                    height: "40px", 
                    borderRadius: "50%", 
                    overflow: "hidden",
                    background: "var(--surface-muted)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                    {req.recipientId?.profilePicture ? (
                      <img 
                        src={req.recipientId.profilePicture} 
                        alt={req.recipientId.name || req.recipientId.username}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <span style={{ fontSize: "1.2rem" }}>👤</span>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{req.recipientId?.name || req.recipientId?.username}</div>
                    <div className="contact-meta">Pending...</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!showSearch && receivedRequests.length === 0 && sentRequests.length === 0 && (
          <div className="contact-meta" style={{ textAlign: "center", padding: "20px" }}>
            No friend requests. Click "+ Add Friend" to find users.
          </div>
        )}
      </div>
    </div>
  );
}

