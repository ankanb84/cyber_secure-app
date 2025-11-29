import React from "react";

export default function UserList({
  users,
  selectUser,
  selectedUserId,
  searchTerm,
  onSearchTermChange,
  isLoading,
  isGlobalSearch,
  onAddFriend
}) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "16px" }}>
        <input
          className="input-field"
          placeholder="Search friends…"
          value={searchTerm}
          onChange={e => onSearchTermChange(e.target.value)}
        />
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {isLoading && (
          <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>
            Loading contacts...
          </div>
        )}

        {!isLoading && users.length === 0 && (
          <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>
            No friends found.
          </div>
        )}

        {users.map(u => {
          const isSelected = selectedUserId === u._id || selectedUserId === u.id;
          return (
            <div
              key={u._id || u.id}
              className={`user-item ${isSelected ? "active" : ""}`}
              onClick={() => selectUser(u)}
            >
              <div className="user-avatar">
                {u.profilePicture ? (
                  <img src={u.profilePicture} alt={u.username} />
                ) : (
                  <span>{u.username?.[0]?.toUpperCase()}</span>
                )}
              </div>
              <div className="user-info">
                <div className="user-name">{u.name || u.username}</div>
                <div className="user-status">
                  {u.isOnline ? (
                    <span style={{ color: "var(--success)" }}>● Online</span>
                  ) : (
                    <span>{u.lastSeen ? `Last seen ${new Date(u.lastSeen).toLocaleDateString()}` : `@${u.username}`}</span>
                  )}
                </div>
              </div>
              {isGlobalSearch && onAddFriend && (
                <button
                  className="secondary-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddFriend(u._id);
                  }}
                  style={{ marginLeft: "8px", padding: "4px 8px", fontSize: "0.8rem" }}
                >
                  Add
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
