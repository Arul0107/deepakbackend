// backend/controllers/studentController.js
const db = require('../config/db');

// ==================== GET ALL STUDENTS (with user-based filtering) ====================
const getStudents = async (req, res) => {
  try {
    const loggedInUser = req.user;
    console.log('👤 Logged in user:', loggedInUser);

    let query = 'SELECT * FROM students';
    let queryParams = [];

    if (loggedInUser.role === 'super_admin' || loggedInUser.role === 'admin') {
      console.log('👑 Admin/Super Admin - showing all students');
      query += ' ORDER BY created_at DESC';
    } else if (loggedInUser.role === 'manager') {
      console.log('📊 Manager - showing all students');
      query += ' ORDER BY created_at DESC';
    } else if (loggedInUser.role === 'telecaller' || loggedInUser.role === 'counselor' || loggedInUser.role === 'staff') {
      console.log('📞 Telecaller/Counselor - showing only assigned students');
      query += ' WHERE assignedTo = ? ORDER BY created_at DESC';
      queryParams.push(loggedInUser.name);
    } else {
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
    res.status(500).json({ success: false, message: 'Error fetching students', error: error.message });
  }
};

// ==================== GET SINGLE STUDENT BY ID ====================
const getStudentById = async (req, res) => {
  try {
    const { id } = req.params;
    const loggedInUser = req.user;

    let query = 'SELECT * FROM students WHERE id = ?';
    let queryParams = [id];

    if (loggedInUser.role === 'telecaller' || loggedInUser.role === 'counselor' || loggedInUser.role === 'staff') {
      query += ' AND assignedTo = ?';
      queryParams.push(loggedInUser.name);
    }

    const [rows] = await db.query(query, queryParams);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found or access denied' });
    }

    res.status(200).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('❌ Error fetching student:', error);
    res.status(500).json({ success: false, message: 'Error fetching student', error: error.message });
  }
};

// ==================== CREATE NEW STUDENT ====================
const createStudent = async (req, res) => {
  try {
    const loggedInUser = req.user;

    // Allow admin, manager, telecaller, and counselor to create students
    if (loggedInUser.role !== 'admin' && loggedInUser.role !== 'manager' && 
        loggedInUser.role !== 'telecaller' && loggedInUser.role !== 'counselor') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Only admins, managers, telecallers, and counselors can create students.' 
      });
    }

    const {
      studentId, name, dateOfBirth, gender, mobile, whatsapp, email, address,
      tenth_percent, twelfth_percent, school_name, twelfth_group, entrance_score,
      preferredCollege1, preferredCollege2, preferredCollege3, preferredCollege4, preferredCollege5, course,
      quota, caste, community, income, is_rural, is_sports_quota,
      is_first_graduate, is_single_parent,
      lead_source, remarks,
      fathers_name, fathers_mobile, mothers_name, mothers_mobile,
      applicationDate, status, lastContacted, nextFollowUp,
      counselingDate, assignedTo, assignedDate, notes
    } = req.body;

    console.log('📥 Creating student with data:', req.body);

    // Required fields
    if (!studentId || !name || !mobile || !course) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
        required: ['studentId', 'name', 'mobile', 'course']
      });
    }

    // Email duplicate check
    if (email && email.trim() !== '') {
      const [emailCheck] = await db.query(
        'SELECT id FROM students WHERE email = ?',
        [email.trim()]
      );
      if (emailCheck.length > 0) {
        return res.status(400).json({ success: false, message: 'Email already exists' });
      }
    }

    // Check if studentId already exists
    const [idCheck] = await db.query('SELECT id FROM students WHERE studentId = ?', [studentId]);
    if (idCheck.length > 0) {
      return res.status(400).json({ success: false, message: 'Student ID already exists' });
    }

    // Check if mobile already exists
    const [mobileCheck] = await db.query('SELECT id FROM students WHERE mobile = ?', [mobile]);
    if (mobileCheck.length > 0) {
      return res.status(400).json({ success: false, message: 'Mobile number already exists' });
    }

    // Check if whatsapp already exists (if provided)
    if (whatsapp && whatsapp.trim() !== '') {
      const [whatsappCheck] = await db.query('SELECT id FROM students WHERE whatsapp = ?', [whatsapp]);
      if (whatsappCheck.length > 0) {
        return res.status(400).json({ success: false, message: 'WhatsApp number already exists' });
      }
    }

    const query = `
      INSERT INTO students (
        studentId, name, dateOfBirth, gender, mobile, whatsapp, email, address,
        tenth_percent, twelfth_percent, school_name, twelfth_group, entrance_score,
        preferredCollege1, preferredCollege2, preferredCollege3, preferredCollege4, preferredCollege5, course,
        quota, caste, community, income, is_rural, is_sports_quota,
        is_first_graduate, is_single_parent,
        lead_source, remarks,
        fathers_name, fathers_mobile, mothers_name, mothers_mobile,
        applicationDate, status, lastContacted, nextFollowUp,
        counselingDate, assignedTo, assignedDate, notes,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?,
        NOW(), NOW()
      )
    `;

    const values = [
      studentId, name, dateOfBirth || null, gender || null,
      mobile, whatsapp || null,
      (email && email.trim() !== '') ? email.trim() : null,
      address || null,
      tenth_percent || null, twelfth_percent || null, school_name || null, twelfth_group || null, entrance_score || null,
      preferredCollege1 || null, preferredCollege2 || null, preferredCollege3 || null, preferredCollege4 || null, preferredCollege5 || null, course,
      quota || 'General', caste || null, community || null, income || null,
      is_rural ? 1 : 0, is_sports_quota ? 1 : 0, is_first_graduate ? 1 : 0, is_single_parent ? 1 : 0,
      lead_source || 'Other', remarks || null,
      fathers_name || null, fathers_mobile || null, mothers_name || null, mothers_mobile || null,
      applicationDate || null, status || 'Active', lastContacted || null, nextFollowUp || null,
      counselingDate || null, assignedTo || null, assignedDate || null, notes || null
    ];

    const [result] = await db.query(query, values);
    const [newStudent] = await db.query('SELECT * FROM students WHERE id = ?', [result.insertId]);

    res.status(201).json({ success: true, message: 'Student created successfully', data: newStudent[0] });
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

    res.status(500).json({ success: false, message: 'Error creating student', error: error.message });
  }
};

// ==================== UPDATE STUDENT ====================
const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const loggedInUser = req.user;

    console.log('📝 Updating student:', id, 'with data:', updateData);
    console.log('👤 User role:', loggedInUser.role);

    let accessQuery = 'SELECT * FROM students WHERE id = ?';
    let accessParams = [id];

    if (loggedInUser.role === 'counselor' || loggedInUser.role === 'staff' || loggedInUser.role === 'telecaller') {
      accessQuery += ' AND assignedTo = ?';
      accessParams.push(loggedInUser.name);
    }

    const [existing] = await db.query(accessQuery, accessParams);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found or access denied' });
    }

    const currentStudent = existing[0];

    // Email duplicate check
    if (updateData.email && updateData.email.trim() !== '' && updateData.email.trim() !== currentStudent.email) {
      const [emailCheck] = await db.query(
        'SELECT id FROM students WHERE email = ? AND id != ?',
        [updateData.email.trim(), id]
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

    if (updateData.whatsapp && updateData.whatsapp.trim() !== '' && updateData.whatsapp !== currentStudent.whatsapp) {
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
      school_name: 'school_name', twelfth_group: 'twelfth_group',
      entrance_score: 'entrance_score', preferredCollege1: 'preferredCollege1',
      preferredCollege2: 'preferredCollege2', preferredCollege3: 'preferredCollege3',
      preferredCollege4: 'preferredCollege4', preferredCollege5: 'preferredCollege5',
      course: 'course', quota: 'quota',
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

        // Boolean fields
        if (['is_rural', 'is_sports_quota', 'is_first_graduate', 'is_single_parent'].includes(key)) {
          value = value ? 1 : 0;
        }
        // email: store null if blank
        else if (key === 'email') {
          value = (value && value.trim() !== '') ? value.trim() : null;
        }
        else {
          value = value || null;
        }

        fields.push(`${fieldMappings[key]} = ?`);
        values.push(value);
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

    res.status(200).json({ success: true, message: 'Student updated successfully', data: updatedStudent[0] });
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

    res.status(500).json({ success: false, message: 'Error updating student', error: error.message });
  }
};

// ==================== DELETE STUDENT ====================
const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const loggedInUser = req.user;

    if (loggedInUser.role !== 'admin' && loggedInUser.role !== 'manager') {
      return res.status(403).json({ success: false, message: 'Access denied. Only admins and managers can delete students.' });
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

// ==================== BULK IMPORT TEMPLATE ====================
const getBulkImportTemplate = async (req, res) => {
  try {
    const template = {
      headers: [
        "Student ID", "Name", "Mobile", "WhatsApp", "Email", "Course", "Address",
        "Father's Name", "Father's Mobile", "Mother's Name", "Mother's Mobile",
        "Date of Birth", "Gender", "10th %", "12th %", "School Name", "12th Group",
        "Entrance Score", "Quota", "Caste", "Community", "Income",
        "Rural", "Sports Quota", "First Graduate", "Single Parent",
        "Lead Source", "Remarks", "Application Date", "Last Contacted",
        "Next Follow-up", "Counseling Date", "Status",
        "Preferred College 1", "Preferred College 2", "Preferred College 3",
        "Preferred College 4", "Preferred College 5", "Assigned To", "Assigned Date", "Notes"
      ],
      sample: {
        "Student ID": "STU001",
        "Name": "John Doe",
        "Mobile": "9876543210",
        "WhatsApp": "9876543210",
        "Email": "john@example.com",
        "Course": "Computer Science",
        "Address": "123 Main Street, City",
        "Father's Name": "Robert Doe",
        "Father's Mobile": "9876543211",
        "Mother's Name": "Jane Doe",
        "Mother's Mobile": "9876543212",
        "Date of Birth": "2000-01-15",
        "Gender": "Male",
        "10th %": "85.5",
        "12th %": "78.2",
        "School Name": "ABC School",
        "12th Group": "Science",
        "Entrance Score": "120",
        "Quota": "General",
        "Caste": "OC",
        "Community": "",
        "Income": "500000",
        "Rural": "No",
        "Sports Quota": "No",
        "First Graduate": "No",
        "Single Parent": "No",
        "Lead Source": "Website",
        "Remarks": "Interested in engineering",
        "Application Date": "2024-01-15",
        "Last Contacted": "",
        "Next Follow-up": "2024-01-20",
        "Counseling Date": "",
        "Status": "Active",
        "Preferred College 1": "College A",
        "Preferred College 2": "College B",
        "Preferred College 3": "",
        "Preferred College 4": "",
        "Preferred College 5": "",
        "Assigned To": "",
        "Assigned Date": "",
        "Notes": ""
      },
      instructions: {
        required_fields: ["Name", "Mobile", "Course"],
        optional_fields: [
          "Student ID", "WhatsApp", "Email", "Address", "Father's Name", 
          "Father's Mobile", "Mother's Name", "Mother's Mobile", "Date of Birth", "Gender",
          "10th %", "12th %", "School Name", "12th Group", "Entrance Score", "Quota",
          "Caste", "Community", "Income", "Rural", "Sports Quota", "First Graduate",
          "Single Parent", "Lead Source", "Remarks", "Application Date", "Last Contacted",
          "Next Follow-up", "Counseling Date", "Status", "Preferred College 1", 
          "Preferred College 2", "Preferred College 3", "Preferred College 4", 
          "Preferred College 5", "Assigned To", "Assigned Date", "Notes"
        ],
        valid_values: {
          "Gender": ["Male", "Female", "Other"],
          "Quota": ["General", "SC", "ST", "OBC", "BC", "MBC", "EWS", "Management"],
          "Status": ["Active", "Inactive", "Follow-up", "Admitted", "Rejected", "Waitlisted"],
          "Rural": ["Yes", "No"],
          "Sports Quota": ["Yes", "No"],
          "First Graduate": ["Yes", "No"],
          "Single Parent": ["Yes", "No"]
        },
        notes: [
          "Student ID will be auto-generated if left blank",
          "Mobile numbers must be 10 digits",
          "Email must be in valid format (e.g., user@example.com)",
          "Use 'Yes' or 'No' for boolean fields",
          "Date format: YYYY-MM-DD",
          "Leave blank for optional fields",
          "Maximum file size: 10MB",
          "Supported formats: Excel (.xlsx, .xls) and CSV (.csv)"
        ]
      }
    };

    res.status(200).json({
      success: true,
      message: "Bulk import template",
      data: template
    });
  } catch (error) {
    console.error('❌ Error generating template:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error generating template', 
      error: error.message 
    });
  }
};

// ==================== BULK CREATE STUDENTS (Enhanced) ====================
const bulkCreateStudents = async (req, res) => {
  let connection;
  try {
    const loggedInUser = req.user;

    // Allow admin, manager, and telecaller to bulk import students
    if (loggedInUser.role !== 'admin' && loggedInUser.role !== 'manager' && loggedInUser.role !== 'telecaller') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Only admins, managers, and telecallers can bulk import students.' 
      });
    }

    const students = req.body;

    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide an array of students to import' 
      });
    }

    console.log(`📦 Bulk importing ${students.length} students by ${loggedInUser.name} (${loggedInUser.role})`);

    // Get connection for transaction
    connection = await db.getConnection();
    await connection.beginTransaction();

    const results = [];
    const errors = [];
    let successfulCount = 0;

    // Helper function to generate student ID if not provided
    const generateStudentId = (index) => {
      const prefix = 'STU';
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8).toUpperCase();
      return `${prefix}${timestamp}${random}${index}`;
    };

    // Helper function to validate email
    const isValidEmail = (email) => {
      if (!email || email.trim() === '') return true;
      const emailRegex = /^[^\s@]+@([^\s@]+\.)+[^\s@]+$/;
      return emailRegex.test(email);
    };

    // Helper function to validate phone number
    const isValidPhone = (phone) => {
      if (!phone || phone.trim() === '') return true;
      const phoneRegex = /^[0-9]{10}$/;
      return phoneRegex.test(phone.replace(/\D/g, ''));
    };

    // Process each student
    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      const rowNumber = i + 2;

      try {
        // Required field validation
        const missingFields = [];
        if (!student.name || student.name.trim() === '') missingFields.push('Name');
        if (!student.mobile || student.mobile.trim() === '') missingFields.push('Mobile');
        if (!student.course || student.course.trim() === '') missingFields.push('Course');

        if (missingFields.length > 0) {
          errors.push({
            row: rowNumber,
            error: `Missing required fields: ${missingFields.join(', ')}`,
            data: student
          });
          continue;
        }

        // Email validation
        const email = student.email && student.email.trim() !== '' ? student.email.trim() : null;
        if (email && !isValidEmail(email)) {
          errors.push({
            row: rowNumber,
            error: `Invalid email format: ${email}`,
            data: student
          });
          continue;
        }

        // Phone validation
        const mobile = student.mobile.trim();
        if (!isValidPhone(mobile)) {
          errors.push({
            row: rowNumber,
            error: `Invalid mobile number format: ${mobile}. Must be 10 digits.`,
            data: student
          });
          continue;
        }

        const whatsapp = student.whatsapp && student.whatsapp.trim() !== '' ? student.whatsapp.trim() : null;
        if (whatsapp && !isValidPhone(whatsapp)) {
          errors.push({
            row: rowNumber,
            error: `Invalid WhatsApp number format: ${whatsapp}. Must be 10 digits.`,
            data: student
          });
          continue;
        }

        // Check existing records in database
        const [existingMobile] = await connection.query(
          'SELECT id, name FROM students WHERE mobile = ?',
          [mobile]
        );
        
        if (existingMobile.length > 0) {
          errors.push({
            row: rowNumber,
            error: `Mobile number "${mobile}" already exists (Student: ${existingMobile[0].name})`,
            data: student
          });
          continue;
        }

        if (email) {
          const [existingEmail] = await connection.query(
            'SELECT id, name FROM students WHERE email = ?',
            [email]
          );
          
          if (existingEmail.length > 0) {
            errors.push({
              row: rowNumber,
              error: `Email "${email}" already exists (Student: ${existingEmail[0].name})`,
              data: student
            });
            continue;
          }
        }

        if (whatsapp) {
          const [existingWhatsapp] = await connection.query(
            'SELECT id, name FROM students WHERE whatsapp = ?',
            [whatsapp]
          );
          
          if (existingWhatsapp.length > 0) {
            errors.push({
              row: rowNumber,
              error: `WhatsApp number "${whatsapp}" already exists (Student: ${existingWhatsapp[0].name})`,
              data: student
            });
            continue;
          }
        }

        // Generate student ID if not provided
        let studentId = student.studentId && student.studentId.trim() !== '' ? student.studentId.trim() : null;
        
        if (studentId) {
          const [existingId] = await connection.query(
            'SELECT id FROM students WHERE studentId = ?',
            [studentId]
          );
          
          if (existingId.length > 0) {
            errors.push({
              row: rowNumber,
              error: `Student ID "${studentId}" already exists`,
              data: student
            });
            continue;
          }
        } else {
          studentId = generateStudentId(i);
        }

        // Prepare values
        const values = [
          studentId,
          student.name.trim(),
          mobile,
          whatsapp,
          email,
          student.course.trim(),
          student.address || null,
          student.fathers_name || null,
          student.fathers_mobile || null,
          student.mothers_name || null,
          student.mothers_mobile || null,
          student.dateOfBirth || null,
          student.gender || null,
          student.tenth_percent ? parseFloat(student.tenth_percent) : null,
          student.twelfth_percent ? parseFloat(student.twelfth_percent) : null,
          student.school_name || null,
          student.twelfth_group || null,
          student.entrance_score || null,
          student.quota || 'General',
          student.caste || null,
          student.community || null,
          student.income ? parseFloat(student.income) : null,
          student.is_rural === 'Yes' ? 1 : (student.is_rural ? 1 : 0),
          student.is_sports_quota === 'Yes' ? 1 : (student.is_sports_quota ? 1 : 0),
          student.is_first_graduate === 'Yes' ? 1 : (student.is_first_graduate ? 1 : 0),
          student.is_single_parent === 'Yes' ? 1 : (student.is_single_parent ? 1 : 0),
          student.lead_source || 'Bulk Import',
          student.remarks || null,
          student.applicationDate || new Date().toISOString().split('T')[0],
          student.lastContacted || null,
          student.nextFollowUp || null,
          student.counselingDate || null,
          student.status || 'Active',
          student.preferredCollege1 || null,
          student.preferredCollege2 || null,
          student.preferredCollege3 || null,
          student.preferredCollege4 || null,
          student.preferredCollege5 || null,
          student.assignedTo || null,
          student.assignedDate || null,
          student.notes || null
        ];

        // Insert student
        const [result] = await connection.query(
          `INSERT INTO students (
            studentId, name, mobile, whatsapp, email, course, address,
            fathers_name, fathers_mobile, mothers_name, mothers_mobile,
            dateOfBirth, gender,
            tenth_percent, twelfth_percent, school_name, twelfth_group, entrance_score,
            quota, caste, community, income,
            is_rural, is_sports_quota, is_first_graduate, is_single_parent,
            lead_source, remarks,
            applicationDate, lastContacted, nextFollowUp, counselingDate,
            status, preferredCollege1, preferredCollege2, preferredCollege3, preferredCollege4, preferredCollege5,
            assignedTo, assignedDate, notes,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          values
        );

        const [newStudent] = await connection.query(
          'SELECT * FROM students WHERE id = ?',
          [result.insertId]
        );
        
        results.push(newStudent[0]);
        successfulCount++;

        console.log(`✅ Imported student ${successfulCount}/${students.length}: ${student.name} (${mobile})`);

      } catch (error) {
        console.error(`❌ Error importing row ${rowNumber}:`, error.message);
        errors.push({
          row: rowNumber,
          error: error.message,
          sqlMessage: error.sqlMessage,
          data: student
        });
      }
    }

    // Commit transaction if we have successful imports
    if (successfulCount > 0) {
      await connection.commit();
      console.log(`✅ Bulk import completed: ${successfulCount} successful, ${errors.length} errors`);
    } else {
      await connection.rollback();
      console.log(`⚠️ Bulk import failed: No students were imported`);
    }

    // Return response
    res.status(201).json({
      success: successfulCount > 0,
      message: `Successfully created ${successfulCount} students`,
      data: results,
      errors: errors.length > 0 ? errors : undefined,
      summary: {
        total: students.length,
        successful: successfulCount,
        failed: errors.length,
        successRate: `${((successfulCount / students.length) * 100).toFixed(1)}%`
      }
    });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('❌ Error in bulk create:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error in bulk create operation', 
      error: error.message 
    });
  } finally {
    if (connection) connection.release();
  }
};

// ==================== BULK ASSIGN STUDENTS ====================
const bulkAssignStudents = async (req, res) => {
  try {
    const { studentIds, assignedTo, assignedDate, status } = req.body;
    const loggedInUser = req.user;

    if (loggedInUser.role !== 'admin' && loggedInUser.role !== 'manager') {
      return res.status(403).json({ success: false, message: 'Access denied. Only admins and managers can bulk assign students.' });
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
      SET assignedTo = ?, assignedDate = ?, status = ?, updated_at = NOW()
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
      data: { affectedRows: result.affectedRows, students: updatedStudents }
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

    if (loggedInUser.role === 'counselor' || loggedInUser.role === 'staff' || loggedInUser.role === 'telecaller') {
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

    if (loggedInUser.role === 'counselor' || loggedInUser.role === 'staff' || loggedInUser.role === 'telecaller') {
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
          OR course LIKE ? OR caste LIKE ? OR community LIKE ? OR assignedTo LIKE ? OR lead_source LIKE ?
          OR school_name LIKE ? OR twelfth_group LIKE ?)
    `;

    let queryParams = [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm,
      searchTerm, searchTerm, searchTerm, searchTerm, searchTerm,
      searchTerm, searchTerm];

    if (loggedInUser.role === 'telecaller' || loggedInUser.role === 'counselor' || loggedInUser.role === 'staff') {
      sqlQuery += ' AND assignedTo = ?';
      queryParams.push(loggedInUser.name);
    }

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
        SUM(CASE WHEN DATE(nextFollowUp) = CURDATE() THEN 1 ELSE 0 END) as today_followup,
        SUM(CASE WHEN DATE(nextFollowUp) < CURDATE() THEN 1 ELSE 0 END) as overdue_followup
      FROM students
    `;

    let queryParams = [];

    if (loggedInUser.role === 'counselor' || loggedInUser.role === 'staff' || loggedInUser.role === 'telecaller') {
      query += ' WHERE assignedTo = ?';
      queryParams.push(loggedInUser.name);
    }

    const [stats] = await db.query(query, queryParams);

    if (loggedInUser.role === 'admin' || loggedInUser.role === 'manager') {
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

    if (loggedInUser.role === 'counselor' || loggedInUser.role === 'staff' || loggedInUser.role === 'telecaller') {
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
    const { format = 'json' } = req.query;

    let query = 'SELECT * FROM students';
    let queryParams = [];

    if (loggedInUser.role === 'counselor' || loggedInUser.role === 'staff' || loggedInUser.role === 'telecaller') {
      query += ' WHERE assignedTo = ?';
      queryParams.push(loggedInUser.name);
    }

    query += ' ORDER BY created_at DESC';
    const [rows] = await db.query(query, queryParams);

    if (format === 'csv') {
      const headers = [
        'Student ID', 'Name', 'Mobile', 'WhatsApp', 'Email', 'Course', 'Address',
        'Father\'s Name', 'Father\'s Mobile', 'Mother\'s Name', 'Mother\'s Mobile',
        'Date of Birth', 'Gender', '10th %', '12th %', 'School Name', '12th Group',
        'Entrance Score', 'Quota', 'Caste', 'Community', 'Income',
        'Rural', 'Sports Quota', 'First Graduate', 'Single Parent',
        'Lead Source', 'Remarks', 'Application Date', 'Last Contacted',
        'Next Follow-up', 'Counseling Date', 'Status'
      ];

      const csvRows = [headers.join(',')];
      
      for (const student of rows) {
        const row = [
          `"${student.studentId || ''}"`,
          `"${(student.name || '').replace(/"/g, '""')}"`,
          `"${student.mobile || ''}"`,
          `"${student.whatsapp || ''}"`,
          `"${student.email || ''}"`,
          `"${student.course || ''}"`,
          `"${(student.address || '').replace(/"/g, '""')}"`,
          `"${student.fathers_name || ''}"`,
          `"${student.fathers_mobile || ''}"`,
          `"${student.mothers_name || ''}"`,
          `"${student.mothers_mobile || ''}"`,
          `"${student.dateOfBirth || ''}"`,
          `"${student.gender || ''}"`,
          `"${student.tenth_percent || ''}"`,
          `"${student.twelfth_percent || ''}"`,
          `"${(student.school_name || '').replace(/"/g, '""')}"`,
          `"${student.twelfth_group || ''}"`,
          `"${student.entrance_score || ''}"`,
          `"${student.quota || ''}"`,
          `"${student.caste || ''}"`,
          `"${student.community || ''}"`,
          `"${student.income || ''}"`,
          `"${student.is_rural ? 'Yes' : 'No'}"`,
          `"${student.is_sports_quota ? 'Yes' : 'No'}"`,
          `"${student.is_first_graduate ? 'Yes' : 'No'}"`,
          `"${student.is_single_parent ? 'Yes' : 'No'}"`,
          `"${student.lead_source || ''}"`,
          `"${(student.remarks || '').replace(/"/g, '""')}"`,
          `"${student.applicationDate || ''}"`,
          `"${student.lastContacted || ''}"`,
          `"${student.nextFollowUp || ''}"`,
          `"${student.counselingDate || ''}"`,
          `"${student.status || ''}"`
        ];
        csvRows.push(row.join(','));
      }

      const csv = csvRows.join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=students_export_${new Date().toISOString().split('T')[0]}.csv`);
      return res.send(csv);
    } else {
      res.status(200).json({ success: true, count: rows.length, data: rows });
    }
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
  exportStudents,
  getBulkImportTemplate
};