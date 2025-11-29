import React from "react";

export default function FriendRequestList({ requests, onAccept, onReject }) {
    if (!requests || requests.length === 0) {
        return (
            <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>
                No pending requests.
            </div>
        );
    }

    return (
        <div style={{ flex: 1, overflowY: "auto" }}>
            <div style={{ padding: "16px 24px", fontSize: "0.85rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "600" }}>
                Friend Requests
            </div>
            {requests.map(req => (
                <div key={req._id} className="user-item" style={{ cursor: "default" }}>
                    <div className="user-avatar">
                        {req.senderId.profilePicture ? (
                            <img src={req.senderId.profilePicture} alt={req.senderId.username} />
                        ) : (
                            <span>{req.senderId.username?.[0]?.toUpperCase()}</span>
                        )}
                    </div>
                    <div className="user-info">
                        <div className="user-name">{req.senderId.name || req.senderId.username}</div>
                        <div className="user-status">
                            @{req.senderId.username}
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                        <button
                            className="primary-btn"
                            onClick={() => onAccept(req._id)}
                            style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                        >
                            Accept
                        </button>
                        <button
                            className="secondary-btn"
                            onClick={() => onReject(req._id)}
                            style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                        >
                            Reject
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}
