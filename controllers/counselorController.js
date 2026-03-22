// backend/controllers/counselorController.js
const db = require('../config/db');

// ── GET targets for all counselors (admin/manager) ──────────────────────────
const getAllTargets = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT ct.*, u.name AS counselor_name, u.role AS counselor_role
      FROM counselor_targets ct
      JOIN users u ON u.id = ct.counselor_id
      ORDER BY u.name ASC
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET targets for ONE counselor ───────────────────────────────────────────
const getTargetByCounselor = async (req, res) => {
  try {
    const { counselorId } = req.params;
    const [rows] = await db.query(
      'SELECT * FROM counselor_targets WHERE counselor_id = ?',
      [counselorId]
    );
    if (rows.length === 0) {
      // return defaults if not set yet
      return res.json({
        success: true,
        data: {
          counselor_id: parseInt(counselorId),
          weekly_calls: 50,
          daily_calls: 10,
          weekly_follow_ups: 30,
          weekly_admissions: 5,
        },
      });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── UPSERT targets for a counselor (admin/manager only) ─────────────────────
const upsertTarget = async (req, res) => {
  try {
    const loggedInUser = req.user;
    if (!['admin', 'super_admin', 'manager'].includes(loggedInUser.role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { counselorId } = req.params;
    const { weekly_calls, daily_calls, weekly_follow_ups, weekly_admissions } = req.body;

    await db.query(`
      INSERT INTO counselor_targets
        (counselor_id, weekly_calls, daily_calls, weekly_follow_ups, weekly_admissions, set_by)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        weekly_calls      = VALUES(weekly_calls),
        daily_calls       = VALUES(daily_calls),
        weekly_follow_ups = VALUES(weekly_follow_ups),
        weekly_admissions = VALUES(weekly_admissions),
        set_by            = VALUES(set_by),
        updated_at        = NOW()
    `, [
      counselorId,
      weekly_calls    ?? 50,
      daily_calls     ?? 10,
      weekly_follow_ups  ?? 30,
      weekly_admissions  ?? 5,
      loggedInUser.id,
    ]);

    const [updated] = await db.query(
      'SELECT * FROM counselor_targets WHERE counselor_id = ?', [counselorId]
    );
    res.json({ success: true, message: 'Targets saved', data: updated[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST a new call log ─────────────────────────────────────────────────────
const createCallLog = async (req, res) => {
  try {
    const loggedInUser = req.user;
    const {
      counselorId, studentId, studentDbId,
      callCount, callType, result, notes, callDate,
    } = req.body;

    // counselors can only log for themselves; admins can log for anyone
    const targetCounselorId = ['admin', 'super_admin', 'manager'].includes(loggedInUser.role)
      ? (counselorId || loggedInUser.id)
      : loggedInUser.id;

    const [ins] = await db.query(`
      INSERT INTO call_logs
        (counselor_id, counselor_name, student_id, student_db_id,
         call_count, call_type, result, notes, call_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      targetCounselorId,
      loggedInUser.name,
      studentId   || null,
      studentDbId || null,
      callCount   || 1,
      callType    || 'initial',
      result      || 'interested',
      notes       || null,
      callDate    ? new Date(callDate) : new Date(),
    ]);

    const [newLog] = await db.query('SELECT * FROM call_logs WHERE id = ?', [ins.insertId]);
    res.status(201).json({ success: true, data: newLog[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET call logs (admin sees all; counselor sees own) ──────────────────────
const getCallLogs = async (req, res) => {
  try {
    const loggedInUser = req.user;
    const { counselorId, from, to } = req.query;

    let sql = 'SELECT * FROM call_logs WHERE 1=1';
    const params = [];

    // role-based filter
    if (!['admin', 'super_admin', 'manager'].includes(loggedInUser.role)) {
      sql += ' AND counselor_id = ?';
      params.push(loggedInUser.id);
    } else if (counselorId) {
      sql += ' AND counselor_id = ?';
      params.push(counselorId);
    }

    if (from) { sql += ' AND call_date >= ?'; params.push(from); }
    if (to)   { sql += ' AND call_date <= ?'; params.push(to);   }

    sql += ' ORDER BY call_date DESC';

    const [rows] = await db.query(sql, params);

    // rename to camelCase for the frontend
    const logs = rows.map(r => ({
      id:            r.id,
      counselorId:   r.counselor_id,
      counselorName: r.counselor_name,
      studentId:     r.student_id,
      studentDbId:   r.student_db_id,
      callCount:     r.call_count,
      callType:      r.call_type,
      result:        r.result,
      notes:         r.notes,
      callDate:      r.call_date,
    }));

    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getAllTargets, getTargetByCounselor, upsertTarget, createCallLog, getCallLogs };