import { io } from "socket.io-client";
import { SOCKET_URL } from "../config/api";

let socket = null;

const connect = (token) => {
  if (socket && socket.connected) return socket;

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ["websocket"]
  });

  socket.on("connect", () => {
    console.log("socket connected", socket.id);
  });

  socket.on("connect_error", (err) => {
    console.error("socket connect error", err);
  });

  return socket;
};

const disconnect = () => {
  if (socket) socket.disconnect();
  socket = null;
};

const socketService = { connect, disconnect };
export default socketService;
