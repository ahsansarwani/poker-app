import { io } from "socket.io-client";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:4300";
const TOKEN_KEY = "holdem-session";

// Per-tab session token (sessionStorage survives refreshes but not new tabs), so the server can
// give a reconnecting player their seat back. Falls back to a throwaway token if storage is blocked.
function sessionToken() {
  const fresh = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  try {
    let token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) {
      token = fresh();
      sessionStorage.setItem(TOKEN_KEY, token);
    }
    return token;
  } catch {
    return fresh();
  }
}

export const socket = io(SERVER_URL, { autoConnect: false, auth: { token: sessionToken() } });
