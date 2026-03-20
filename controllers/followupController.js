// backend/controllers/followupController.js
const db = require('../config/db');

// Helper function to create notification
const createNotification = async (notificationData) => {
  try {
    const {
      user_id,
      type,
      title,
      message,
      student_id,
      followup_id,
      note
    } = notificationData;

    const [result] = await db.query(
      `INSERT INTO notifications 
       (user_id, type, title, message, student_id, followup_id, note, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [user_id, type, title, message, student_id || null, followup_id || null, note || null]
    );

    console.log(`✅ Notification created for user ${user_id}`);
    return result.insertId;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
};

// Get all follow-up notes (with filters)
const getAllFollowUps = async (req, res) => {
  try {
    const loggedInUser = req.user;
    const { 
      student_id, 
      counselor, 
      from_date, 
      to_date,
      status,
      reminder_status,
      limit = 100,
      offset = 0,
      search
    } = req.query;

    let query = `
      SELECT 
        fn.*,
        s.name as student_name,
        s.mobile as student_mobile,
        s.email as student_email,
        s.course as student_course,
        s.status as student_status,
        s.assignedTo as assigned_counselor,
        s.applicationDate,
        s.lead_source
      FROM follow_up_notes fn
      LEFT JOIN students s ON fn.student_id = s.id
      WHERE 1=1
    `;
    
    const queryParams = [];

    // Apply filters
    if (student_id) {
      query += ' AND fn.student_id = ?';
      queryParams.push(student_id);
    }

    if (counselor && counselor !== 'all') {
      query += ' AND s.assignedTo = ?';
      queryParams.push(counselor);
    }

    if (status && status !== 'all') {
      query += ' AND s.status = ?';
      queryParams.push(status);
    }

    if (reminder_status === 'sent') {
      query += ' AND fn.reminder_sent = TRUE';
    } else if (reminder_status === 'pending') {
      query += ' AND (fn.reminder_sent = FALSE OR fn.reminder_sent IS NULL)';
    } else if (reminder_status === 'overdue') {
      query += ' AND fn.reminder_date < NOW() AND (fn.reminder_sent = FALSE OR fn.reminder_sent IS NULL)';
    } else if (reminder_status === 'today') {
      query += ' AND DATE(fn.reminder_date) = CURDATE()';
    } else if (reminder_status === 'upcoming') {
      query += ' AND DATE(fn.reminder_date) > CURDATE() AND DATE(fn.reminder_date) <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)';
    }

    if (from_date) {
      query += ' AND DATE(fn.created_at) >= ?';
      queryParams.push(from_date);
    }

    if (to_date) {
      query += ' AND DATE(fn.created_at) <= ?';
      queryParams.push(to_date);
    }

    if (search) {
      query += ' AND (s.name LIKE ? OR fn.note LIKE ? OR s.mobile LIKE ?)';
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }

    // Role-based filtering
    if (loggedInUser.role === 'counselor' || loggedInUser.role === 'staff' || loggedInUser.role === 'telecaller') {
      query += ' AND s.assignedTo = ?';
      queryParams.push(loggedInUser.name);
    }

    // Get total count before pagination
    const countQuery = query.replace(
      /SELECT.*?FROM/,
      'SELECT COUNT(*) as total FROM'
    ).replace(/LIMIT.*OFFSET.*$/, '');
    
    const [countResult] = await db.query(countQuery, queryParams);
    const total = countResult[0]?.total || 0;

    // Add ordering
    query += ' ORDER BY fn.created_at DESC';

    // Add pagination
    query += ' LIMIT ? OFFSET ?';
    queryParams.push(parseInt(limit), parseInt(offset));

    const [followups] = await db.query(query, queryParams);

    res.json({
      success: true,
      data: followups,
      pagination: {
        total: total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: total > (parseInt(offset) + followups.length)
      }
    });

  } catch (error) {
    console.error('❌ Error getting all follow-ups:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get follow-ups',
      error: error.message
    });
  }
};

// Get follow-up notes for a specific student
const getFollowUpNotes = async (req, res) => {
  try {
    const { studentId } = req.params;
    const loggedInUser = req.user;

    // Check if student exists and user has access
    let studentQuery = 'SELECT * FROM students WHERE id = ?';
    let studentParams = [studentId];

    if (loggedInUser.role === 'counselor' || loggedInUser.role === 'staff' || loggedInUser.role === 'telecaller') {
      studentQuery += ' AND assignedTo = ?';
      studentParams.push(loggedInUser.name);
    }

    const [students] = await db.query(studentQuery, studentParams);
    
    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found or access denied'
      });
    }

    const [notes] = await db.query(
      `SELECT * FROM follow_up_notes 
       WHERE student_id = ? 
       ORDER BY created_at DESC`,
      [studentId]
    );

    res.status(200).json({
      success: true,
      count: notes.length,
      data: notes
    });
  } catch (error) {
    console.error('❌ Error fetching follow-up notes:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching follow-up notes',
      error: error.message
    });
  }
};

// Create a new follow-up note
const createFollowUpNote = async (req, res) => {
  try {
    const { student_id, note, follow_up_date, reminder_date } = req.body;
    const loggedInUser = req.user;

    console.log('Creating follow-up note:', { student_id, note, follow_up_date, reminder_date });

    if (!student_id || !note) {
      return res.status(400).json({
        success: false,
        message: 'Student ID and note are required'
      });
    }

    // Check if student exists and user has access
    let studentQuery = 'SELECT * FROM students WHERE id = ?';
    let studentParams = [student_id];

    if (loggedInUser.role === 'counselor' || loggedInUser.role === 'staff' || loggedInUser.role === 'telecaller') {
      studentQuery += ' AND assignedTo = ?';
      studentParams.push(loggedInUser.name);
    }

    const [students] = await db.query(studentQuery, studentParams);
    
    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found or access denied'
      });
    }

    const student = students[0];
    console.log('Student found:', student.name, 'Assigned to:', student.assignedTo);

    const query = `
      INSERT INTO follow_up_notes (
        student_id, note, follow_up_date, reminder_date, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, NOW())
    `;

    const [result] = await db.query(query, [
      student_id,
      note,
      follow_up_date || null,
      reminder_date || null,
      loggedInUser.name || 'Unknown'
    ]);

    console.log('Follow-up note created with ID:', result.insertId);

    // Fetch the created note with student details
    const [newNote] = await db.query(
      `SELECT fn.*, s.name as student_name, s.mobile, s.email, s.course, s.assignedTo
       FROM follow_up_notes fn
       LEFT JOIN students s ON fn.student_id = s.id
       WHERE fn.id = ?`,
      [result.insertId]
    );

    // Update student's next follow-up date if provided
    if (follow_up_date) {
      await db.query(
        'UPDATE students SET nextFollowUp = ? WHERE id = ?',
        [follow_up_date, student_id]
      );
    }

    // If this is the first follow-up, update student status
    const [existingFollowups] = await db.query(
      'SELECT COUNT(*) as count FROM follow_up_notes WHERE student_id = ?',
      [student_id]
    );

    if (existingFollowups[0].count === 1) {
      await db.query(
        'UPDATE students SET status = ? WHERE id = ?',
        ['Follow-up', student_id]
      );
    }

    // 👇 CREATE NOTIFICATION FOR THE FOLLOW-UP
    try {
      // Get user_id from users table based on assignedTo name
      if (student.assignedTo) {
        const [users] = await db.query(
          'SELECT id FROM users WHERE name = ?',
          [student.assignedTo]
        );

        if (users.length > 0) {
          const userId = users[0].id;
          
          // Create follow-up notification
          await createNotification({
            user_id: userId,
            type: 'followup',
            title: '📝 New Follow-up Added',
            message: `Follow-up added for ${student.name}`,
            student_id: student_id,
            followup_id: result.insertId,
            note: note.substring(0, 100) + (note.length > 100 ? '...' : '')
          });

          // If reminder is set, create reminder notification
          if (reminder_date) {
            const reminderDate = new Date(reminder_date).toLocaleString();
            await createNotification({
              user_id: userId,
              type: 'reminder',
              title: '⏰ Reminder Set',
              message: `Reminder for ${student.name} on ${reminderDate}`,
              student_id: student_id,
              followup_id: result.insertId,
              note: `Follow-up reminder: ${note.substring(0, 50)}...`
            });
          }
        } else {
          console.log('User not found for name:', student.assignedTo);
        }
      }
    } catch (notifError) {
      console.error('Error creating notification:', notifError);
      // Don't fail the main request if notification fails
    }

    res.status(201).json({
      success: true,
      message: 'Follow-up note created successfully',
      data: newNote[0]
    });
  } catch (error) {
    console.error('❌ Error creating follow-up note:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating follow-up note',
      error: error.message
    });
  }
};

// Update a follow-up note
const updateFollowUpNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { note, follow_up_date, reminder_date } = req.body;
    const loggedInUser = req.user;

    // Check if note exists and user has access
    const [notes] = await db.query(
      `SELECT fn.*, s.assignedTo 
       FROM follow_up_notes fn
       JOIN students s ON fn.student_id = s.id
       WHERE fn.id = ?`,
      [id]
    );

    if (notes.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Note not found'
      });
    }

    const noteData = notes[0];

    // Check access
    if (loggedInUser.role === 'counselor' || loggedInUser.role === 'staff' || loggedInUser.role === 'telecaller') {
      if (noteData.assignedTo !== loggedInUser.name) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    const query = `
      UPDATE follow_up_notes 
      SET note = ?, follow_up_date = ?, reminder_date = ?, updated_at = NOW()
      WHERE id = ?
    `;

    await db.query(query, [note, follow_up_date, reminder_date, id]);

    // Fetch updated note
    const [updatedNote] = await db.query(
      `SELECT fn.*, s.name as student_name, s.mobile, s.email, s.course, s.assignedTo
       FROM follow_up_notes fn
       LEFT JOIN students s ON fn.student_id = s.id
       WHERE fn.id = ?`,
      [id]
    );

    // Update student's next follow-up date
    if (follow_up_date) {
      await db.query(
        'UPDATE students SET nextFollowUp = ? WHERE id = ?',
        [follow_up_date, noteData.student_id]
      );
    }

    res.status(200).json({
      success: true,
      message: 'Note updated successfully',
      data: updatedNote[0]
    });
  } catch (error) {
    console.error('❌ Error updating follow-up note:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating follow-up note',
      error: error.message
    });
  }
};

// Delete a follow-up note
const deleteFollowUpNote = async (req, res) => {
  try {
    const { id } = req.params;
    const loggedInUser = req.user;

    // Check if note exists and user has access
    const [notes] = await db.query(
      `SELECT fn.*, s.assignedTo 
       FROM follow_up_notes fn
       JOIN students s ON fn.student_id = s.id
       WHERE fn.id = ?`,
      [id]
    );

    if (notes.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Note not found'
      });
    }

    const noteData = notes[0];

    // Check access
    if (loggedInUser.role === 'counselor' || loggedInUser.role === 'staff' || loggedInUser.role === 'telecaller') {
      if (noteData.assignedTo !== loggedInUser.name) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    await db.query('DELETE FROM follow_up_notes WHERE id = ?', [id]);

    // Check if student has any remaining follow-ups
    const [remainingFollowups] = await db.query(
      'SELECT COUNT(*) as count FROM follow_up_notes WHERE student_id = ?',
      [noteData.student_id]
    );

    if (remainingFollowups[0].count === 0) {
      await db.query(
        'UPDATE students SET status = ? WHERE id = ?',
        ['Pending', noteData.student_id]
      );
    }

    res.status(200).json({
      success: true,
      message: 'Note deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error deleting follow-up note:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting follow-up note',
      error: error.message
    });
  }
};

// Get today's reminders
const getTodayReminders = async (req, res) => {
  try {
    const loggedInUser = req.user;

    let query = `
      SELECT 
        fn.*, 
        s.name as student_name, 
        s.mobile, 
        s.email, 
        s.course,
        s.assignedTo
      FROM follow_up_notes fn
      JOIN students s ON fn.student_id = s.id
      WHERE DATE(fn.reminder_date) = CURDATE()
      AND (fn.reminder_sent = FALSE OR fn.reminder_sent IS NULL)
    `;

    let params = [];

    if (loggedInUser.role === 'counselor' || loggedInUser.role === 'staff' || loggedInUser.role === 'telecaller') {
      query += ' AND s.assignedTo = ?';
      params.push(loggedInUser.name);
    }

    query += ' ORDER BY fn.reminder_date ASC';

    const [reminders] = await db.query(query, params);

    // Also get follow-ups without reminders but follow_up_date is today
    let followupQuery = `
      SELECT 
        fn.*, 
        s.name as student_name, 
        s.mobile, 
        s.email, 
        s.course,
        s.assignedTo
      FROM follow_up_notes fn
      JOIN students s ON fn.student_id = s.id
      WHERE DATE(fn.follow_up_date) = CURDATE()
      AND fn.reminder_date IS NULL
    `;

    if (loggedInUser.role === 'counselor' || loggedInUser.role === 'staff' || loggedInUser.role === 'telecaller') {
      followupQuery += ' AND s.assignedTo = ?';
    }

    const [followups] = await db.query(followupQuery, 
      loggedInUser.role === 'counselor' || loggedInUser.role === 'staff' || loggedInUser.role === 'telecaller' ? [loggedInUser.name] : []
    );

    // Combine both results and remove duplicates
    const allReminders = [...reminders, ...followups];
    const uniqueReminders = Array.from(
      new Map(allReminders.map(item => [item.id, item])).values()
    );

    res.status(200).json({
      success: true,
      count: uniqueReminders.length,
      data: uniqueReminders
    });
  } catch (error) {
    console.error('❌ Error fetching today reminders:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching today reminders',
      error: error.message
    });
  }
};

// Get upcoming reminders (next 7 days)
const getUpcomingReminders = async (req, res) => {
  try {
    const loggedInUser = req.user;

    let query = `
      SELECT 
        fn.*, 
        s.name as student_name, 
        s.mobile, 
        s.email, 
        s.course,
        s.assignedTo
      FROM follow_up_notes fn
      JOIN students s ON fn.student_id = s.id
      WHERE DATE(fn.reminder_date) BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
      AND (fn.reminder_sent = FALSE OR fn.reminder_sent IS NULL)
    `;

    let params = [];

    if (loggedInUser.role === 'counselor' || loggedInUser.role === 'staff' || loggedInUser.role === 'telecaller') {
      query += ' AND s.assignedTo = ?';
      params.push(loggedInUser.name);
    }

    query += ' ORDER BY fn.reminder_date ASC';

    const [reminders] = await db.query(query, params);

    res.status(200).json({
      success: true,
      count: reminders.length,
      data: reminders
    });
  } catch (error) {
    console.error('❌ Error fetching upcoming reminders:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching upcoming reminders',
      error: error.message
    });
  }
};

// Get overdue reminders
const getOverdueReminders = async (req, res) => {
  try {
    const loggedInUser = req.user;

    let query = `
      SELECT 
        fn.*, 
        s.name as student_name, 
        s.mobile, 
        s.email, 
        s.course,
        s.assignedTo
      FROM follow_up_notes fn
      JOIN students s ON fn.student_id = s.id
      WHERE fn.reminder_date < NOW()
      AND (fn.reminder_sent = FALSE OR fn.reminder_sent IS NULL)
    `;

    let params = [];

    if (loggedInUser.role === 'counselor' || loggedInUser.role === 'staff' || loggedInUser.role === 'telecaller') {
      query += ' AND s.assignedTo = ?';
      params.push(loggedInUser.name);
    }

    query += ' ORDER BY fn.reminder_date ASC';

    const [reminders] = await db.query(query, params);

    res.status(200).json({
      success: true,
      count: reminders.length,
      data: reminders
    });
  } catch (error) {
    console.error('❌ Error fetching overdue reminders:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching overdue reminders',
      error: error.message
    });
  }
};

// Mark reminder as sent
// Mark reminder as sent
const markReminderSent = async (req, res) => {
  try {
    const { id } = req.params;
    const loggedInUser = req.user;

    console.log('Marking reminder as sent for ID:', id, 'User:', loggedInUser?.name);

    // First check if note exists
    const [notes] = await db.query(
      `SELECT fn.*, s.assignedTo, s.id as student_id, s.name as student_name
       FROM follow_up_notes fn
       JOIN students s ON fn.student_id = s.id
       WHERE fn.id = ?`,
      [id]
    );

    if (notes.length === 0) {
      console.log('Note not found with ID:', id);
      return res.status(404).json({
        success: false,
        message: 'Note not found'
      });
    }

    const noteData = notes[0];
    console.log('Found note for student:', noteData.student_name, 'Assigned to:', noteData.assignedTo);

    // Check access
    if (loggedInUser.role === 'counselor' || loggedInUser.role === 'staff' || loggedInUser.role === 'telecaller') {
      if (noteData.assignedTo !== loggedInUser.name) {
        console.log('Access denied - user:', loggedInUser.name, 'assigned to:', noteData.assignedTo);
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    // FIX: Remove reminder_sent_at column if it doesn't exist
    // Only update the reminder_sent flag
    await db.query(
      'UPDATE follow_up_notes SET reminder_sent = TRUE WHERE id = ?',
      [id]
    );

    console.log('Successfully marked reminder as sent for ID:', id);

    // Optionally, create a notification for this action
    try {
      // Get user_id from users table based on assignedTo name
      const [users] = await db.query(
        'SELECT id FROM users WHERE name = ?',
        [loggedInUser.name]
      );

      if (users.length > 0) {
        const userId = users[0].id;
        
        // Create notification
        await db.query(
          `INSERT INTO notifications 
           (user_id, type, title, message, student_id, followup_id, note, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            userId,
            'reminder_sent',
            '✅ Reminder Completed',
            `Reminder marked as sent for ${noteData.student_name}`,
            noteData.student_id,
            id,
            `Follow-up reminder completed`
          ]
        );
        console.log('Notification created for user:', userId);
      }
    } catch (notifError) {
      console.error('Error creating notification (non-critical):', notifError);
      // Don't fail the main request if notification fails
    }

    res.status(200).json({
      success: true,
      message: 'Reminder marked as sent successfully'
    });
  } catch (error) {
    console.error('❌ Error marking reminder as sent:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking reminder as sent',
      error: error.message
    });
  }
};

// Get follow-up statistics
const getFollowUpStats = async (req, res) => {
  try {
    const loggedInUser = req.user;

    let query = `
      SELECT 
        COUNT(*) as total_followups,
        SUM(CASE WHEN DATE(reminder_date) = CURDATE() THEN 1 ELSE 0 END) as today_reminders,
        SUM(CASE WHEN reminder_date < NOW() AND (reminder_sent = FALSE OR reminder_sent IS NULL) THEN 1 ELSE 0 END) as overdue_reminders,
        SUM(CASE WHEN reminder_date IS NOT NULL AND (reminder_sent = FALSE OR reminder_sent IS NULL) THEN 1 ELSE 0 END) as pending_reminders,
        COUNT(DISTINCT student_id) as students_with_followups,
        SUM(CASE WHEN reminder_sent = TRUE THEN 1 ELSE 0 END) as completed_reminders
      FROM follow_up_notes fn
      LEFT JOIN students s ON fn.student_id = s.id
      WHERE 1=1
    `;
    
    let params = [];

    if (loggedInUser.role === 'counselor' || loggedInUser.role === 'staff' || loggedInUser.role === 'telecaller') {
      query += ' AND s.assignedTo = ?';
      params.push(loggedInUser.name);
    }

    const [stats] = await db.query(query, params);

    // Get today's created follow-ups
    let todayCreatedQuery = `
      SELECT COUNT(*) as today_created
      FROM follow_up_notes fn
      LEFT JOIN students s ON fn.student_id = s.id
      WHERE DATE(fn.created_at) = CURDATE()
    `;

    if (loggedInUser.role === 'counselor' || loggedInUser.role === 'staff' || loggedInUser.role === 'telecaller') {
      todayCreatedQuery += ' AND s.assignedTo = ?';
    }

    const [todayCreated] = await db.query(todayCreatedQuery, 
      loggedInUser.role === 'counselor' || loggedInUser.role === 'staff' || loggedInUser.role === 'telecaller' ? [loggedInUser.name] : []
    );

    res.json({
      success: true,
      data: {
        ...stats[0],
        today_created: todayCreated[0]?.today_created || 0
      }
    });

  } catch (error) {
    console.error('❌ Error getting follow-up statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get follow-up statistics',
      error: error.message
    });
  }
};

// Get follow-up notes by counselor
const getFollowUpsByCounselor = async (req, res) => {
  try {
    const { counselorName } = req.params;
    const loggedInUser = req.user;

    // Check access
    if (loggedInUser.role !== 'super_admin' && loggedInUser.role !== 'admin' && loggedInUser.role !== 'manager') {
      if (loggedInUser.name !== counselorName) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    const [followups] = await db.query(
      `SELECT 
        fn.*,
        s.name as student_name,
        s.mobile,
        s.email,
        s.course,
        s.status as student_status
      FROM follow_up_notes fn
      JOIN students s ON fn.student_id = s.id
      WHERE s.assignedTo = ?
      ORDER BY fn.created_at DESC`,
      [counselorName]
    );

    res.json({
      success: true,
      count: followups.length,
      data: followups
    });

  } catch (error) {
    console.error('❌ Error getting follow-ups by counselor:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get follow-ups by counselor',
      error: error.message
    });
  }
};

module.exports = {
  getAllFollowUps,
  getFollowUpNotes,
  createFollowUpNote,
  updateFollowUpNote,
  deleteFollowUpNote,
  getTodayReminders,
  getUpcomingReminders,
  getOverdueReminders,
  markReminderSent,
  getFollowUpStats,
  getFollowUpsByCounselor
};