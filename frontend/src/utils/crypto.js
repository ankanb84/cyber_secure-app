const encoder = new TextEncoder();
const decoder = new TextDecoder();
const HKDF_INFO = encoder.encode("SecureChat-AES-v1");
const hasWindow = typeof window !== "undefined";
const hasBuffer = typeof Buffer !== "undefined";

// Check if Web Crypto API is available
function checkCryptoSupport() {
  if (!hasWindow) {
    throw new Error("Web Crypto API requires a browser environment");
  }
  
  // Check for crypto API (try multiple browser prefixes)
  const crypto = window.crypto || window.msCrypto || (window.webkit && window.webkit.crypto);
  if (!crypto) {
    throw new Error("Web Crypto API not found. Please use a modern browser (Chrome, Firefox, Edge, Safari).");
  }
  
  // Check for subtle API (try standard and webkit prefix for older browsers)
  let subtle = crypto.subtle || crypto.webkitSubtle;
  
  // If still not available, check secure context
  if (!subtle) {
    // Check if we're in a secure context
    const isSecureContext = window.isSecureContext !== false;
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isLocalNetwork = /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(window.location.hostname);
    const isHTTPS = window.location.protocol === 'https:';
    
    // Mobile browsers sometimes allow local network IPs
    if (isLocalNetwork || isLocalhost || isHTTPS || isSecureContext) {
      // Try one more time - sometimes it's available but not immediately
      subtle = crypto.subtle || crypto.webkitSubtle;
    }
    
    if (!subtle) {
      // Provide helpful error message
      if (!isHTTPS && !isLocalhost && !isLocalNetwork) {
        throw new Error("Web Crypto API requires HTTPS or localhost. For mobile testing, use Chrome or Firefox which support local network IPs.");
      }
      throw new Error("Web Crypto API (crypto.subtle) is not available. Please use Chrome, Firefox, Edge, or Safari browser.");
    }
  }
  
  return subtle;
}

function encodeBinaryToBase64(binary) {
  if (hasWindow && typeof window.btoa === "function") return window.btoa(binary);
  if (hasBuffer) {
    return Buffer.from(binary, "binary").toString("base64");
  }
  throw new Error("Base64 encoder not available in this environment");
}

function decodeBase64ToBinary(b64) {
  if (hasWindow && typeof window.atob === "function") return window.atob(b64);
  if (hasBuffer) {
    return Buffer.from(b64, "base64").toString("binary");
  }
  throw new Error("Base64 decoder not available in this environment");
}

function bufferToBase64(buffer) {
  let binary = "";
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return encodeBinaryToBase64(binary);
}

function base64ToBuffer(b64) {
  const binary = decodeBase64ToBinary(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function normalizePayload(message) {
  if (typeof message === "string") {
    return encoder.encode(message);
  }
  if (message instanceof Uint8Array) return message;
  if (message instanceof ArrayBuffer) return new Uint8Array(message);
  if (ArrayBuffer.isView(message)) return new Uint8Array(message.buffer);
  throw new Error("Unsupported payload format");
}

async function deriveAesKey(sharedSecret) {
  const subtle = checkCryptoSupport();
  const hkdfKey = await subtle.importKey("raw", sharedSecret, "HKDF", false, ["deriveKey"]);
  return subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(0),
      info: HKDF_INFO
    },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

async function importPublicKey(raw) {
  const subtle = checkCryptoSupport();
  return subtle.importKey(
    "raw",
    raw,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
}

async function importPrivateKey(pkcs8) {
  const subtle = checkCryptoSupport();
  return subtle.importKey(
    "pkcs8",
    pkcs8,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveBits"]
  );
}

async function exportRawKey(key) {
  const subtle = checkCryptoSupport();
  return new Uint8Array(await subtle.exportKey("raw", key));
}

async function exportPrivateKey(privateKey) {
  const subtle = checkCryptoSupport();
  return new Uint8Array(await subtle.exportKey("pkcs8", privateKey));
}

export async function generateIdentityKeyPair() {
  try {
    const subtle = checkCryptoSupport();
    const keyPair = await subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveKey", "deriveBits"]
    );

    return {
      publicKey: await exportRawKey(keyPair.publicKey),
      secretKey: await exportPrivateKey(keyPair.privateKey)
    };
  } catch (error) {
    console.error("Key generation error:", error);
    throw new Error(`Failed to generate identity keys: ${error.message}. Please ensure you're using HTTPS or localhost.`);
  }
}

export async function generatePreKeys(n = 5) {
  try {
    const subtle = checkCryptoSupport();
    const arr = [];
    for (let i = 0; i < n; i++) {
      const keyPair = await subtle.generateKey(
        { name: "ECDH", namedCurve: "P-256" },
        true,
        ["deriveKey", "deriveBits"]
      );
      arr.push({
        keyId: Date.now() + i,
        publicKey: await exportRawKey(keyPair.publicKey),
        secretKey: await exportPrivateKey(keyPair.privateKey)
      });
    }
    return arr;
  } catch (error) {
    console.error("PreKey generation error:", error);
    throw new Error(`Failed to generate prekeys: ${error.message}`);
  }
}

export async function encryptMessageBase64(recipientPublicKeyB64, message) {
  try {
    const subtle = checkCryptoSupport();
    const recipientKey = await importPublicKey(base64ToBuffer(recipientPublicKeyB64));
    const ephKeyPair = await subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveKey", "deriveBits"]
    );

    const sharedSecret = await subtle.deriveBits(
      {
        name: "ECDH",
        public: recipientKey
      },
      ephKeyPair.privateKey,
      256
    );

    const aesKey = await deriveAesKey(sharedSecret);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const payload = normalizePayload(message);

    const cipher = await subtle.encrypt(
      { name: "AES-GCM", iv },
      aesKey,
      payload
    );

    return {
      cipherBase64: bufferToBase64(new Uint8Array(cipher)),
      nonceBase64: bufferToBase64(iv),
      ephemeralPublicKeyBase64: bufferToBase64(await exportRawKey(ephKeyPair.publicKey))
    };
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error(`Failed to encrypt message: ${error.message}`);
  }
}

export async function decryptMessageBase64(msg, options = {}) {
  const { asString = true } = options;

  try {
    const subtle = checkCryptoSupport();
    const sec = localStorage.getItem("identitySecretKey");
    if (!sec) return asString ? "[no-secret-key]" : null;

    const secretKey = await importPrivateKey(base64ToBuffer(sec));
    const ephPub = await importPublicKey(base64ToBuffer(msg.ephemeralPublicKey));

    const encrypted = base64ToBuffer(msg.encryptedContent || msg.cipherBase64);
    const nonce = base64ToBuffer(msg.nonce);

    const sharedSecret = await subtle.deriveBits(
      { name: "ECDH", public: ephPub },
      secretKey,
      256
    );

    const aesKey = await deriveAesKey(sharedSecret);
    const plain = await subtle.decrypt(
      { name: "AES-GCM", iv: nonce },
      aesKey,
      encrypted
    );

    if (!asString) return new Uint8Array(plain);

    return decoder.decode(plain);
  } catch (err) {
    console.error("decrypt error", err);
    return asString ? "[decrypt-error]" : null;
  }
}

export async function generateAesKeyRaw() {
  try {
    const subtle = checkCryptoSupport();
    const key = await subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
    const raw = await subtle.exportKey("raw", key);
    return new Uint8Array(raw);
  } catch (error) {
    console.error("AES key generation error:", error);
    throw new Error(`Failed to generate AES key: ${error.message}`);
  }
}

export async function importAesKeyFromRaw(rawU8) {
  const subtle = checkCryptoSupport();
  return subtle.importKey("raw", rawU8, "AES-GCM", true, [
    "encrypt",
    "decrypt"
  ]);
}

export async function aesEncryptRaw(aesRawKey, fileBuffer) {
  try {
    const subtle = checkCryptoSupport();
    const key = await importAesKeyFromRaw(aesRawKey);
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const cipher = await subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      fileBuffer
    );

    return {
      cipherUint8: new Uint8Array(cipher),
      ivUint8: iv
    };
  } catch (error) {
    console.error("AES encryption error:", error);
    throw new Error(`Failed to encrypt file: ${error.message}`);
  }
}

export async function aesDecryptRaw(aesRawKey, iv, cipherU8) {
  try {
    const subtle = checkCryptoSupport();
    const key = await importAesKeyFromRaw(aesRawKey);

    const plain = await subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      cipherU8
    );

    return new Uint8Array(plain);
  } catch (error) {
    console.error("AES decryption error:", error);
    throw new Error(`Failed to decrypt file: ${error.message}`);
  }
}

export function uint8ToBase64String(u8) {
  return bufferToBase64(u8);
}

export function base64ToUint8Array(b64) {
  return base64ToBuffer(b64);
}

export const encodeBase64 = uint8ToBase64String;
export const decodeBase64 = base64ToUint8Array;
