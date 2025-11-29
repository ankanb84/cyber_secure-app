import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import api from "../../services/api";
import UserList from "./UserList";
import ChatWindow from "./ChatWindowEnhanced";
import GroupList from "../Groups/GroupList";
import CreateGroup from "../Groups/CreateGroup";
import GroupChatWindow from "../Groups/GroupChatWindow";
import WebRTCCall from "../Calls/WebRTCCall";
import CallList from "../Calls/CallList";
import SettingsModal from "../Settings/SettingsModal";
import FriendRequestList from "./FriendRequestList";

export default function ChatPage({ token, myUserId, setToken, isDecoyMode }) {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [systemLog, setSystemLog] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeView, setActiveView] = useState("friends"); // friends, groups, calls, requests
  const [friendRequests, setFriendRequests] = useState([]);
  const [globalUsers, setGlobalUsers] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const webRTCCallRef = useRef(null);

  const [callHistory, setCallHistory] = useState([]);

  const addLog = useCallback((message, tone = "info") => {
    setSystemLog(prev => [
      { message, tone, timestamp: new Date().toISOString() },
      ...prev
    ].slice(0, 20));
  }, []);

  useEffect(() => {
    let isActive = true;

    if (isDecoyMode) {
      setUsers([
        { _id: "decoy1", username: "Support", name: "System Support", isOnline: true, lastSeen: new Date().toISOString() },
        { _id: "decoy2", username: "Welcome", name: "Welcome Bot", isOnline: false, lastSeen: new Date().toISOString() }
      ]);
      setCurrentUser({ _id: "decoyMe", username: "Guest", name: "Guest User" });
      setIsLoadingUsers(false);
      addLog("Decoy environment active", "warning");
      return;
    }

    // Fetch current user profile
    (async () => {
      try {
        const userRes = await api.get("/users/me");
        if (!isActive) return;
        setCurrentUser(userRes.data);
      } catch (err) {
        console.error("Failed to fetch current user:", err);
      }
    })();

    // Fetch friends list
    (async () => {
      try {
        const res = await api.get("/friends/list");
        if (!isActive) return;
        setUsers(res.data || []);
        addLog(`Friends loaded (${res.data.length} total)`, "success");
      } catch (err) {
        console.error(err);
        addLog("Unable to fetch friends", "error");
      } finally {
        if (isActive) setIsLoadingUsers(false);
      }
    })();

    // Fetch friend requests
    (async () => {
      try {
        const res = await api.get("/friends/requests");
        if (!isActive) return;
        setFriendRequests(res.data || []);
      } catch (err) {
        console.error("Failed to fetch friend requests:", err);
      }
    })();

    return () => { isActive = false; };
  }, [addLog, isDecoyMode]);

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return users;
    return users.filter(u =>
      (u.username?.toLowerCase().includes(term)) ||
      (u.name?.toLowerCase().includes(term))
    );
  }, [users, searchTerm]);

  // Global search effect
  useEffect(() => {
    if (!searchTerm.trim() || activeView !== "friends") {
      setGlobalUsers([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/users/search/${searchTerm}`);
        // Filter out existing friends and self
        const friendsIds = new Set(users.map(u => u._id));
        const filtered = res.data.filter(u => !friendsIds.has(u._id) && u._id !== myUserId);
        setGlobalUsers(filtered);
      } catch (err) {
        console.error("Global search failed", err);
      }
    }, 500);

    return () => clearTimeout(timer);

  }, [searchTerm, users, myUserId, activeView]);

  // Fetch call history when view changes to calls
  useEffect(() => {
    if (activeView === "calls") {
      fetchCallHistory();
    }
  }, [activeView]);

  async function fetchCallHistory() {
    try {
      const res = await api.get("/calls/history");
      // Format dates for display
      const formatted = res.data.map(call => ({
        ...call,
        time: new Date(call.time).toLocaleString([], {
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        })
      }));
      setCallHistory(formatted);
    } catch (err) {
      console.error("Failed to fetch call history", err);
      addLog("Failed to load call history", "error");
    }
  }

  async function handleSendFriendRequest(userId) {
    try {
      await api.post("/friends/request", { recipientId: userId });
      addLog("Friend request sent", "success");
      // Remove from global list to give feedback
      setGlobalUsers(prev => prev.filter(u => u._id !== userId));
    } catch (err) {
      console.error(err);
      addLog(err.response?.data?.error || "Failed to send request", "error");
    }
  }

  async function handleAcceptFriendRequest(requestId) {
    try {
      await api.post(`/friends/accept/${requestId}`);
      addLog("Friend request accepted", "success");
      // Refresh friends and requests
      const [friendsRes, requestsRes] = await Promise.all([
        api.get("/friends/list"),
        api.get("/friends/requests")
      ]);
      setUsers(friendsRes.data || []);
      setFriendRequests(requestsRes.data || []);
    } catch (err) {
      console.error(err);
      addLog("Failed to accept request", "error");
    }
  }

  async function handleRejectFriendRequest(requestId) {
    try {
      await api.post(`/friends/reject/${requestId}`);
      addLog("Friend request rejected", "info");
      setFriendRequests(prev => prev.filter(r => r._id !== requestId));
    } catch (err) {
      console.error(err);
      addLog("Failed to reject request", "error");
    }
  }

  function selectUser(u) {
    setSelectedUser(u);
    setSelectedGroup(null);
    // addLog(`Pinned session with ${u.name || u.username}`, "info");
  }

  function selectGroup(g) {
    setSelectedGroup(g);
    setSelectedUser(null);
    // addLog(`Joined group: ${g.name}`, "info");
  }

  function handleGroupCreated() {
    addLog("Group created successfully", "success");
    // Reload groups will be handled by GroupList
  }

  function handleLogout() {
    setToken(null);
  }

  function handleCallStart(user, type) {
    if (webRTCCallRef.current) {
      webRTCCallRef.current.startCall(user, type);
    }
  }

  const handleClearChats = async () => {
    try {
      if (isDecoyMode) return;
      // In a real app, this would be an API call to delete all messages
      // For now, we'll just reload the page to clear local state if any
      // await api.delete("/messages/all"); 
      addLog("All chats cleared locally", "warning");
      window.location.reload();
    } catch (err) {
      console.error(err);
      addLog("Failed to clear chats", "error");
    }
  };

  const handleClearCalls = async () => {
    try {
      if (isDecoyMode) return;
      // await api.delete("/calls/history"); // Implement delete endpoint if needed
      setCallHistory([]);
      addLog("Call history cleared", "warning");
    } catch (err) {
      console.error(err);
      addLog("Failed to clear call logs", "error");
    }
  };

  return (
    <div className={`chat-shell ${selectedUser || selectedGroup ? "mobile-chat-active" : ""}`}>
      <aside className="sidebar">
        <div className="panel-header">
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div className="user-avatar">
              {currentUser?.profilePicture ? (
                <img src={currentUser.profilePicture} alt="me" />
              ) : (
                <span>{currentUser?.username?.[0]?.toUpperCase() || "ME"}</span>
              )}
            </div>
            <div>
              <div style={{ fontWeight: "600", fontSize: "1rem" }}>{currentUser?.username || "Me"}</div>
              <div style={{ fontSize: "0.8rem", color: "var(--primary)", opacity: 0.8 }}>
                {isDecoyMode ? "GUEST MODE" : `ID: ${myUserId?.substring(0, 8)}...`}
              </div>
            </div>
          </div>

          <div style={{ position: "relative" }}>
            <button
              className="secondary-btn"
              onClick={() => setShowMenu(!showMenu)}
              style={{ padding: "8px", fontSize: "1.2rem", border: "none" }}
            >
              ⋮
            </button>
            {showMenu && (
              <div style={{
                position: "absolute",
                top: "100%",
                right: 0,
                background: "rgba(15, 10, 30, 0.95)",
                backdropFilter: "blur(20px)",
                border: "1px solid var(--glass-border)",
                boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
                borderRadius: "12px",
                padding: "8px",
                zIndex: 100,
                minWidth: "180px",
                overflow: "hidden"
              }}>
                <button
                  className="menu-item"
                  onClick={() => { setShowSettings(true); setShowMenu(false); }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    width: "100%",
                    textAlign: "left",
                    padding: "12px 16px",
                    background: "none",
                    border: "none",
                    color: "var(--text)",
                    cursor: "pointer",
                    borderRadius: "8px",
                    fontSize: "0.9rem"
                  }}
                >
                  <span>⚙️</span> Settings
                </button>
                <button
                  className="menu-item"
                  onClick={handleLogout}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    width: "100%",
                    textAlign: "left",
                    padding: "12px 16px",
                    background: "none",
                    border: "none",
                    color: "var(--danger)",
                    cursor: "pointer",
                    borderRadius: "8px",
                    fontSize: "0.9rem"
                  }}
                >
                  <span>🚪</span> Log out
                </button>
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: "16px 24px 0" }}>
          <div style={{
            display: "flex",
            gap: "8px",
            background: "rgba(255,255,255,0.03)",
            padding: "4px",
            borderRadius: "12px"
          }}>
            <button
              className={`toggle-link ${activeView === "friends" ? "active" : ""}`}
              onClick={() => setActiveView("friends")}
            >
              Friends
            </button>
            <button
              className={`toggle-link ${activeView === "groups" ? "active" : ""}`}
              onClick={() => setActiveView("groups")}
            >
              Groups
            </button>
            <button
              className={`toggle-link ${activeView === "calls" ? "active" : ""}`}
              onClick={() => setActiveView("calls")}
            >
              Calls
            </button>
          </div>
          <div style={{
            display: "flex",
            gap: "8px",
            background: "rgba(255,255,255,0.03)",
            padding: "4px",
            borderRadius: "12px",
            marginTop: "8px"
          }}>
            <button
              className={`toggle-link ${activeView === "requests" ? "active" : ""}`}
              onClick={() => setActiveView("requests")}
              style={{ flex: 1, justifyContent: "center" }}
            >
              Requests {friendRequests.length > 0 && <span className="badge">{friendRequests.length}</span>}
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {activeView === "friends" ? (
            <>
              <UserList
                users={filteredUsers}
                isLoading={isLoadingUsers}
                selectUser={selectUser}
                selectedUserId={selectedUser?._id || selectedUser?.id}
                searchTerm={searchTerm}
                onSearchTermChange={setSearchTerm}
              />
              {searchTerm && globalUsers.length > 0 && (
                <div style={{ borderTop: "1px solid var(--glass-border)", paddingTop: "8px" }}>
                  <div style={{ padding: "8px 24px", fontSize: "0.8rem", color: "var(--primary)", opacity: 0.8 }}>
                    Global Search Results
                  </div>
                  <UserList
                    users={globalUsers}
                    isLoading={false}
                    selectUser={() => { }} // No selection for global users yet, just add
                    selectedUserId={null}
                    searchTerm="" // Don't filter again
                    onSearchTermChange={() => { }}
                    isGlobalSearch={true}
                    onAddFriend={handleSendFriendRequest}
                  />
                </div>
              )}
            </>
          ) : activeView === "requests" ? (
            <FriendRequestList
              requests={friendRequests}
              onAccept={handleAcceptFriendRequest}
              onReject={handleRejectFriendRequest}
            />
          ) : activeView === "groups" ? (
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <CreateGroup onGroupCreated={handleGroupCreated} myUserId={myUserId} />
              <GroupList
                onSelectGroup={selectGroup}
                selectedGroupId={selectedGroup?._id}
                myUserId={myUserId}
                token={token}
              />
            </div>
          ) : (
            <CallList calls={callHistory} onStartCall={handleCallStart} />
          )}
        </div>
      </aside>

      {selectedGroup ? (
        <GroupChatWindow
          token={token}
          selectedGroup={selectedGroup}
          myUserId={myUserId}
          onSecurityEvent={addLog}
          onBack={() => setSelectedGroup(null)}
        />
      ) : (
        <ChatWindow
          token={token}
          selectedUser={selectedUser}
          myUserId={myUserId}
          onSecurityEvent={addLog}
          onCallStart={handleCallStart}
          onBack={() => setSelectedUser(null)}
        />
      )}

      {/* WebRTC Call Component (Hidden until active) */}
      <WebRTCCall
        ref={webRTCCallRef}
        selectedUser={selectedUser}
        myUserId={myUserId}
        users={users}
      />

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onEvent={addLog}
          myUserId={myUserId}
          systemLog={systemLog}
          onLogout={() => setToken(null)}
          onClearChats={handleClearChats}
          onClearCalls={handleClearCalls}
        />
      )}
    </div>
  );
}
