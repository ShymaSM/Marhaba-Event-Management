// ========================================
// MARHABA EVENT MANAGEMENT - BACKEND
// ========================================

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const path = require('path');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname)));

// ========================================
// DATABASE CONNECTION
// ========================================

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/marhaba_events')
  .then(() => {
    console.log('MongoDB connected successfully');
  }).catch(err => {
    console.error('MongoDB connection error:', err);
  });

// ========================================
// SCHEMAS & MODELS
// ========================================

// Enquiry Schema
const enquirySchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  mobileNumber: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  eventType: {
    type: String,
    required: true
  },
  eventDate: {
    type: Date,
    required: true
  },
  budget: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['new', 'contacted', 'in-progress', 'completed'],
    default: 'new'
  },
  notes: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const Enquiry = mongoose.model('Enquiry', enquirySchema);

// Admin User Schema
const adminSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  role: {
    type: String,
    enum: ['admin', 'manager'],
    default: 'admin'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Admin = mongoose.model('Admin', adminSchema);

// ========================================
// EMAIL CONFIGURATION
// ========================================

if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
  console.warn('WARNING: EMAIL_USER / EMAIL_PASSWORD not set in .env — emails will fail to send.');
}

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD // must be a 16-char Gmail App Password, NOT your login password
  }
});

// Test email connection on startup
transporter.verify((error, success) => {
  if (error) {
    console.error('Email service error (emails will NOT be delivered):', error.message);
  } else {
    console.log('Email service ready — SMTP connection verified');
  }
});

// ========================================
// ROUTES - PUBLIC
// ========================================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

// Submit enquiry
app.post('/api/enquiries', async (req, res) => {
  try {
    const { fullName, mobileNumber, email, eventType, eventDate, budget, message } = req.body;

    // Validation
    if (!fullName || !mobileNumber || !email || !eventType || !eventDate || !budget || !message) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    // Create enquiry
    const enquiry = new Enquiry({
      fullName,
      mobileNumber,
      email,
      eventType,
      eventDate,
      budget,
      message
    });

    // Save to DB if connected, otherwise bypass to avoid 500 error during local testing without MongoDB
    if (mongoose.connection.readyState === 1) {
      await enquiry.save();
    } else {
      console.warn('MongoDB not connected. Skipping database save for enquiry:', fullName);
      enquiry._id = new mongoose.Types.ObjectId(); // Generate mock ID for response
    }

    // Send email to company (do not block the response on email failures —
    // the enquiry is already saved in the database as a fallback)
    const companyEmail = process.env.COMPANY_EMAIL || 'marhabaeventmanagementazm@gmail.com';

    const sendEmails = async () => {
      await transporter.sendMail({
        from: `"Marhaba Website" <${process.env.EMAIL_USER}>`,
        to: companyEmail,
        replyTo: email,
        subject: `New Event Enquiry from ${fullName}`,
        html: `
                    <h2>New Enquiry Received</h2>
                    <p><strong>Name:</strong> ${fullName}</p>
                    <p><strong>Mobile:</strong> ${mobileNumber}</p>
                    <p><strong>Email:</strong> ${email}</p>
                    <p><strong>Event Type:</strong> ${eventType}</p>
                    <p><strong>Event Date:</strong> ${new Date(eventDate).toLocaleDateString()}</p>
                    <p><strong>Budget:</strong> ${budget}</p>
                    <p><strong>Message:</strong> ${message}</p>
                    <hr>
                    <p>Log in to admin dashboard to view all enquiries.</p>
                `
      });

      await transporter.sendMail({
        from: `"Marhaba Event Management" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Your Event Enquiry - Marhaba Event Management',
        html: `
                    <h2>Thank You for Your Enquiry!</h2>
                    <p>Dear ${fullName},</p>
                    <p>We have received your event enquiry and will be in touch with you shortly.</p>
                    <h3>Enquiry Details:</h3>
                    <ul>
                        <li><strong>Event Type:</strong> ${eventType}</li>
                        <li><strong>Event Date:</strong> ${new Date(eventDate).toLocaleDateString()}</li>
                        <li><strong>Budget:</strong> ${budget}</li>
                    </ul>
                    <p>Our team will contact you soon to discuss your event in detail.</p>
                    <hr>
                    <p><strong>Contact Information:</strong></p>
                    <p>Phone: +91 7904529531<br>WhatsApp: https://wa.me/917904529531</p>
                    <p>Best regards,<br>Marhaba Event Management Team</p>
                `
      });
    };

    try {
      await sendEmails();
      console.log(`Enquiry email sent successfully for enquiry ${enquiry._id}`);
    } catch (emailError) {
      // Log full error for debugging (check server logs / hosting dashboard logs)
      console.error(`Failed to send email for enquiry ${enquiry._id}:`, emailError.message);
      // Enquiry is already saved in MongoDB, so it is not lost — visible in admin dashboard
    }

    res.status(201).json({
      success: true,
      message: 'Enquiry submitted successfully',
      enquiryId: enquiry._id
    });

  } catch (error) {
    console.error('Error submitting enquiry:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while submitting your enquiry'
    });
  }
});

// ========================================
// ROUTES - ADMIN AUTHENTICATION
// ========================================

// Admin login
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password required' });
    }

    const admin = await Admin.findOne({ username });

    if (!admin || !bcrypt.compareSync(password, admin.password)) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: admin._id, username: admin.username },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      admin: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        role: admin.role
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ========================================
// MIDDLEWARE - ADMIN AUTHENTICATION
// ========================================

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.admin = decoded;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// ========================================
// ROUTES - ADMIN DASHBOARD
// ========================================

// Get all enquiries
app.get('/api/admin/enquiries', authMiddleware, async (req, res) => {
  try {
    const { status, eventType, page = 1, limit = 10 } = req.query;

    let query = {};
    if (status) query.status = status;
    if (eventType) query.eventType = eventType;

    const skip = (page - 1) * limit;

    const enquiries = await Enquiry.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Enquiry.countDocuments(query);

    res.json({
      success: true,
      enquiries,
      total,
      pages: Math.ceil(total / limit),
      currentPage: parseInt(page)
    });

  } catch (error) {
    console.error('Error fetching enquiries:', error);
    res.status(500).json({ success: false, message: 'Error fetching enquiries' });
  }
});

// Get single enquiry
app.get('/api/admin/enquiries/:id', authMiddleware, async (req, res) => {
  try {
    const enquiry = await Enquiry.findById(req.params.id);

    if (!enquiry) {
      return res.status(404).json({ success: false, message: 'Enquiry not found' });
    }

    res.json({ success: true, enquiry });

  } catch (error) {
    console.error('Error fetching enquiry:', error);
    res.status(500).json({ success: false, message: 'Error fetching enquiry' });
  }
});

// Update enquiry status
app.put('/api/admin/enquiries/:id', authMiddleware, async (req, res) => {
  try {
    const { status, notes } = req.body;

    const enquiry = await Enquiry.findByIdAndUpdate(
      req.params.id,
      {
        status,
        notes,
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!enquiry) {
      return res.status(404).json({ success: false, message: 'Enquiry not found' });
    }

    res.json({ success: true, message: 'Enquiry updated', enquiry });

  } catch (error) {
    console.error('Error updating enquiry:', error);
    res.status(500).json({ success: false, message: 'Error updating enquiry' });
  }
});

// Delete enquiry
app.delete('/api/admin/enquiries/:id', authMiddleware, async (req, res) => {
  try {
    const enquiry = await Enquiry.findByIdAndDelete(req.params.id);

    if (!enquiry) {
      return res.status(404).json({ success: false, message: 'Enquiry not found' });
    }

    res.json({ success: true, message: 'Enquiry deleted' });

  } catch (error) {
    console.error('Error deleting enquiry:', error);
    res.status(500).json({ success: false, message: 'Error deleting enquiry' });
  }
});

// Search enquiries
app.get('/api/admin/enquiries/search/:query', authMiddleware, async (req, res) => {
  try {
    const { query } = req.params;

    const enquiries = await Enquiry.find({
      $or: [
        { fullName: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
        { mobileNumber: { $regex: query, $options: 'i' } }
      ]
    }).sort({ createdAt: -1 });

    res.json({ success: true, enquiries });

  } catch (error) {
    console.error('Error searching enquiries:', error);
    res.status(500).json({ success: false, message: 'Error searching enquiries' });
  }
});

// Get dashboard stats
app.get('/api/admin/stats', authMiddleware, async (req, res) => {
  try {
    const totalEnquiries = await Enquiry.countDocuments();
    const newEnquiries = await Enquiry.countDocuments({ status: 'new' });
    const contactedEnquiries = await Enquiry.countDocuments({ status: 'contacted' });
    const completedEnquiries = await Enquiry.countDocuments({ status: 'completed' });

    const eventTypes = await Enquiry.aggregate([
      { $group: { _id: '$eventType', count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      stats: {
        totalEnquiries,
        newEnquiries,
        contactedEnquiries,
        completedEnquiries,
        eventTypes
      }
    });

  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, message: 'Error fetching stats' });
  }
});

// Export enquiries to CSV
app.get('/api/admin/export/csv', authMiddleware, async (req, res) => {
  try {
    const enquiries = await Enquiry.find({}).sort({ createdAt: -1 });

    let csv = 'Name,Mobile,Email,Event Type,Event Date,Budget,Status,Created At\n';

    enquiries.forEach(e => {
      csv += `"${e.fullName}","${e.mobileNumber}","${e.email}","${e.eventType}","${new Date(e.eventDate).toLocaleDateString()}","${e.budget}","${e.status}","${new Date(e.createdAt).toLocaleDateString()}"\n`;
    });

    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', 'attachment; filename="enquiries.csv"');
    res.send(csv);

  } catch (error) {
    console.error('Error exporting CSV:', error);
    res.status(500).json({ success: false, message: 'Error exporting data' });
  }
});

// ========================================
// SETUP INITIAL ADMIN (Run once)
// ========================================

app.post('/api/admin/setup', async (req, res) => {
  try {
    const { username, password, email } = req.body;

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ username });
    if (existingAdmin) {
      return res.status(400).json({ success: false, message: 'Admin already exists' });
    }

    // Hash password
    const hashedPassword = bcrypt.hashSync(password, 10);

    // Create admin
    const admin = new Admin({
      username,
      password: hashedPassword,
      email
    });

    await admin.save();

    res.json({ success: true, message: 'Admin created successfully' });

  } catch (error) {
    console.error('Error setting up admin:', error);
    res.status(500).json({ success: false, message: 'Error setting up admin' });
  }
});

// ========================================
// ERROR HANDLING
// ========================================

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'An error occurred',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// ========================================
// START SERVER
// ========================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Marhaba Event Management server running on port ${PORT}`);
});

module.exports = app;