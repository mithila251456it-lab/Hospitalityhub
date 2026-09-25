import mongoose from 'mongoose';

// User / Organization Schema
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  businessName: { type: String, required: true, trim: true },
  businessType: { type: String, default: 'Hotel & Resort' },
  role: { type: String, default: 'Provider & Seeker' }, // 'Provider', 'Seeker', 'Provider & Seeker'
  location: { type: String, default: 'Lower Parel, Mumbai' },
  contactPhone: { type: String, default: '' },
  verified: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

// Commercial Resource / Asset Schema
const resourceSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, // e.g. 'mmr-01', 'mmr-172...'
  ownerEmail: { type: String, required: true, lowercase: true, trim: true },
  title: { type: String, required: true, trim: true },
  category: { type: String, required: true }, // 'Venue', 'Kitchen', 'Vehicle', 'Equipment'
  description: { type: String, default: '' },
  shopName: { type: String, required: true },
  vendorType: { type: String, default: 'Commercial Partner' },
  location: { type: String, default: 'Lower Parel, Mumbai' },
  fulfillmentType: { type: String, default: 'In-Store Pickup' }, // 'In-Store Pickup', 'Site Delivery'
  pricePerDay: { type: Number, required: true, min: 0 },
  availabilityStatus: { type: String, default: 'Available' }, // 'Available', 'Locked', 'Booked'
  image: { type: String, default: '' },
  coordinates: {
    lat: { type: Number, default: 19.0674 },
    lng: { type: Number, default: 72.8687 }
  },
  instantDispatchAvailable: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

// Booking / Rental Request Schema
const requestSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, // e.g. 'REQ-8091'
  assetId: { type: String, required: true },
  assetTitle: { type: String, required: true },
  providerEmail: { type: String, required: true, lowercase: true, trim: true },
  seekerEmail: { type: String, required: true, lowercase: true, trim: true },
  seekerBusiness: { type: String, required: true },
  seekerContact: { type: String, required: true },
  startDate: { type: String, required: true }, // 'YYYY-MM-DD'
  endDate: { type: String, required: true }, // 'YYYY-MM-DD'
  days: { type: Number, default: 1 },
  dailyRate: { type: Number, required: true },
  totalAmount: { type: Number, required: true },
  tokenAmount: { type: Number, default: 0 },
  escrowDeposit: { type: Number, default: 0 },
  bookingMode: { type: String, default: 'Planned Advance' }, // 'Planned Advance', 'Emergency Dispatch'
  deliveryMode: { type: String, default: 'In-Store Pickup' },
  deliveryFee: { type: Number, default: 0 },
  deliveryLocation: { type: String, default: 'In-Store Pickup' },
  status: { type: String, default: 'Pending' }, // 'Pending', 'Negotiating', 'Approved', 'Rejected', 'Completed'
  negotiationOffer: { type: Number },
  notes: { type: String, default: '' },
  auditStatus: { type: String, default: 'Pending Dispatch' },
  createdAt: { type: Date, default: Date.now }
});

export const User = mongoose.model('User', userSchema);
export const Resource = mongoose.model('Resource', resourceSchema);
export const Request = mongoose.model('Request', requestSchema);
