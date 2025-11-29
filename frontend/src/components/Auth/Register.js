import React, { useState } from "react";
import api from "../../services/api";
import { generateIdentityKeyPair, generatePreKeys, encodeBase64 } from "../../utils/crypto";

export default function Register({ setToken, onBackToLogin }) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [profilePicture, setProfilePicture] = useState(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState(null);
  const [status, setStatus] = useState("");
  const [isRegistered, setIsRegistered] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState({ uppercase: false, symbol: false, length: false });

  function compressImage(file, maxWidth = 200, maxHeight = 200, quality = 0.8) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = (width * maxHeight) / height;
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(resolve, 'image/jpeg', quality);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function handleProfilePictureChange(e) {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setStatus("Profile picture must be less than 5MB");
        return;
      }

      try {
        const compressedBlob = await compressImage(file);
        const reader = new FileReader();
        reader.onloadend = () => {
          setProfilePicturePreview(reader.result);
          setProfilePicture(reader.result);
          setStatus("");
        };
        reader.readAsDataURL(compressedBlob);
      } catch (err) {
        setStatus("Failed to process image");
      }
    }
  }

  function validatePassword(pwd) {
    const hasUpperCase = /[A-Z]/.test(pwd);
    const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd);
    const hasMinLength = pwd.length >= 8;

    return {
      valid: hasUpperCase && hasSymbol && hasMinLength,
      errors: {
        uppercase: !hasUpperCase,
        symbol: !hasSymbol,
        length: !hasMinLength
      }
    };
  }

  async function handleRegister(e) {
    e.preventDefault();

    // Validate all fields
    if (!name.trim()) {
      setStatus("Full name is required");
      return;
    }
    if (!username.trim()) {
      setStatus("Username is required");
      return;
    }
    if (!email.trim()) {
      setStatus("Email is required");
      return;
    }
    if (!phone.trim()) {
      setStatus("Phone number is required");
      return;
    }
    if (!profilePicture) {
      setStatus("Profile picture is required");
      return;
    }

    // Validate password
    const pwdValidation = validatePassword(password);
    if (!pwdValidation.valid) {
      setPasswordErrors(pwdValidation.errors);
      setStatus("Password must have: 1 uppercase, 1 symbol, and 8+ characters");
      return;
    }

    try {
      setStatus("Checking browser support…");

      // Check if Web Crypto is available (with better mobile support)
      try {
        const crypto = window.crypto || window.msCrypto;
        const subtle = crypto?.subtle || crypto?.webkitSubtle;

        if (!crypto || !subtle) {
          // Check if it's a secure context issue
          const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
          const isLocalNetwork = /^192\.168\.|^10\.|^172\.(1[6-9]|2[0-9]|3[01])\./.test(window.location.hostname);
          const isHTTPS = window.location.protocol === 'https:';

          if (!isLocalhost && !isHTTPS && !isLocalNetwork) {
            setStatus("⚠️ Note: For best security, use HTTPS. Trying to continue...");
          } else if (!subtle) {
            setStatus("❌ Error: Your browser doesn't support Web Crypto API. Please use Chrome, Firefox, Edge, or Safari.");
            return;
          }
        }
      } catch (err) {
        setStatus("⚠️ Warning: Could not verify crypto support. Continuing...");
      }

      setStatus("Generating encryption keys…");
      const identity = await generateIdentityKeyPair();
      setStatus("Generating prekeys…");
      const preKeys = await generatePreKeys(5);

      const identityPublicKey = encodeBase64(identity.publicKey);
      const identitySecretKeyBase64 = encodeBase64(identity.secretKey);

      const preKeySecrets = {};
      const preKeysToSend = preKeys.map(pk => {
        preKeySecrets[pk.keyId] = encodeBase64(pk.secretKey);
        return { keyId: pk.keyId, publicKey: encodeBase64(pk.publicKey), used: false };
      });

      setStatus("Registering account…");

      const res = await api.post("/auth/register", {
        name,
        username,
        email,
        phone,
        password,
        profilePicture,
        identityPublicKey,
        preKeys: preKeysToSend,
        signedPreKey: null
      });

      const userId = res.data.user?.id || res.data.user?._id;

      localStorage.setItem(`identitySecretKey_${userId}`, identitySecretKeyBase64);
      localStorage.setItem(`identityPublicKey_${userId}`, identityPublicKey);
      localStorage.setItem(`preKeySecrets_${userId}`, JSON.stringify(preKeySecrets));

      setStatus("✅ Account created successfully!");
      setIsRegistered(true);

      // Redirect to login after 2 seconds
      setTimeout(() => {
        onBackToLogin();
      }, 2000);
    } catch (err) {
      console.error(err);
      setStatus("Registration failed: " + (err.response?.data?.error || err.message));
    }
  }

  const statusClass = status.startsWith("✅") ? "success" : status.startsWith("Registration failed") ? "error" : "";

  if (isRegistered) {
    return (
      <div className="panel-card">
        <div style={{ textAlign: "center", padding: "20px" }}>
          <div style={{ fontSize: "3rem", marginBottom: "16px" }}>✅</div>
          <h3 style={{ marginBottom: "8px" }}>Account Created!</h3>
          <p style={{ color: "var(--text-muted)", marginBottom: "20px" }}>
            Redirecting to login page...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="register-card">
      <div className="register-icon">🛡️</div>
      <h2 className="register-title">SecureChat Pro</h2>
      <p className="register-subtitle">End-to-End Encrypted Messaging</p>

      <form onSubmit={handleRegister} className="register-form">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
          <label style={{ cursor: "pointer", position: "relative" }}>
            {profilePicturePreview ? (
              <img
                src={profilePicturePreview}
                alt="Profile"
                style={{
                  width: "70px",
                  height: "70px",
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "2px solid #8b5cf6",
                  boxShadow: "0 0 20px rgba(139, 92, 246, 0.3)"
                }}
              />
            ) : (
              <div style={{
                width: "70px",
                height: "70px",
                borderRadius: "50%",
                background: "rgba(255,255,255,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "2rem",
                border: "1px solid rgba(255,255,255,0.2)"
              }}>👤</div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleProfilePictureChange}
              style={{ display: "none" }}
              required
            />
            <div style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              background: "#8b5cf6",
              borderRadius: "50%",
              width: "24px",
              height: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              border: "2px solid #1a0b2e"
            }}>📷</div>
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
          <input
            placeholder="Full Name"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
          <input
            placeholder="Choose your username"
            value={username}
            minLength={3}
            maxLength={30}
            onChange={e => setUsername(e.target.value)}
            required
          />
          <input
            placeholder="Email Address"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <input
            placeholder="Phone Number"
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            required
          />
        </div>
        <div>
          <input
            placeholder="Password (8+ chars, 1 uppercase, 1 symbol)"
            type="password"
            value={password}
            onChange={e => {
              setPassword(e.target.value);
              if (e.target.value) {
                const validation = validatePassword(e.target.value);
                setPasswordErrors(validation.errors);
              } else {
                setPasswordErrors({ uppercase: false, symbol: false, length: false });
              }
            }}
            required
          />
        </div>

        <div style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "8px",
          margin: "10px 0 16px"
        }}>
          <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.9rem" }}>Already have an account?</span>
          <button
            type="button"
            onClick={onBackToLogin}
            style={{
              background: "none",
              border: "none",
              color: "#22d3ee",
              cursor: "pointer",
              fontSize: "0.9rem",
              fontWeight: "600",
              padding: 0
            }}
          >
            Login
          </button>
        </div>

        <button className="register-btn" type="submit">
          <span>🗝️</span> Generate Keys & Register
        </button>
      </form>

      <div className={`status-text ${statusClass}`} style={{ marginTop: 12 }}>
        {status}
      </div>
    </div>
  );
}
