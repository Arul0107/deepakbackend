// backend/controllers/studentController.js
const db = require('../config/db');

// ==================== GET ALL STUDENTS (with user-based filtering) ====================
const getStudents = async (req, res) => {
  try {
    // Get the logged-in user from the request (set by auth middleware)
    const loggedInUser = req.user;
    
    console.log('👤 Logged in user:', loggedInUser);

    let query = 'SELECT * FROM students';
    let queryParams = [];

    // Apply role-based filtering
    if (loggedInUser.role === 'super_admin' || loggedInUser.role === 'admin') {
      // Super Admin and Admin can see all students
      console.log('👑 Admin/Super Admin - showing all students');
      query += ' ORDER BY created_at DESC';
    } 
    else if (loggedInUser.role === 'manager') {
      // Managers can see all students as well (based on your users table)
      console.log('📊 Manager - showing all students');
      query += ' ORDER BY created_at DESC';
    }
    else if (loggedInUser.role === 'telecaller' || loggedInUser.role === 'counselor' || loggedInUser.role === 'staff') {
      // Telecallers and counselors can only see students assigned to them
      console.log('📞 Telecaller/Counselor - showing only assigned students');
      query += ' WHERE assignedTo = ? ORDER BY created_at DESC';
      queryParams.push(loggedInUser.name);
    }
    else {
      // Other roles - show nothing
      console.log('👤 Other role - showing no students');
      query += ' WHERE 1=0 ORDER BY created_at DESC';
    }

    const [rows] = await db.query(query, queryParams);
    
    res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
      user: {
        id: loggedInUser.id,
        name: loggedInUser.name,
        email: loggedInUser.email,
        role: loggedInUser.role
      }
    });
  } catch (error) {
    console.error('❌ Error fetching students:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching students',
      error: error.message
    });
  }
};

// ==================== GET SINGLE STUDENT BY ID ====================
const getStudentById = async (req, res) => {
  try {
    const { id } = req.params;
    const loggedInUser = req.user;
    
    let query = 'SELECT * FROM students WHERE id = ?';
    let queryParams = [id];

    // Apply role-based filtering
    if (loggedInUser.role === 'telecaller' || loggedInUser.role === 'counselor' || loggedInUser.role === 'staff') {
      query += ' AND assignedTo = ?';
      queryParams.push(loggedInUser.name);
    }
    // Super Admin, Admin, and Manager can access any student without additional filters

    const [rows] = await db.query(query, queryParams);
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found or access denied'
      });
    }
    
    res.status(200).json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('❌ Error fetching student:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching student',
      error: error.message
    });
  }
};  

// ==================== CREATE NEW STUDENT ====================
const createStudent = async (req, res) => {
  try {
    const loggedInUser = req.user;
    
    // Only admin can create students
    if (loggedInUser.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only admins can create students.'
      });
    }

    const {
      studentId, name, dateOfBirth, gender, mobile, whatsapp, email, address,
      tenth_percent, twelfth_percent, entrance_score,
      preferredCollege1, preferredCollege2, course,
      quota, caste, community, income, is_rural, is_sports_quota, 
      is_first_graduate, is_single_parent,
      lead_source, remarks,
      fathers_name, fathers_mobile, mothers_name, mothers_mobile,
      applicationDate, status, lastContacted, nextFollowUp, 
      counselingDate, assignedTo, assignedDate, notes
    } = req.body;

    console.log('📥 Creating student with data:', req.body);

    // Validation - Required fields
    if (!studentId || !name || !email || !mobile || !course) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
        required: ['studentId', 'name', 'email', 'mobile', 'course']
      });
    }

    // Check if email already exists
    const [emailCheck] = await db.query(
      'SELECT id FROM students WHERE email = ?', 
      [email]
    );
    
    if (emailCheck.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }

    // Check if studentId already exists
    const [idCheck] = await db.query(
      'SELECT id FROM students WHERE studentId = ?', 
      [studentId]
    );
    
    if (idCheck.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Student ID already exists'
      });
    }

    // Check if mobile already exists
    const [mobileCheck] = await db.query(
      'SELECT id FROM students WHERE mobile = ?', 
      [mobile]
    );
    
    if (mobileCheck.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number already exists'
      });
    }

    // Check if whatsapp already exists (if provided)
    if (whatsapp) {
      const [whatsappCheck] = await db.query(
        'SELECT id FROM students WHERE whatsapp = ?', 
        [whatsapp]
      );
      
      if (whatsappCheck.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'WhatsApp number already exists'
        });
      }
    }

    const query = `
      INSERT INTO students (
        studentId, name, dateOfBirth, gender, mobile, whatsapp, email, address,
        tenth_percent, twelfth_percent, entrance_score,
        preferredCollege1, preferredCollege2, course,
        quota, caste, community, income, is_rural, is_sports_quota, 
        is_first_graduate, is_single_parent,
        lead_source, remarks,
        fathers_name, fathers_mobile, mothers_name, mothers_mobile,
        applicationDate, status, lastContacted, nextFollowUp, 
        counselingDate, assignedTo, assignedDate, notes,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?,
        NOW(), NOW()
      )
    `;

    const values = [
      studentId, name, dateOfBirth || null, gender || null, 
      mobile, whatsapp || null, email, address || null,
      tenth_percent || null, twelfth_percent || null, entrance_score || null,
      preferredCollege1 || null, preferredCollege2 || null, course,
      quota || 'General', caste || null, community || null, income || null, 
      is_rural ? 1 : 0, is_sports_quota ? 1 : 0, is_first_graduate ? 1 : 0, is_single_parent ? 1 : 0,
      lead_source || 'Other', remarks || null,
      fathers_name || null, fathers_mobile || null, mothers_name || null, mothers_mobile || null,
      applicationDate || null, status || 'Active', lastContacted || null, nextFollowUp || null,
      counselingDate || null, assignedTo || null, assignedDate || null, notes || null
    ];

    const [result] = await db.query(query, values);
    const [newStudent] = await db.query('SELECT * FROM students WHERE id = ?', [result.insertId]);

    res.status(201).json({
      success: true,
      message: 'Student created successfully',
      data: newStudent[0]
    });
  } catch (error) {
    console.error('❌ Error creating student:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      if (error.sqlMessage.includes('email')) {
        return res.status(400).json({ success: false, message: 'Email already exists' });
      }
      if (error.sqlMessage.includes('studentId')) {
        return res.status(400).json({ success: false, message: 'Student ID already exists' });
      }
      if (error.sqlMessage.includes('mobile')) {
        return res.status(400).json({ success: false, message: 'Mobile number already exists' });
      }
      if (error.sqlMessage.includes('whatsapp')) {
        return res.status(400).json({ success: false, message: 'WhatsApp number already exists' });
      }
    }
    
    res.status(500).json({
      success: false,
      message: 'Error creating student',
      error: error.message
    });
  }
};

// ==================== UPDATE STUDENT ====================
const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const loggedInUser = req.user;

    console.log('📝 Updating student:', id, 'with data:', updateData);

    // Check if student exists and user has access
    let accessQuery = 'SELECT * FROM students WHERE id = ?';
    let accessParams = [id];

    if (loggedInUser.role === 'counselor' || loggedInUser.role === 'staff') {
      accessQuery += ' AND assignedTo = ?';
      accessParams.push(loggedInUser.name);
    }

    const [existing] = await db.query(accessQuery, accessParams);
    
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found or access denied'
      });
    }

    const currentStudent = existing[0];

    // Only admin can update certain fields
    if (loggedInUser.role !== 'admin') {
      // Counselors can only update specific fields
      const allowedFields = ['status', 'lastContacted', 'nextFollowUp', 'notes', 'remarks'];
      const restrictedFields = Object.keys(updateData).filter(
        key => !allowedFields.includes(key) && key !== 'assignedTo'
      );
      
      if (restrictedFields.length > 0) {
        return res.status(403).json({
          success: false,
          message: 'Counselors can only update status, follow-up dates, notes, and remarks'
        });
      }
    }

    // Check for unique fields if they are being updated
    if (updateData.email && updateData.email !== currentStudent.email) {
      const [emailCheck] = await db.query(
        'SELECT id FROM students WHERE email = ? AND id != ?',
        [updateData.email, id]
      );
      if (emailCheck.length > 0) {
        return res.status(400).json({ success: false, message: 'Email already exists' });
      }
    }

    if (updateData.studentId && updateData.studentId !== currentStudent.studentId) {
      const [idCheck] = await db.query(
        'SELECT id FROM students WHERE studentId = ? AND id != ?',
        [updateData.studentId, id]
      );
      if (idCheck.length > 0) {
        return res.status(400).json({ success: false, message: 'Student ID already exists' });
      }
    }

    if (updateData.mobile && updateData.mobile !== currentStudent.mobile) {
      const [mobileCheck] = await db.query(
        'SELECT id FROM students WHERE mobile = ? AND id != ?',
        [updateData.mobile, id]
      );
      if (mobileCheck.length > 0) {
        return res.status(400).json({ success: false, message: 'Mobile number already exists' });
      }
    }

    if (updateData.whatsapp && updateData.whatsapp !== currentStudent.whatsapp) {
      const [whatsappCheck] = await db.query(
        'SELECT id FROM students WHERE whatsapp = ? AND id != ?',
        [updateData.whatsapp, id]
      );
      if (whatsappCheck.length > 0) {
        return res.status(400).json({ success: false, message: 'WhatsApp number already exists' });
      }
    }

    // Build dynamic update query
    const fields = [];
    const values = [];

    const fieldMappings = {
      studentId: 'studentId', name: 'name', dateOfBirth: 'dateOfBirth',
      gender: 'gender', mobile: 'mobile', whatsapp: 'whatsapp', email: 'email', address: 'address',
      tenth_percent: 'tenth_percent', twelfth_percent: 'twelfth_percent',
      entrance_score: 'entrance_score', preferredCollege1: 'preferredCollege1',
      preferredCollege2: 'preferredCollege2', course: 'course', quota: 'quota',
      caste: 'caste', community: 'community', income: 'income',
      is_rural: 'is_rural', is_sports_quota: 'is_sports_quota',
      is_first_graduate: 'is_first_graduate', is_single_parent: 'is_single_parent',
      lead_source: 'lead_source', remarks: 'remarks',
      fathers_name: 'fathers_name', fathers_mobile: 'fathers_mobile',
      mothers_name: 'mothers_name', mothers_mobile: 'mothers_mobile',
      applicationDate: 'applicationDate', status: 'status',
      lastContacted: 'lastContacted', nextFollowUp: 'nextFollowUp',
      counselingDate: 'counselingDate', assignedTo: 'assignedTo',
      assignedDate: 'assignedDate', notes: 'notes'
    };

    Object.keys(updateData).forEach(key => {
      if (fieldMappings[key] && updateData[key] !== undefined) {
        let value = updateData[key];
        if (['is_rural', 'is_sports_quota', 'is_first_graduate', 'is_single_parent'].includes(key)) {
          value = value ? 1 : 0;
        }
        fields.push(`${fieldMappings[key]} = ?`);
        values.push(value || null);
      }
    });

    fields.push('updated_at = NOW()');

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    const query = `UPDATE students SET ${fields.join(', ')} WHERE id = ?`;
    values.push(id);

    await db.query(query, values);

    const [updatedStudent] = await db.query('SELECT * FROM students WHERE id = ?', [id]);

    res.status(200).json({
      success: true,
      message: 'Student updated successfully',
      data: updatedStudent[0]
    });
  } catch (error) {
    console.error('❌ Error updating student:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      if (error.sqlMessage.includes('email')) {
        return res.status(400).json({ success: false, message: 'Email already exists' });
      }
      if (error.sqlMessage.includes('studentId')) {
        return res.status(400).json({ success: false, message: 'Student ID already exists' });
      }
      if (error.sqlMessage.includes('mobile')) {
        return res.status(400).json({ success: false, message: 'Mobile number already exists' });
      }
      if (error.sqlMessage.includes('whatsapp')) {
        return res.status(400).json({ success: false, message: 'WhatsApp number already exists' });
      }
    }
    
    res.status(500).json({
      success: false,
      message: 'Error updating student',
      error: error.message
    });
  }
};

// ==================== DELETE STUDENT ====================
const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const loggedInUser = req.user;

    // Only admin can delete students
    if (loggedInUser.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only admins can delete students.'
      });
    }

    const [existing] = await db.query('SELECT id FROM students WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    await db.query('DELETE FROM students WHERE id = ?', [id]);

    res.status(200).json({ success: true, message: 'Student deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting student:', error);
    res.status(500).json({ success: false, message: 'Error deleting student', error: error.message });
  }
};

// ==================== BULK CREATE STUDENTS ====================
const bulkCreateStudents = async (req, res) => {
  try {
    const loggedInUser = req.user;

    // Only admin can bulk create students
    if (loggedInUser.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only admins can bulk import students.'
      });
    }

    const students = req.body;
    
    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of students'
      });
    }

    console.log(`📦 Bulk importing ${students.length} students`);

    const results = [];
    const errors = [];

    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      
      try {
        if (!student.name || !student.mobile) {
          errors.push({ 
            row: i + 2, 
            error: `Missing required fields: ${!student.name ? 'Name' : ''} ${!student.mobile ? 'Mobile' : ''}`.trim(),
            data: student
          });
          continue;
        }

        const finalStudentId = student.studentId || `STU${Date.now()}-${Math.random().toString(36).substr(2, 5)}-${i}`;

        const [result] = await db.query(
          `INSERT INTO students (
            studentId, name, mobile, whatsapp, email, course, address,
            fathers_name, fathers_mobile, mothers_name, mothers_mobile,
            dateOfBirth, gender,
            tenth_percent, twelfth_percent, entrance_score,
            quota, caste, community, income,
            is_rural, is_sports_quota, is_first_graduate, is_single_parent,
            lead_source, remarks,
            applicationDate, lastContacted, nextFollowUp, counselingDate,
            status, preferredCollege1, preferredCollege2,
            assignedTo, assignedDate, notes,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            finalStudentId, student.name, student.mobile, student.whatsapp || null, student.email || null, 
            student.course || 'To be updated', student.address || null,
            student.fathers_name || null, student.fathers_mobile || null,
            student.mothers_name || null, student.mothers_mobile || null,
            student.dateOfBirth || null, student.gender || null,
            student.tenth_percent ? parseFloat(student.tenth_percent) : null,
            student.twelfth_percent ? parseFloat(student.twelfth_percent) : null,
            student.entrance_score || null,
            student.quota || 'General', student.caste || null, student.community || null,
            student.income ? parseFloat(student.income) : null,
            student.is_rural ? 1 : 0, student.is_sports_quota ? 1 : 0,
            student.is_first_graduate ? 1 : 0, student.is_single_parent ? 1 : 0,
            student.lead_source || 'Excel Import', student.remarks || null,
            student.applicationDate || new Date().toISOString().split('T')[0],
            student.lastContacted || null, student.nextFollowUp || null,
            student.counselingDate || null,
            student.status || 'Active',
            student.preferredCollege1 || null, student.preferredCollege2 || null,
            student.assignedTo || null, student.assignedDate || null,
            student.notes || null
          ]
        );

        const [newStudent] = await db.query('SELECT * FROM students WHERE id = ?', [result.insertId]);
        results.push(newStudent[0]);

      } catch (error) {
        console.error(`❌ Error importing row ${i + 2}:`, error.message);
        errors.push({ 
          row: i + 2, 
          error: error.message,
          sqlMessage: error.sqlMessage,
          data: student
        });
      }
    }

    res.status(201).json({
      success: true,
      message: `Successfully created ${results.length} students`,
      data: results,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('❌ Error in bulk create:', error);
    res.status(500).json({ success: false, message: 'Error in bulk create operation', error: error.message });
  }
};

// ==================== BULK ASSIGN STUDENTS ====================
const bulkAssignStudents = async (req, res) => {
  try {
    const { studentIds, assignedTo, assignedDate, status } = req.body;
    const loggedInUser = req.user;

    // Only admin can bulk assign students
    if (loggedInUser.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only admins can bulk assign students.'
      });
    }
    
    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide an array of student IDs' });
    }

    if (!assignedTo) {
      return res.status(400).json({ success: false, message: 'Please provide assignedTo value' });
    }

    console.log(`📦 Bulk assigning ${studentIds.length} students to ${assignedTo}`);

    const placeholders = studentIds.map(() => '?').join(',');
    
    const query = `
      UPDATE students 
      SET 
        assignedTo = ?,
        assignedDate = ?,
        status = ?,
        updated_at = NOW()
      WHERE id IN (${placeholders})
    `;

    const values = [
      assignedTo,
      assignedDate || new Date().toISOString().split('T')[0],
      status || 'Follow-up',
      ...studentIds
    ];

    const [result] = await db.query(query, values);

    const [updatedStudents] = await db.query(
      `SELECT * FROM students WHERE id IN (${placeholders})`,
      studentIds
    );

    res.status(200).json({
      success: true,
      message: `Successfully assigned ${result.affectedRows} students to ${assignedTo}`,
      data: {
        affectedRows: result.affectedRows,
        students: updatedStudents
      }
    });

  } catch (error) {
    console.error('❌ Error in bulk assign:', error);
    res.status(500).json({ success: false, message: 'Error in bulk assign operation', error: error.message });
  }
};

// ==================== GET STUDENTS BY STATUS ====================
const getStudentsByStatus = async (req, res) => {
  try {
    const { status } = req.params;
    const loggedInUser = req.user;
    
    let query = 'SELECT * FROM students WHERE status = ?';
    let queryParams = [status];

    if (loggedInUser.role === 'counselor' || loggedInUser.role === 'staff') {
      query += ' AND assignedTo = ?';
      queryParams.push(loggedInUser.name);
    }
    
    query += ' ORDER BY created_at DESC';

    const [rows] = await db.query(query, queryParams);
    
    res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error('❌ Error fetching students by status:', error);
    res.status(500).json({ success: false, message: 'Error fetching students by status', error: error.message });
  }
};

// ==================== GET STUDENTS BY QUOTA ====================
const getStudentsByQuota = async (req, res) => {
  try {
    const { quota } = req.params;
    const loggedInUser = req.user;
    
    let query = 'SELECT * FROM students WHERE quota = ?';
    let queryParams = [quota];

    if (loggedInUser.role === 'counselor' || loggedInUser.role === 'staff') {
      query += ' AND assignedTo = ?';
      queryParams.push(loggedInUser.name);
    }
    
    query += ' ORDER BY created_at DESC';

    const [rows] = await db.query(query, queryParams);
    
    res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error('❌ Error fetching students by quota:', error);
    res.status(500).json({ success: false, message: 'Error fetching students by quota', error: error.message });
  }
};

// ==================== SEARCH STUDENTS ====================
const searchStudents = async (req, res) => {
  try {
    const { query } = req.query;
    const loggedInUser = req.user;
    
    if (!query) {
      return res.status(400).json({ success: false, message: 'Search query is required' });
    }

    const searchTerm = `%${query}%`;
    
    let sqlQuery = `
      SELECT * FROM students 
      WHERE (name LIKE ? OR email LIKE ? OR studentId LIKE ? OR mobile LIKE ? OR whatsapp LIKE ?
          OR course LIKE ? OR caste LIKE ? OR community LIKE ? OR assignedTo LIKE ? OR lead_source LIKE ?)
    `;
    
    let queryParams = [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm];

    // Apply role-based filtering
    if (loggedInUser.role === 'telecaller' || loggedInUser.role === 'counselor' || loggedInUser.role === 'staff') {
      sqlQuery += ' AND assignedTo = ?';
      queryParams.push(loggedInUser.name);
    }
    // Super Admin, Admin, and Manager can search all students
    
    sqlQuery += ' ORDER BY created_at DESC';

    const [rows] = await db.query(sqlQuery, queryParams);
    
    res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error('❌ Error searching students:', error);
    res.status(500).json({ success: false, message: 'Error searching students', error: error.message });
  }
};

// ==================== GET STUDENT STATISTICS ====================
const getStudentStats = async (req, res) => {
  try {
    const loggedInUser = req.user;
    
    let query = `
      SELECT 
        COUNT(*) as total_students,
        SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'Inactive' THEN 1 ELSE 0 END) as inactive,
        SUM(CASE WHEN status = 'Follow-up' THEN 1 ELSE 0 END) as follow_up,
        SUM(CASE WHEN status = 'Admitted' THEN 1 ELSE 0 END) as admitted,
        SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN status = 'Waitlisted' THEN 1 ELSE 0 END) as waitlisted,
        SUM(CASE WHEN is_rural = 1 THEN 1 ELSE 0 END) as rural_students,
        SUM(CASE WHEN is_sports_quota = 1 THEN 1 ELSE 0 END) as sports_quota,
        SUM(CASE WHEN is_first_graduate = 1 THEN 1 ELSE 0 END) as first_graduate,
        SUM(CASE WHEN is_single_parent = 1 THEN 1 ELSE 0 END) as single_parent,
        SUM(CASE WHEN DATE(nextFollowUp) = CURDATE() THEN 1 ELSE 0 END) as today_followup
      FROM students
    `;
    
    let queryParams = [];

    if (loggedInUser.role === 'counselor' || loggedInUser.role === 'staff') {
      query += ' WHERE assignedTo = ?';
      queryParams.push(loggedInUser.name);
    }

    const [stats] = await db.query(query, queryParams);
    
    // Add assigned/unassigned counts (only for admin)
    if (loggedInUser.role === 'admin') {
      const [counts] = await db.query(`
        SELECT 
          SUM(CASE WHEN assignedTo IS NOT NULL AND assignedTo != '' THEN 1 ELSE 0 END) as assigned,
          SUM(CASE WHEN assignedTo IS NULL OR assignedTo = '' THEN 1 ELSE 0 END) as unassigned
        FROM students
      `);
      
      stats[0].assigned = counts[0].assigned || 0;
      stats[0].unassigned = counts[0].unassigned || 0;
    }
    
    res.status(200).json({ success: true, data: stats[0] });
  } catch (error) {
    console.error('❌ Error fetching student stats:', error);
    res.status(500).json({ success: false, message: 'Error fetching student statistics', error: error.message });
  }
};

// ==================== GET TODAY'S FOLLOW-UPS ====================
const getTodayFollowUps = async (req, res) => {
  try {
    const loggedInUser = req.user;
    
    let query = `SELECT * FROM students WHERE DATE(nextFollowUp) = CURDATE()`;
    let queryParams = [];

    if (loggedInUser.role === 'counselor' || loggedInUser.role === 'staff') {
      query += ' AND assignedTo = ?';
      queryParams.push(loggedInUser.name);
    }
    
    query += ' ORDER BY nextFollowUp ASC';

    const [rows] = await db.query(query, queryParams);
    
    res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error('❌ Error fetching today follow-ups:', error);
    res.status(500).json({ success: false, message: 'Error fetching today follow-ups', error: error.message });
  }
};

// ==================== EXPORT STUDENTS ====================
const exportStudents = async (req, res) => {
  try {
    const loggedInUser = req.user;
    
    let query = 'SELECT * FROM students';
    let queryParams = [];

    if (loggedInUser.role === 'counselor' || loggedInUser.role === 'staff') {
      query += ' WHERE assignedTo = ?';
      queryParams.push(loggedInUser.name);
    }
    
    query += ' ORDER BY created_at DESC';

    const [rows] = await db.query(query, queryParams);
    
    res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error('❌ Error exporting students:', error);
    res.status(500).json({ success: false, message: 'Error exporting students', error: error.message });
  }
};

module.exports = {
  getStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
  bulkCreateStudents,
  bulkAssignStudents,
  getStudentsByStatus,
  getStudentsByQuota,
  searchStudents,
  getStudentStats,
  getTodayFollowUps,
  exportStudents
};