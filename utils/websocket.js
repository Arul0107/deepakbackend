// backend/utils/websocket.js
const db = require('../config/db');

// These functions will be available globally from server.js
// This file provides a convenient wrapper

async function sendNotification(userId, notification) {
  if (global.sendNotificationToUser) {
    return global.sendNotificationToUser(userId, notification);
  }
  console.error('WebSocket not initialized');
  return false;
}

async function broadcast(notification) {
  if (global.broadcastNotification) {
    return global.broadcastNotification(notification);
  }
  console.error('WebSocket not initialized');
  return false;
}

async function createNotification(data) {
  if (global.createAndSendNotification) {
    return global.createAndSendNotification(data);
  }
  console.error('WebSocket not initialized');
  return false;
}

module.exports = {
  sendNotification,
  broadcast,
  createNotification
};