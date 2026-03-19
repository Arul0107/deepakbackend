// backend/controllers/notificationController.js
const db = require('../config/db');

// Optional: WebSocket integration
let sendNotificationToUser = null;
try {
  const ws = require('../websocket');
  sendNotificationToUser = ws.sendNotificationToUser;
} catch (error) {
  console.log('WebSocket not configured, notifications will work without real-time updates');
  sendNotificationToUser = () => {}; // No-op function
}

// Get user notifications
exports.getNotifications = async (req, res) => {
  try {
    const { userId, limit = 50, offset = 0 } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }

    console.log(`Fetching notifications for userId: ${userId}`);

    const [notifications] = await db.query(
      `SELECT * FROM notifications 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [userId, parseInt(limit), parseInt(offset)]
    );

    const [countResult] = await db.query(
      'SELECT COUNT(*) as total FROM notifications WHERE user_id = ?',
      [userId]
    );

    console.log(`Found ${notifications.length} notifications for user ${userId}`);

    res.json({
      success: true,
      data: notifications,
      pagination: {
        total: countResult[0]?.total || 0,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error.message
    });
  }
};

// Mark notification as read
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.query(
      'UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
      error: error.message
    });
  }
};

// Mark all notifications as read
exports.markAllAsRead = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }

    await db.query(
      'UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE user_id = ? AND is_read = FALSE',
      [userId]
    );

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read',
      error: error.message
    });
  }
};

// Delete notification
exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.query('DELETE FROM notifications WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification',
      error: error.message
    });
  }
};

// Create notification (can be called from other controllers)
exports.createNotification = async (req, res) => {
  try {
    const {
      user_id,
      type,
      title,
      message,
      student_id,
      followup_id,
      note,
      actions = []
    } = req.body;

    console.log('Creating notification:', { user_id, type, title });

    if (!user_id || !type || !title || !message) {
      return res.status(400).json({
        success: false,
        message: 'user_id, type, title, and message are required'
      });
    }

    const [result] = await db.query(
      `INSERT INTO notifications 
       (user_id, type, title, message, student_id, followup_id, note, actions, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [user_id, type, title, message, student_id || null, followup_id || null, note || null, JSON.stringify(actions)]
    );

    const [newNotification] = await db.query(
      'SELECT * FROM notifications WHERE id = ?',
      [result.insertId]
    );

    console.log('Notification created successfully with ID:', result.insertId);

    // Send real-time notification via WebSocket if available
    if (sendNotificationToUser) {
      sendNotificationToUser(user_id, newNotification[0]);
    }

    // If this is an HTTP request, send response
    if (res) {
      res.status(201).json({
        success: true,
        message: 'Notification created successfully',
        data: newNotification[0]
      });
    }

    return newNotification[0];
  } catch (error) {
    console.error('Error creating notification:', error);
    if (res) {
      res.status(500).json({
        success: false,
        message: 'Failed to create notification',
        error: error.message
      });
    }
    throw error;
  }
};