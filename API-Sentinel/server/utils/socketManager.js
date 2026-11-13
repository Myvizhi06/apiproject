/**
 * API Sentinel - Centralized Socket.IO Manager
 */

let ioInstance = null;

function setIO(io) {
  ioInstance = io;
}

function getIO() {
  return ioInstance;
}

function emitToUser(userId, event, payload) {
  if (ioInstance && userId) {
    ioInstance.to(`user_${userId}`).emit(event, payload);
  }
}

module.exports = {
  setIO,
  getIO,
  emitToUser,
};

