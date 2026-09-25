import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User, Resource, Request } from './models.js';
import { fileDb, INITIAL_DEMO_USERS, INITIAL_RESOURCES, INITIAL_REQUESTS } from './fileDb.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..')));

// Determine and configure MongoDB Atlas Cloud Database
let isMongoConnected = false;
const rawMongoUri = (process.env.MONGODB_URI || process.env.MONGODB_URL || '').trim().replace(/^["']|["']$/g, '');

// Helper to sanitize connection URI (strips accidental < > around password & ensures valid dbName)
function sanitizeMongoUri(uri) {
  if (!uri) return '';
  let sanitized = uri.trim();
  
  // Replace <password> angle brackets if present in credentials portion
  sanitized = sanitized.replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)<([^>]+)>(@)/i, '$1$2$3');
  
  return sanitized;
}

// Helper to safely mask URI for logging (never expose credentials)
function getMaskedUri(uri) {
  if (!uri) return 'None';
  return uri.replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)([^@]+)(@.+)/i, '$1*****$3');
}

const sanitizedUri = sanitizeMongoUri(rawMongoUri);

if (sanitizedUri) {
  console.log(`🔌 Initializing MongoDB Atlas connection (${getMaskedUri(sanitizedUri)})...`);
  
  mongoose.connect(sanitizedUri, {
    dbName: 'hospitalink',
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000
  })
    .then(async () => {
      isMongoConnected = true;
      console.log('✅ Connected to MongoDB Atlas Cloud Database.');

      // Auto-seed cloud database with initial MMR standard assets if empty
      try {
        const userCount = await User.countDocuments();
        if (userCount === 0) {
          console.log('⚡ Seeding initial demo users to MongoDB Atlas...');
          await User.insertMany(INITIAL_DEMO_USERS);
        }
        const resourceCount = await Resource.countDocuments();
        if (resourceCount === 0) {
          console.log('⚡ Seeding initial commercial resources to MongoDB Atlas...');
          await Resource.insertMany(INITIAL_RESOURCES);
        }
        const reqCount = await Request.countDocuments();
        if (reqCount === 0) {
          console.log('⚡ Seeding initial pipeline requests to MongoDB Atlas...');
          await Request.insertMany(INITIAL_REQUESTS);
        }
      } catch (seedErr) {
        console.warn('⚠️ MongoDB auto-seeding notice:', seedErr.message);
      }
    })
    .catch((err) => {
      console.warn('⚠️ MongoDB connection error (using high-performance persistent JSON DB adapter):', err.message);
      isMongoConnected = false;
    });

  mongoose.connection.on('connected', () => {
    isMongoConnected = true;
  });
  mongoose.connection.on('disconnected', () => {
    isMongoConnected = false;
  });
  mongoose.connection.on('error', (err) => {
    console.warn('⚠️ MongoDB connection event error:', err.message);
    isMongoConnected = false;
  });
} else {
  console.log('ℹ️ MONGODB_URI not provided. Operating seamlessly with persistent JSON storage adapter.');
}

// ==========================================
// 1. HEALTH & SYSTEM INFO API
// ==========================================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'HospitaLink B2B Exchange Backend REST API',
    database: isMongoConnected ? 'MongoDB Atlas' : 'Persistent Storage Adapter',
    timestamp: new Date().toISOString()
  });
});

// ==========================================
// 2. AUTHENTICATION & USER APIS
// ==========================================

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    let user = null;
    if (isMongoConnected) {
      user = await User.findOne({ email: email.toLowerCase() });
    } else {
      user = fileDb.findUserByEmail(email);
    }

    if (!user) {
      // Auto-provision user account for convenient demo access
      const defaultName = email.split('@')[0].replace('.', ' ').toUpperCase() + ' ENTERPRISE';
      const userData = {
        email: email.toLowerCase(),
        password: password || 'demo-password',
        businessName: defaultName,
        businessType: 'Hotel & Resort',
        role: 'Provider & Seeker',
        location: 'Lower Parel, Mumbai',
        verified: true
      };

      if (isMongoConnected) {
        user = await User.create(userData);
      } else {
        user = fileDb.createUser(userData);
      }
    }

    res.json({ success: true, user });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, businessName, businessType, role, location, contactPhone } = req.body;
    if (!email || !businessName) {
      return res.status(400).json({ error: 'Email and Business Name are required' });
    }

    const userData = {
      email: email.toLowerCase(),
      password: password || 'demo-password',
      businessName,
      businessType: businessType || 'Hotel & Resort',
      role: role || 'Provider & Seeker',
      location: location || 'Lower Parel, Mumbai',
      contactPhone: contactPhone || '',
      verified: true
    };

    let user = null;
    if (isMongoConnected) {
      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) {
        return res.status(400).json({ error: 'User with this work email is already registered' });
      }
      user = await User.create(userData);
    } else {
      const existing = fileDb.findUserByEmail(email);
      if (existing) {
        return res.status(400).json({ error: 'User with this work email is already registered' });
      }
      user = fileDb.createUser(userData);
    }

    res.status(201).json({ success: true, user });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update Profile
app.put('/api/auth/profile', async (req, res) => {
  try {
    const { email, businessName, businessType, role, location, contactPhone } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    let updatedUser = null;
    const updateData = { businessName, businessType, role, location, contactPhone };

    if (isMongoConnected) {
      updatedUser = await User.findOneAndUpdate(
        { email: email.toLowerCase() },
        { $set: updateData },
        { new: true }
      );
    } else {
      updatedUser = fileDb.updateUser(email, updateData);
    }

    if (!updatedUser) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    res.json({ success: true, user: updatedUser });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 3. COMMERCIAL RESOURCES APIS
// ==========================================

// Get All Public Resources (for shared public marketplace)
app.get('/api/resources', async (req, res) => {
  try {
    let resources = [];
    if (isMongoConnected) {
      resources = await Resource.find().sort({ createdAt: -1 });
    } else {
      resources = fileDb.getResources();
    }
    res.json(resources);
  } catch (err) {
    console.error('Get resources error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create Resource
app.post('/api/resources', async (req, res) => {
  try {
    const resourceData = req.body;
    if (!resourceData.title || !resourceData.ownerEmail) {
      return res.status(400).json({ error: 'Title and ownerEmail are required' });
    }

    if (!resourceData.id) {
      resourceData.id = `mmr-${Date.now()}`;
    }

    let created = null;
    if (isMongoConnected) {
      created = await Resource.create(resourceData);
    } else {
      created = fileDb.createResource(resourceData);
    }

    res.status(201).json({ success: true, resource: created });
  } catch (err) {
    console.error('Create resource error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update Resource (With ownership verification)
app.put('/api/resources/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const userEmail = req.headers['x-user-email'] || updateData.ownerEmail;

    let existing = null;
    if (isMongoConnected) {
      existing = await Resource.findOne({ id });
    } else {
      existing = fileDb.findResourceById(id);
    }

    if (!existing) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    // Ownership check
    if (userEmail && existing.ownerEmail && existing.ownerEmail.toLowerCase() !== userEmail.toLowerCase()) {
      return res.status(403).json({ error: 'Permission denied: You can only edit your own listings' });
    }

    let updated = null;
    if (isMongoConnected) {
      updated = await Resource.findOneAndUpdate({ id }, { $set: updateData }, { new: true });
    } else {
      updated = fileDb.updateResource(id, updateData);
    }

    res.json({ success: true, resource: updated });
  } catch (err) {
    console.error('Update resource error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete Resource (With ownership verification)
app.delete('/api/resources/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userEmail = req.headers['x-user-email'];

    let existing = null;
    if (isMongoConnected) {
      existing = await Resource.findOne({ id });
    } else {
      existing = fileDb.findResourceById(id);
    }

    if (!existing) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    if (userEmail && existing.ownerEmail && existing.ownerEmail.toLowerCase() !== userEmail.toLowerCase()) {
      return res.status(403).json({ error: 'Permission denied: You can only delete your own listings' });
    }

    if (isMongoConnected) {
      await Resource.deleteOne({ id });
    } else {
      fileDb.deleteResource(id, userEmail);
    }

    res.json({ success: true, message: 'Resource deleted successfully' });
  } catch (err) {
    console.error('Delete resource error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4. BOOKING REQUESTS & WORKFLOW APIS
// ==========================================

// Get Requests (Optionally filtered by userEmail as provider or seeker)
app.get('/api/requests', async (req, res) => {
  try {
    const userEmail = req.query.email || req.headers['x-user-email'];
    let requests = [];

    if (isMongoConnected) {
      if (userEmail) {
        requests = await Request.find({
          $or: [
            { providerEmail: userEmail.toLowerCase() },
            { seekerEmail: userEmail.toLowerCase() }
          ]
        }).sort({ createdAt: -1 });
      } else {
        requests = await Request.find().sort({ createdAt: -1 });
      }
    } else {
      const all = fileDb.getRequests();
      if (userEmail) {
        requests = all.filter(r =>
          (r.providerEmail && r.providerEmail.toLowerCase() === userEmail.toLowerCase()) ||
          (r.seekerEmail && r.seekerEmail.toLowerCase() === userEmail.toLowerCase())
        );
      } else {
        requests = all;
      }
    }

    res.json(requests);
  } catch (err) {
    console.error('Get requests error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create Booking Request
app.post('/api/requests', async (req, res) => {
  try {
    const reqData = req.body;
    if (!reqData.assetId || !reqData.providerEmail || !reqData.seekerEmail) {
      return res.status(400).json({ error: 'Missing required request parameters' });
    }

    if (!reqData.id) {
      reqData.id = `REQ-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    let createdReq = null;
    if (isMongoConnected) {
      createdReq = await Request.create(reqData);
      // Lock or book the asset
      const availStatus = reqData.bookingMode === 'Emergency Dispatch' ? 'Booked' : 'Locked';
      await Resource.findOneAndUpdate({ id: reqData.assetId }, { availabilityStatus: availStatus });
    } else {
      createdReq = fileDb.createRequest(reqData);
      const availStatus = reqData.bookingMode === 'Emergency Dispatch' ? 'Booked' : 'Locked';
      fileDb.updateResource(reqData.assetId, { availabilityStatus: availStatus });
    }

    res.status(201).json({ success: true, request: createdReq });
  } catch (err) {
    console.error('Create request error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update Request Status (Accept, Reject, Negotiate, Complete)
app.patch('/api/requests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, negotiationOffer, notes, auditStatus } = req.body;

    let targetReq = null;
    if (isMongoConnected) {
      targetReq = await Request.findOne({ id });
    } else {
      targetReq = fileDb.findRequestById(id);
    }

    if (!targetReq) {
      return res.status(404).json({ error: 'Booking request not found' });
    }

    const updateFields = {};
    if (status) updateFields.status = status;
    if (negotiationOffer !== undefined) updateFields.negotiationOffer = negotiationOffer;
    if (notes !== undefined) updateFields.notes = notes;
    if (auditStatus !== undefined) updateFields.auditStatus = auditStatus;

    let updatedReq = null;
    if (isMongoConnected) {
      updatedReq = await Request.findOneAndUpdate({ id }, { $set: updateFields }, { new: true });
      
      // Synchronize asset calendar availability
      if (status === 'Approved' || status === 'Confirmed') {
        await Resource.findOneAndUpdate({ id: targetReq.assetId }, { availabilityStatus: 'Booked' });
      } else if (status === 'Rejected' || status === 'Completed') {
        // Check if there are other confirmed bookings
        const otherConfirmed = await Request.findOne({
          assetId: targetReq.assetId,
          id: { $ne: id },
          status: { $in: ['Approved', 'Confirmed'] }
        });
        if (!otherConfirmed) {
          await Resource.findOneAndUpdate({ id: targetReq.assetId }, { availabilityStatus: 'Available' });
        }
      }
    } else {
      updatedReq = fileDb.updateRequest(id, updateFields);
      if (status === 'Approved' || status === 'Confirmed') {
        fileDb.updateResource(targetReq.assetId, { availabilityStatus: 'Booked' });
      } else if (status === 'Rejected' || status === 'Completed') {
        const otherConfirmed = fileDb.getRequests().some(r =>
          r.assetId === targetReq.assetId && r.id !== id && (r.status === 'Approved' || r.status === 'Confirmed')
        );
        if (!otherConfirmed) {
          fileDb.updateResource(targetReq.assetId, { availabilityStatus: 'Available' });
        }
      }
    }

    res.json({ success: true, request: updatedReq });
  } catch (err) {
    console.error('Update request error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Reset Database / Reload Default MMR Fleet
app.post('/api/reset-fleet', async (req, res) => {
  try {
    if (isMongoConnected) {
      await Resource.deleteMany({});
      await Resource.insertMany(INITIAL_RESOURCES);
      await Request.deleteMany({});
      await Request.insertMany(INITIAL_REQUESTS);
    } else {
      fileDb.data.resources = JSON.parse(JSON.stringify(INITIAL_RESOURCES));
      fileDb.data.requests = JSON.parse(JSON.stringify(INITIAL_REQUESTS));
      fileDb.save();
    }
    res.json({ success: true, message: 'Restored 12 verified standard MMR hospitality assets.' });
  } catch (err) {
    console.error('Reset fleet error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Catch-all to serve index.html for SPA routing
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(__dirname, '..', 'index.html'));
  }
  next();
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 HospitaLink Full-Stack Server running on port ${PORT}`);
  console.log(`🌐 Live REST API & Web UI accessible at http://localhost:${PORT}`);
});
