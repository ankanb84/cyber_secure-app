import React from "react";

export default function CallList({ onStartCall, calls = [] }) {
    const recentCalls = calls;

    return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "16px 24px", fontSize: "0.85rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "600" }}>
                Recent Calls
            </div>

            <div style={{ flex: 1, overflowY: "auto" }}>
                {recentCalls.map(call => (
                    <div key={call.id} className="user-item" style={{ cursor: "default" }}>
                        <div className="user-avatar">
                            <span>{call.name[0]}</span>
                        </div>
                        <div className="user-info">
                            <div className="user-name">{call.name}</div>
                            <div className="user-status" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span style={{ fontSize: "0.8rem" }}>{call.direction === "outgoing" ? "↗" : "↙"}</span>
                                <span style={{
                                    color: call.status === "missed" ? "var(--danger)" : "var(--text-muted)",
                                    fontSize: "0.85rem"
                                }}>
                                    {call.time}
                                </span>
                            </div>
                        </div>
                        <button
                            className="secondary-btn"
                            onClick={() => onStartCall(call.type)}
                            title={`Start ${call.type} call`}
                        >
                            {call.type === "video" ? "📹" : "📞"}
                        </button>
                    </div>
                ))}

                <div style={{ padding: "30px", textAlign: "center", color: "var(--text-dim)", fontSize: "0.9rem" }}>
                    <p>Start a new call from a chat</p>
                </div>
            </div>
        </div>
    );
}
