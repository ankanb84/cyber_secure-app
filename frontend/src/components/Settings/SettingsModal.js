import React, { useState } from "react";
import SettingsPanel from "./SettingsPanel";
import KeyManager from "../KeyManagement/KeyManager";
import DeviceSync from "../Devices/DeviceSync";
import BackupExport from "../Backup/BackupExport";

export default function SettingsModal({ onClose, onEvent, myUserId, systemLog, onLogout, onClearChats, onClearCalls }) {
    const [activeTab, setActiveTab] = useState("general");

    const renderContent = () => {
        switch (activeTab) {
            case "general":
                return (
                    <>
                        <SettingsPanel onEvent={onEvent} />
                        <div className="info-section" style={{ marginTop: "20px" }}>
                            <h4 style={{ marginTop: 0 }}>Data Management</h4>
                            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                <button
                                    className="secondary-btn"
                                    onClick={() => {
                                        if (window.confirm("Are you sure you want to clear all chats? This cannot be undone.")) {
                                            onEvent("Clear Chats Requested");
                                            if (onClearChats) onClearChats();
                                        }
                                    }}
                                    style={{ width: "100%", borderColor: "var(--danger)", color: "var(--danger)" }}
                                >
                                    🗑️ Clear All Chats
                                </button>
                                <button
                                    className="secondary-btn"
                                    onClick={() => {
                                        if (window.confirm("Are you sure you want to clear call history?")) {
                                            onEvent("Clear Call Logs Requested");
                                            if (onClearCalls) onClearCalls();
                                        }
                                    }}
                                    style={{ width: "100%", borderColor: "var(--danger)", color: "var(--danger)" }}
                                >
                                    📞 Clear Call Logs
                                </button>
                            </div>
                        </div>
                        <div className="info-section" style={{ marginTop: "20px" }}>
                            <h4 style={{ marginTop: 0 }}>Session</h4>
                            <button className="secondary-btn" onClick={onLogout} style={{ width: "100%", borderColor: "var(--text-muted)", color: "var(--text-muted)" }}>
                                Disconnect & Clear Token
                            </button>
                        </div>
                    </>
                );
            case "keys":
                return <KeyManager onEvent={onEvent} />;
            case "devices":
                return <DeviceSync myUserId={myUserId} onEvent={onEvent} />;
            case "backup":
                return <BackupExport myUserId={myUserId} onEvent={onEvent} />;
            case "logs":
                return (
                    <div className="info-section">
                        <h4 style={{ marginTop: 0 }}>Security Log</h4>
                        <div className="log-list" style={{ maxHeight: "400px", overflowY: "auto" }}>
                            {systemLog.length === 0 && <div className="contact-meta">No events yet.</div>}
                            {systemLog.map((entry, idx) => (
                                <div key={`${entry.timestamp}-${idx}`} className="log-item">
                                    <div>{entry.message}</div>
                                    <small>{new Date(entry.timestamp).toLocaleTimeString()}</small>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(10px)",
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
        }}>
            <div className="glass-panel" style={{
                width: "800px",
                height: "600px",
                borderRadius: "24px",
                display: "flex",
                overflow: "hidden",
                boxShadow: "0 0 50px rgba(0, 242, 255, 0.1)"
            }}>
                {/* Sidebar */}
                <div style={{
                    width: "200px",
                    background: "rgba(0, 0, 0, 0.3)",
                    borderRight: "1px solid var(--glass-border)",
                    padding: "20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px"
                }}>
                    <h3 style={{ margin: "0 0 20px 0", fontSize: "1.2rem" }}>Settings</h3>
                    {[
                        { id: "general", label: "General", icon: "⚙️" },
                        { id: "keys", label: "Keys", icon: "🔑" },
                        { id: "devices", label: "Devices", icon: "📱" },
                        { id: "backup", label: "Backup", icon: "💾" },
                        { id: "logs", label: "Logs", icon: "📜" }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`secondary-btn ${activeTab === tab.id ? "active-neon" : ""}`}
                            style={{
                                textAlign: "left",
                                border: activeTab === tab.id ? "1px solid var(--primary)" : "1px solid transparent",
                                background: activeTab === tab.id ? "rgba(0, 242, 255, 0.1)" : "transparent",
                                color: activeTab === tab.id ? "var(--primary)" : "var(--text)",
                                borderRadius: "12px"
                            }}
                        >
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                    <div style={{
                        padding: "20px",
                        borderBottom: "1px solid var(--glass-border)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                    }}>
                        <h3 style={{ margin: 0 }}>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h3>
                        <button
                            className="secondary-btn"
                            onClick={onClose}
                            style={{ padding: "4px 12px", fontSize: "1.2rem" }}
                        >
                            ✕
                        </button>
                    </div>
                    <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
                        {renderContent()}
                    </div>
                </div>
            </div>
        </div>
    );
}
