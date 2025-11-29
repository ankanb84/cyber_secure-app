import React, { useState } from "react";
import api from "../../services/api";

export default function Login({ setToken, onSwitchToRegister }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");



  async function handleLogin(e) {
    e.preventDefault();

    try {
      setStatus("Authenticating…");
      const res = await api.post("/auth/login", {
        username,
        password
      });

      completeLogin(res.data);
    } catch (err) {
      console.error(err);
      setStatus("Login failed: " + (err.response?.data?.error || err.message));
    }
  }

  function completeLogin(data) {
    const token = data.token;
    const userId = data.user?.id || data.user?._id;

    const identitySecret = localStorage.getItem(`identitySecretKey_${userId}`);
    const identityPublic = localStorage.getItem(`identityPublicKey_${userId}`);
    const preKeys = localStorage.getItem(`preKeySecrets_${userId}`);

    if (!identitySecret || !identityPublic) {
      setStatus("❗ No local keys stored for this identity. Generate keys on this device first.");
      return;
    }

    localStorage.setItem("identitySecretKey", identitySecret);
    localStorage.setItem("identityPublicKey", identityPublic);
    if (preKeys) localStorage.setItem("preKeySecrets", preKeys);

    setToken(token, userId);
    setStatus("🔐 Logged in — secure channel ready.");
  }

  const statusClass = status.startsWith("🔐") ? "success" : status.startsWith("❗") ? "error" : "";

  return (
    <div className="auth-form">
      <h3 style={{ fontSize: "1.8rem", margin: "0 0 8px 0", color: "white" }}>Login</h3>
      <p style={{ color: "rgba(255,255,255,0.6)", marginBottom: "24px" }}>Sign in to your secure account</p>

      <form onSubmit={handleLogin}>
        <input
          placeholder="Username or User ID"
          value={username}
          onChange={e => setUsername(e.target.value)}
          required
        />

        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />

        <button className="login-btn" type="submit">
          Login
        </button>

        <div style={{ marginTop: 20, textAlign: "center" }}>
          <button
            type="button"
            onClick={onSwitchToRegister}
            style={{
              background: "none",
              border: "none",
              color: "#22d3ee",
              cursor: "pointer",
              fontSize: "0.9rem"
            }}
          >
            Don't have an account? Create one
          </button>
        </div>
      </form>

      <div className={`status-text ${statusClass}`} style={{ marginTop: 12 }}>
        {status}
      </div>
    </div>
  );
}
