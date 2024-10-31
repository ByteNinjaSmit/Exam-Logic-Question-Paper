// src/socket.js
import { io } from "socket.io-client";

const socket = io(process.env.REACT_APP_BACKEND_URL || "http://localhost:5000", {
    withCredentials: true,
});

export default socket;