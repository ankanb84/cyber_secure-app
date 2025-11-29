// D:\cyber_chat\frontend\src\App.js
import React, { useState, useEffect } from "react";
import Login from "./components/Auth/Login";
import Register from "./components/Auth/Register";
import ChatPage from "./components/Chat/ChatPage";

function App() {
  const [token, setTokenState] = useState(localStorage.getItem("token") || null);
  const [myUserId, setMyUserId] = useState(localStorage.getItem("myUserId") || null);
  const [authView, setAuthView] = useState("login");

  // Security State
  const [isDecoyMode, setIsDecoyMode] = useState(false);

  function setToken(tokenValue, userId) {
    if (tokenValue) {
      localStorage.setItem("token", tokenValue);
      localStorage.setItem("myUserId", userId);
    } else {
      localStorage.removeItem("token");
      localStorage.removeItem("myUserId");
      localStorage.removeItem("identitySecretKey");
      localStorage.removeItem("identityPublicKey");
      localStorage.removeItem("preKeySecrets");
    }

    setTokenState(tokenValue);
    setMyUserId(userId || null);
    if (!tokenValue) setAuthView("login");

    if (tokenValue && userId) {
      const idSec = localStorage.getItem(`identitySecretKey_${userId}`);
      const idPub = localStorage.getItem(`identityPublicKey_${userId}`);
      const pks = localStorage.getItem(`preKeySecrets_${userId}`);

      if (idSec && idPub) {
        localStorage.setItem("identitySecretKey", idSec);
        localStorage.setItem("identityPublicKey", idPub);
        if (pks) localStorage.setItem("preKeySecrets", pks);
      }
    }
  }

  if (!token) {
    const isLoginView = authView === "login";

    return (
      <div className="auth-layout">
        {isLoginView ? (
          <div className="auth-container">
            <section className="auth-hero">
              <div className="hero-badges">
                <span className="hero-badge">🔐 End-to-End Encrypted</span>
                <span className="hero-badge">🛡️ Zero-Knowledge</span>
              </div>
              <h1>Secure Chat</h1>
              <p>
                Your messages are encrypted with Web Crypto API. Only you and the recipient can read them.
              </p>
            </section>

            <div className="auth-card">
              <div className="auth-toggle">
                <button
                  className={`toggle-link ${isLoginView ? "active" : ""}`}
                  type="button"
                  onClick={() => setAuthView("login")}
                >
                  Login
                </button>
                <button
                  className={`toggle-link ${!isLoginView ? "active" : ""}`}
                  type="button"
                  onClick={() => setAuthView("register")}
                >
                  Create Account
                </button>
              </div>
              <Login setToken={setToken} onSwitchToRegister={() => setAuthView("register")} />
            </div>
          </div>
        ) : (
          <div className="auth-container centered">
            <Register setToken={setToken} onBackToLogin={() => setAuthView("login")} />
          </div>
        )}
      </div>
    );
  }

  return (
    <ChatPage
      token={token}
      myUserId={myUserId}
      setToken={setToken}
      isDecoyMode={isDecoyMode}
    />
  );
}

export default App;
