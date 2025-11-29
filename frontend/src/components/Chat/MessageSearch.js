import React, { useState } from "react";

export default function MessageSearch({ messages, onSearchResult }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState([]);

  const handleSearch = (query) => {
    setSearchQuery(query);
    
    if (!query.trim()) {
      setResults([]);
      onSearchResult?.([]);
      return;
    }

    // Client-side search (decrypted messages only)
    const lowerQuery = query.toLowerCase();
    const filtered = messages.filter(msg => {
      if (msg.deleted || !msg.decrypted) return false;
      return msg.decrypted.toLowerCase().includes(lowerQuery);
    });

    setResults(filtered);
    onSearchResult?.(filtered);
  };

  return (
    <div style={{ padding: "10px", borderBottom: "1px solid var(--border)" }}>
      <input
        type="text"
        placeholder="Search messages..."
        value={searchQuery}
        onChange={e => handleSearch(e.target.value)}
        className="input-field"
        style={{ width: "100%" }}
      />
      {results.length > 0 && (
        <div style={{ marginTop: "8px", fontSize: "12px", color: "var(--text-secondary)" }}>
          Found {results.length} result{results.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

