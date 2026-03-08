// controllers/bookingController.js
const db = require("../config/db");
const { uploadImage } = require("../helpers/uploadHelper");

const createBooking = async (req, res) => {
  const connection = await db.getConnection();

  try {
    // Parse the JSON data from the form field 'bookingData'
    let bookingData = req.body.bookingData;
    
    if (typeof bookingData === 'string') {
      bookingData = JSON.parse(bookingData);
    }

    // Extract data from parsed bookingData
    const {
      tourId,
      tourTitle,
      primaryTraveler,
      identityVerification,
      travelInfo,
      emergencyInfo,
      consent,
      travelers,
      paymentType,
      paidAmount,
      totalAmount,
      adultCount,
      childCount,
      check_in_date,
      check_out_date
    } = bookingData;

    console.log("=".repeat(50));
    console.log("CREATE BOOKING DEBUG");
    console.log(bookingData);

    // Handle file uploads
    const files = req.files || {};
    
    let passportCopyUrl = null;
    let visaCopyUrl = null;
    let idCopyUrl = null;
    let insuranceDocumentUrl = null;

    // Upload files to Supabase
    try {
      if (files.passportCopy && files.passportCopy[0]) {
        passportCopyUrl = await uploadImage(files.passportCopy[0]);
      }
      if (files.visaCopy && files.visaCopy[0]) {
        visaCopyUrl = await uploadImage(files.visaCopy[0]);
      }
      if (files.idCopy && files.idCopy[0]) {
        idCopyUrl = await uploadImage(files.idCopy[0]);
      }
      if (files.insuranceDocument && files.insuranceDocument[0]) {
        insuranceDocumentUrl = await uploadImage(files.insuranceDocument[0]);
      }
    } catch (uploadError) {
      console.error("File upload error:", uploadError);
      return res.status(400).json({
        success: false,
        message: "Error uploading files: " + uploadError.message
      });
    }

    // convert to backend variable names
    const checkIn = check_in_date;
    const checkOut = check_out_date;

    // ================= VALIDATION =================
    if (!tourId || !paymentType || !paidAmount) {
      return res.status(400).json({
        message: "tourId, paymentType and paidAmount are required"
      });
    }

    if (!primaryTraveler) {
      return res.status(400).json({
        message: "Primary traveler information is required"
      });
    }

    if (!checkIn || !checkOut) {
      return res.status(400).json({
        message: "Check-in and Check-out dates are required"
      });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized"
      });
    }

    const tourIdString = String(tourId).trim();

    // ================= START TRANSACTION =================
    await connection.beginTransaction();

    // ================= INSERT BOOKING =================
    const [result] = await connection.execute(
      `INSERT INTO bookings 
      (user_id, tour_id, tour_title, adult_count, child_count, 
       total_amount, payment_type, paid_amount, status,
       check_in, check_out,
       primary_traveler_name, primary_traveler_email, primary_traveler_mobile,
       primary_traveler_country_code, primary_traveler_nationality, primary_traveler_residence,
       identity_type, identity_details,
       arrival_date_india, departure_date_india, accommodation_preference,
       dietary_preference, dietary_details, language_preference,
       medical_conditions, physical_limitations,
       emergency_contact_name, emergency_contact_relationship, 
       emergency_contact_number, emergency_country_code,
       insurance_provider, insurance_policy_number, insurance_valid_until,
       travelling_without_insurance,
       consent_info_accurate, consent_rural_environment, consent_follow_guidelines,
       consent_terms, consent_emergency_medical, consent_photography)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        tourIdString,
        tourTitle || null,
        adultCount || 0,
        childCount || 0,
        totalAmount || 0,
        paymentType,
        paidAmount,
        "pending",
        checkIn,
        checkOut,
        // Primary Traveler
        primaryTraveler.fullName || null,
        primaryTraveler.email || null,
        primaryTraveler.mobile || null,
        primaryTraveler.countryCode || null,
        primaryTraveler.nationality || null,
        primaryTraveler.countryOfResidence || null,
        // Identity Verification
        identityVerification?.identityType || null,
        JSON.stringify({
          ...(primaryTraveler?.nationality === "India" 
            ? { idNumber: identityVerification?.idNumber }
            : { 
                passportNumber: identityVerification?.passportNumber,
                passportIssuingCountry: identityVerification?.passportIssuingCountry,
                passportExpiryDate: identityVerification?.passportExpiryDate,
                visaType: identityVerification?.visaType,
                visaNumber: identityVerification?.visaNumber,
                visaExpiryDate: identityVerification?.visaExpiryDate
              }
          )
        }),
        // Travel Information
        travelInfo?.arrivalDateInIndia || null,
        travelInfo?.departureDateFromIndia || null,
        travelInfo?.accommodationPreference || null,
        travelInfo?.dietaryPreference || null,
        travelInfo?.dietaryDetails || null,
        travelInfo?.languagePreference ? JSON.stringify(travelInfo.languagePreference) : null,
        travelInfo?.medicalConditions || null,
        travelInfo?.physicalLimitations || null,
        // Emergency Information
        emergencyInfo?.contactName || null,
        emergencyInfo?.relationship || null,
        emergencyInfo?.contactNumber || null,
        emergencyInfo?.contactCountryCode || null,
        emergencyInfo?.insuranceProvider || null,
        emergencyInfo?.policyNumber || null,
        emergencyInfo?.insuranceValidUntil || null,
        emergencyInfo?.travellingWithoutInsurance ? 1 : 0,
        // Consent
        consent?.infoAccurate ? 1 : 0,
        consent?.acknowledgeRuralEnvironment ? 1 : 0,
        consent?.agreeFollowGuidelines ? 1 : 0,
        consent?.acceptTerms ? 1 : 0,
        consent?.consentEmergencyMedical ? 1 : 0,
        consent?.consentPhotography ? 1 : 0
      ]
    );

    const bookingId = result.insertId;

    // ================= INSERT DOCUMENTS WITH URLs =================
    if (passportCopyUrl) {
      await connection.execute(
        `INSERT INTO booking_documents (booking_id, document_type, document_data, uploaded_at)
         VALUES (?, ?, ?, NOW())`,
        [bookingId, 'passport', passportCopyUrl]
      );
    }

    if (visaCopyUrl) {
      await connection.execute(
        `INSERT INTO booking_documents (booking_id, document_type, document_data, uploaded_at)
         VALUES (?, ?, ?, NOW())`,
        [bookingId, 'visa', visaCopyUrl]
      );
    }

    if (idCopyUrl) {
      await connection.execute(
        `INSERT INTO booking_documents (booking_id, document_type, document_data, uploaded_at)
         VALUES (?, ?, ?, NOW())`,
        [bookingId, 'id_proof', idCopyUrl]
      );
    }

    if (insuranceDocumentUrl) {
      await connection.execute(
        `INSERT INTO booking_documents (booking_id, document_type, document_data, uploaded_at)
         VALUES (?, ?, ?, NOW())`,
        [bookingId, 'insurance', insuranceDocumentUrl]
      );
    }

    // ================= PREPARE ADDITIONAL TRAVELERS =================
    const allTravelers = [
      ...(travelers?.adults || []).map(t => ({
        ...t,
        type: "adult",
        is_primary: 0
      })),
      ...(travelers?.children || []).map(t => ({
        ...t,
        type: "child",
        is_primary: 0
      }))
    ];

    // ================= INSERT ADDITIONAL TRAVELERS =================
    for (let t of allTravelers) {
      await connection.execute(
        `INSERT INTO booking_travelers
        (booking_id, type, name, age, aadhaar, is_primary)
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          bookingId,
          t.type,
          t.name || null,
          t.age || null,
          t.aadhaar || null,
          t.is_primary || 0
        ]
      );
    }

    // ================= COMMIT =================
    await connection.commit();
    connection.release();

    return res.status(201).json({
      success: true,
      message: "Booking created successfully",
      bookingId
    });

  } catch (err) {
    await connection.rollback();
    connection.release();

    console.error("CREATE BOOKING ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Server error while creating booking",
      error: err.message
    });
  }
};

// ================= GET MY BOOKINGS =================
const getMyBookings = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    // ================= GET BOOKINGS =================
    const [bookings] = await db.execute(
      `SELECT 
        id,
        tour_id,
        tour_title,
        adult_count,
        child_count,
        total_amount,
        payment_type,
        paid_amount,
        status,
        check_in,
        check_out,
        booking_date,
        created_at,
        primary_traveler_name,
        primary_traveler_email,
        primary_traveler_mobile,
        primary_traveler_nationality,
        identity_type,
        identity_details,
        arrival_date_india,
        departure_date_india,
        accommodation_preference,
        dietary_preference,
        dietary_details,
        language_preference,
        medical_conditions,
        physical_limitations,
        emergency_contact_name,
        emergency_contact_relationship,
        emergency_contact_number,
        insurance_provider,
        insurance_policy_number,
        insurance_valid_until,
        travelling_without_insurance,
        consent_info_accurate,
        consent_rural_environment,
        consent_follow_guidelines,
        consent_terms,
        consent_emergency_medical,
        consent_photography
      FROM bookings
      WHERE user_id = ?
      ORDER BY created_at DESC`,
      [userId]
    );

    if (bookings.length === 0) {
      return res.json({
        success: true,
        bookings: []
      });
    }

    // ================= GET ALL TRAVELERS =================
    const bookingIds = bookings.map(b => b.id);
    const [travs] = await db.execute(
      `SELECT booking_id, type, name, age, aadhaar, is_primary
       FROM booking_travelers
       WHERE booking_id IN (${bookingIds.map(() => "?").join(",")})`,
      bookingIds
    );

    // ================= GET DOCUMENTS =================
    const [docs] = await db.execute(
      `SELECT booking_id, document_type, uploaded_at
       FROM booking_documents
       WHERE booking_id IN (${bookingIds.map(() => "?").join(",")})`,
      bookingIds
    );

    // ================= PROCESS BOOKINGS =================
    const processedBookings = bookings.map(booking => {
      const relatedTravs = travs.filter(t => t.booking_id === booking.id);
      const relatedDocs = docs.filter(d => d.booking_id === booking.id);

      return {
        ...booking,
        tour_id: booking.tour_id ? String(booking.tour_id).trim() : null,
        identity_details: booking.identity_details ? JSON.parse(booking.identity_details) : null,
        language_preference: booking.language_preference ? JSON.parse(booking.language_preference) : null,
        travelers: {
          adults: relatedTravs.filter(t => t.type === "adult" && !t.is_primary),
          children: relatedTravs.filter(t => t.type === "child")
        },
        documents: relatedDocs
      };
    });

    return res.json({
      success: true,
      bookings: processedBookings
    });

  } catch (err) {
    console.error("GET MY BOOKINGS ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching bookings",
      error: err.message
    });
  }
};

// ================= GET ALL BOOKINGS (ADMIN) =================
// ================= GET ALL BOOKINGS (ADMIN) =================
const getAllBookings = async (req, res) => {
  try {
    const [bookings] = await db.execute(`
      SELECT 
        b.id,
        b.user_id,
        u.name AS user_name,
        u.email AS user_email,
        u.phone AS user_phone,
        b.tour_id,
        b.tour_title,
        b.adult_count,
        b.child_count,
        b.total_amount,
        b.payment_type,
        b.paid_amount,
        b.status,
        b.check_in,
        b.check_out,
        b.booking_date,
        b.created_at,
        b.updated_at,
        b.primary_traveler_name,
        b.primary_traveler_email,
        b.primary_traveler_mobile,
        b.primary_traveler_country_code,
        b.primary_traveler_nationality,
        b.primary_traveler_residence,
        b.identity_type,
        b.identity_details,
        b.arrival_date_india,
        b.departure_date_india,
        b.accommodation_preference,
        b.dietary_preference,
        b.dietary_details,
        b.language_preference,
        b.medical_conditions,
        b.physical_limitations,
        b.emergency_contact_name,
        b.emergency_contact_relationship,
        b.emergency_contact_number,
        b.emergency_country_code,
        b.insurance_provider,
        b.insurance_policy_number,
        b.insurance_valid_until,
        b.travelling_without_insurance,
        b.consent_info_accurate,
        b.consent_rural_environment,
        b.consent_follow_guidelines,
        b.consent_terms,
        b.consent_emergency_medical,
        b.consent_photography
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id
      ORDER BY b.created_at DESC
    `);

    const processedBookings = [];
    
    for (let booking of bookings) {
      // Get travelers for this booking
      const [travellers] = await db.execute(
        `SELECT type, name, age, aadhaar, is_primary
         FROM booking_travelers
         WHERE booking_id = ?`,
        [booking.id]
      );

      // Get documents for this booking
      const [documents] = await db.execute(
        `SELECT document_type, document_data, uploaded_at
         FROM booking_documents
         WHERE booking_id = ?`,
        [booking.id]
      );

      // Parse JSON fields
      let identityDetails = null;
      try {
        identityDetails = booking.identity_details ? JSON.parse(booking.identity_details) : null;
      } catch (e) {
        console.error("Error parsing identity_details:", e);
      }

      let languagePreference = null;
      try {
        languagePreference = booking.language_preference ? JSON.parse(booking.language_preference) : null;
      } catch (e) {
        console.error("Error parsing language_preference:", e);
      }

      const processedBooking = {
        id: booking.id,
        user_id: booking.user_id,
        user: {
          name: booking.user_name,
          email: booking.user_email,
          phone: booking.user_phone
        },
        tour_id: booking.tour_id ? String(booking.tour_id).trim() : null,
        tour_title: booking.tour_title,
        adult_count: booking.adult_count,
        child_count: booking.child_count,
        total_amount: booking.total_amount,
        payment_type: booking.payment_type,
        paid_amount: booking.paid_amount,
        status: booking.status,
        check_in: booking.check_in,
        check_out: booking.check_out,
        booking_date: booking.booking_date,
        created_at: booking.created_at,
        updated_at: booking.updated_at,
        
        // Primary Traveler
        primary_traveler: {
          name: booking.primary_traveler_name,
          email: booking.primary_traveler_email,
          mobile: booking.primary_traveler_mobile,
          countryCode: booking.primary_traveler_country_code,
          nationality: booking.primary_traveler_nationality,
          residence: booking.primary_traveler_residence
        },
        
        // Identity
        identity_type: booking.identity_type,
        identity_details: identityDetails,
        
        // Travel Info
        travel_info: {
          arrivalDate: booking.arrival_date_india,
          departureDate: booking.departure_date_india,
          accommodationPreference: booking.accommodation_preference,
          dietaryPreference: booking.dietary_preference,
          dietaryDetails: booking.dietary_details,
          languagePreference: languagePreference,
          medicalConditions: booking.medical_conditions,
          physicalLimitations: booking.physical_limitations
        },
        
        // Emergency Info
        emergency_info: {
          contactName: booking.emergency_contact_name,
          relationship: booking.emergency_contact_relationship,
          contactNumber: booking.emergency_contact_number,
          contactCountryCode: booking.emergency_country_code,
          insuranceProvider: booking.insurance_provider,
          policyNumber: booking.insurance_policy_number,
          insuranceValidUntil: booking.insurance_valid_until,
          travellingWithoutInsurance: booking.travelling_without_insurance === 1
        },
        
        // Consent
        consent: {
          infoAccurate: booking.consent_info_accurate === 1,
          acknowledgeRuralEnvironment: booking.consent_rural_environment === 1,
          agreeFollowGuidelines: booking.consent_follow_guidelines === 1,
          acceptTerms: booking.consent_terms === 1,
          consentEmergencyMedical: booking.consent_emergency_medical === 1,
          consentPhotography: booking.consent_photography === 1
        },
        
        // Travelers (adults and children)
        travelers: {
          adults: travellers
            .filter(t => t.type === "adult" && !t.is_primary)
            .map(t => ({
              name: t.name,
              age: t.age,
              aadhaar: t.aadhaar
            })),
          children: travellers
            .filter(t => t.type === "child")
            .map(t => ({
              name: t.name,
              age: t.age,
              aadhaar: t.aadhaar
            }))
        },
        
        // Documents with full URLs
        documents: documents.map(d => ({
          type: d.document_type,
          url: d.document_data,
          uploadedAt: d.uploaded_at
        }))
      };

      processedBookings.push(processedBooking);
    }

    return res.status(200).json({
      success: true,
      count: processedBookings.length,
      bookings: processedBookings
    });

  } catch (err) {
    console.error("Error in getAllBookings:", err);
    return res.status(500).json({ 
      success: false,
      message: "Server error",
      error: err.message 
    });
  }
};

// ================= UPDATE BOOKING STATUS =================
const updateBookingStatus = async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);
    let { status } = req.body;

    if (!bookingId || isNaN(bookingId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID"
      });
    }

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required"
      });
    }

    status = status.trim().toLowerCase();

    const validStatuses = ["pending", "confirmed", "completed", "cancelled"];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed values: ${validStatuses.join(", ")}`
      });
    }

    const [result] = await db.execute(
      `UPDATE bookings 
       SET status = ?, updated_at = NOW() 
       WHERE id = ?`,
      [status, bookingId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Booking status updated successfully",
      data: {
        bookingId,
        status
      }
    });

  } catch (error) {
    console.error("Update Booking Status Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// ================= GET BOOKING BY ID =================
const getBookingById = async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);

    if (!bookingId || isNaN(bookingId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID"
      });
    }

    const [rows] = await db.execute(
      `SELECT 
        b.*,
        u.name AS user_name,
        u.email AS user_email
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id
      WHERE b.id = ?`,
      [bookingId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    const booking = rows[0];

    // Fetch travelers
    const [travellers] = await db.execute(
      `SELECT type, name, age, aadhaar, is_primary
       FROM booking_travelers
       WHERE booking_id = ?`,
      [bookingId]
    );

    // Fetch documents
    const [documents] = await db.execute(
      `SELECT document_type, uploaded_at
       FROM booking_documents
       WHERE booking_id = ?`,
      [bookingId]
    );

    // Format response
    const formattedBooking = {
      id: booking.id,
      user_id: booking.user_id,
      user_name: booking.user_name,
      user_email: booking.user_email,
      tour_id: booking.tour_id ? String(booking.tour_id).trim() : null,
      tour_title: booking.tour_title,
      adult_count: booking.adult_count,
      child_count: booking.child_count,
      total_amount: booking.total_amount,
      payment_type: booking.payment_type,
      paid_amount: booking.paid_amount,
      status: booking.status,
      check_in: booking.check_in,
      check_out: booking.check_out,
      booking_date: booking.booking_date,
      created_at: booking.created_at,
      
      // Primary Traveler
      primary_traveler: {
        name: booking.primary_traveler_name,
        email: booking.primary_traveler_email,
        mobile: booking.primary_traveler_mobile,
        countryCode: booking.primary_traveler_country_code,
        nationality: booking.primary_traveler_nationality,
        residence: booking.primary_traveler_residence
      },
      
      // Identity
      identity_type: booking.identity_type,
      identity_details: booking.identity_details ? JSON.parse(booking.identity_details) : null,
      
      // Travel Info
      travel_info: {
        arrivalDate: booking.arrival_date_india,
        departureDate: booking.departure_date_india,
        accommodationPreference: booking.accommodation_preference,
        dietaryPreference: booking.dietary_preference,
        dietaryDetails: booking.dietary_details,
        languagePreference: booking.language_preference ? JSON.parse(booking.language_preference) : null,
        medicalConditions: booking.medical_conditions,
        physicalLimitations: booking.physical_limitations
      },
      
      // Emergency Info
      emergency_info: {
        contactName: booking.emergency_contact_name,
        relationship: booking.emergency_contact_relationship,
        contactNumber: booking.emergency_contact_number,
        contactCountryCode: booking.emergency_country_code,
        insuranceProvider: booking.insurance_provider,
        policyNumber: booking.insurance_policy_number,
        insuranceValidUntil: booking.insurance_valid_until,
        travellingWithoutInsurance: booking.travelling_without_insurance === 1
      },
      
      // Consent
      consent: {
        infoAccurate: booking.consent_info_accurate === 1,
        acknowledgeRuralEnvironment: booking.consent_rural_environment === 1,
        agreeFollowGuidelines: booking.consent_follow_guidelines === 1,
        acceptTerms: booking.consent_terms === 1,
        consentEmergencyMedical: booking.consent_emergency_medical === 1,
        consentPhotography: booking.consent_photography === 1
      },
      
      // Travelers and Documents
      travelers: {
        adults: travellers.filter(t => t.type === "adult" && !t.is_primary),
        children: travellers.filter(t => t.type === "child")
      },
      documents: documents
    };

    return res.status(200).json({
      success: true,
      data: formattedBooking
    });

  } catch (error) {
    console.error("Get Booking By ID Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// ================= GET BOOKING STATS =================
const getBookingStats = async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
        SUM(CASE WHEN status != 'cancelled' THEN paid_amount ELSE 0 END) AS total_revenue,
        COUNT(DISTINCT user_id) AS unique_customers
      FROM bookings
    `);

    const stats = rows[0];

    return res.status(200).json({
      success: true,
      data: {
        total: Number(stats.total) || 0,
        pending: Number(stats.pending) || 0,
        confirmed: Number(stats.confirmed) || 0,
        completed: Number(stats.completed) || 0,
        cancelled: Number(stats.cancelled) || 0,
        totalRevenue: Number(stats.total_revenue) || 0,
        uniqueCustomers: Number(stats.unique_customers) || 0
      }
    });

  } catch (error) {
    console.error("Get Booking Stats Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// EXPORT ALL FUNCTIONS
module.exports = {
  createBooking,
  getMyBookings,
  getAllBookings,
  updateBookingStatus,
  getBookingById,
  getBookingStats
};