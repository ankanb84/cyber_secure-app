import React, { useState, useEffect } from "react";

export default function LockScreen({ onUnlock, isSetupMode = false, onSetupComplete }) {
    const [pin, setPin] = useState("");
    const [confirmPin, setConfirmPin] = useState("");
    const [step, setStep] = useState(isSetupMode ? "setup_real" : "unlock"); // setup_real, setup_decoy, unlock
    const [error, setError] = useState("");

    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => setError(""), 3000);
            return () => clearTimeout(timer);
        }
    }, [error]);

    const handleNumberClick = (num) => {
        if (pin.length < 4) {
            setPin(prev => prev + num);
        }
    };

    const handleBackspace = () => {
        setPin(prev => prev.slice(0, -1));
    };

    const handleSubmit = () => {
        if (pin.length !== 4) return;

        if (isSetupMode) {
            if (step === "setup_real") {
                if (!confirmPin) {
                    setConfirmPin(pin);
                    setPin("");
                    return;
                }
                if (pin !== confirmPin) {
                    setError("PINs do not match. Try again.");
                    setPin("");
                    setConfirmPin("");
                    return;
                }
                // Real PIN set, move to Decoy
                onSetupComplete("real", pin);
                setStep("setup_decoy");
                setPin("");
                setConfirmPin("");
            } else if (step === "setup_decoy") {
                if (!confirmPin) {
                    setConfirmPin(pin);
                    setPin("");
                    return;
                }
                if (pin !== confirmPin) {
                    setError("PINs do not match. Try again.");
                    setPin("");
                    setConfirmPin("");
                    return;
                }
                onSetupComplete("decoy", pin);
            }
        } else {
            onUnlock(pin);
            setPin("");
        }
    };

    const getTitle = () => {
        if (isSetupMode) {
            if (step === "setup_real") return confirmPin ? "Confirm Real PIN" : "Set Real PIN";
            if (step === "setup_decoy") return confirmPin ? "Confirm Decoy PIN" : "Set Decoy PIN";
        }
        return "Security Vault Locked";
    };

    return (
        <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(5, 5, 10, 0.95)",
            backdropFilter: "blur(20px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            color: "var(--text)"
        }}>
            <div style={{
                background: "rgba(255, 255, 255, 0.05)",
                padding: "40px",
                borderRadius: "30px",
                border: "1px solid rgba(0, 240, 255, 0.1)",
                boxShadow: "0 0 50px rgba(0, 240, 255, 0.1)",
                width: "320px",
                textAlign: "center"
            }}>
                <div style={{ fontSize: "40px", marginBottom: "20px" }}>🛡️</div>
                <h2 style={{ margin: "0 0 10px 0", fontSize: "1.5rem", fontWeight: 600 }}>{getTitle()}</h2>
                <p style={{ color: "var(--text-muted)", marginBottom: "30px", fontSize: "0.9rem" }}>
                    {isSetupMode
                        ? "Create a 4-digit access code."
                        : "Enter your PIN to decrypt session."}
                </p>

                <div style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: "15px",
                    marginBottom: "30px"
                }}>
                    {[...Array(4)].map((_, i) => (
                        <div key={i} style={{
                            width: "15px",
                            height: "15px",
                            borderRadius: "50%",
                            background: i < pin.length ? "var(--primary)" : "rgba(255, 255, 255, 0.1)",
                            boxShadow: i < pin.length ? "0 0 10px var(--primary)" : "none",
                            transition: "all 0.2s ease"
                        }} />
                    ))}
                </div>

                {error && (
                    <div style={{ color: "var(--danger)", marginBottom: "20px", fontSize: "0.9rem" }}>
                        {error}
                    </div>
                )}

                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "15px",
                    marginBottom: "20px"
                }}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                        <button
                            key={num}
                            onClick={() => handleNumberClick(num.toString())}
                            style={{
                                background: "rgba(255, 255, 255, 0.05)",
                                border: "1px solid rgba(255, 255, 255, 0.1)",
                                borderRadius: "50%",
                                width: "60px",
                                height: "60px",
                                fontSize: "1.2rem",
                                color: "var(--text)",
                                cursor: "pointer",
                                transition: "all 0.2s ease"
                            }}
                            onMouseOver={e => e.target.style.background = "rgba(255, 255, 255, 0.1)"}
                            onMouseOut={e => e.target.style.background = "rgba(255, 255, 255, 0.05)"}
                        >
                            {num}
                        </button>
                    ))}
                    <div />
                    <button
                        onClick={() => handleNumberClick("0")}
                        style={{
                            background: "rgba(255, 255, 255, 0.05)",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            borderRadius: "50%",
                            width: "60px",
                            height: "60px",
                            fontSize: "1.2rem",
                            color: "var(--text)",
                            cursor: "pointer"
                        }}
                    >
                        0
                    </button>
                    <button
                        onClick={handleBackspace}
                        style={{
                            background: "transparent",
                            border: "none",
                            fontSize: "1.5rem",
                            color: "var(--text-muted)",
                            cursor: "pointer"
                        }}
                    >
                        ⌫
                    </button>
                </div>

                <button
                    onClick={handleSubmit}
                    disabled={pin.length !== 4}
                    className="primary-btn"
                    style={{ width: "100%", opacity: pin.length === 4 ? 1 : 0.5 }}
                >
                    {isSetupMode ? (confirmPin ? "Confirm" : "Next") : "Unlock Vault"}
                </button>
            </div>
        </div>
    );
}
