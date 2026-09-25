import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, '..', 'data', 'db.json');

// Ensure data folder exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initial Demo Seed Data
export const INITIAL_DEMO_USERS = [
  {
    email: "procurement@imperialbanquets.in",
    password: "demo-password",
    businessName: "Imperial Banquets & Hospitality Ltd",
    businessType: "Hotel & Resort",
    role: "Provider & Seeker",
    location: "Lower Parel, Mumbai",
    contactPhone: "+91 98200 12345",
    verified: true
  },
  {
    email: "fleet@metrocatering.in",
    password: "demo-password",
    businessName: "Metro Catering Logistics Network",
    businessType: "Catering Enterprise",
    role: "Provider & Seeker",
    location: "Kalyan West, Thane",
    contactPhone: "+91 98200 67890",
    verified: true
  },
  {
    email: "production@grandevents.in",
    password: "demo-password",
    businessName: "Grand Event Supplies & Audio",
    businessType: "Event Planner & Production",
    role: "Provider & Seeker",
    location: "Andheri East, Mumbai",
    contactPhone: "+91 98200 54321",
    verified: true
  }
];

export const INITIAL_RESOURCES = [
  {
    id: "mmr-01",
    ownerEmail: "procurement@imperialbanquets.in",
    title: "500-Seater Banquet & Outdoor Lawn",
    category: "Venue",
    description: "Grand AC ballroom and landscaped outdoor lawn ideal for corporate galas and wedding banquets.",
    shopName: "Imperial Banquets & Warehousing",
    vendorType: "Venue Provider",
    location: "Lower Parel, Mumbai",
    fulfillmentType: "In-Store Pickup",
    pricePerDay: 25000,
    availabilityStatus: "Available",
    image: "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=800&q=80",
    coordinates: { lat: 18.9986, lng: 72.8311 },
    instantDispatchAvailable: false
  },
  {
    id: "mmr-02",
    ownerEmail: "procurement@imperialbanquets.in",
    title: "Air-Conditioned Grand Celebration Hall",
    category: "Venue",
    description: "350-capacity pillarless banquet space with integrated acoustic wall panels and banquet staging.",
    shopName: "Majestic Grand Venue",
    vendorType: "Event Space",
    location: "Majiwada, Thane",
    fulfillmentType: "In-Store Pickup",
    pricePerDay: 35000,
    availabilityStatus: "Available",
    image: "https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=800&q=80",
    coordinates: { lat: 19.2132, lng: 72.9774 },
    instantDispatchAvailable: false
  },
  {
    id: "mmr-03",
    ownerEmail: "procurement@imperialbanquets.in",
    title: "Seaside Open-Air Pavilion",
    category: "Venue",
    description: "Open sky seaside event lawn with sea breeze ventilation and heavy-duty staging power supply.",
    shopName: "Palm Beach Resort & Events",
    vendorType: "Hospitality Partner",
    location: "Vashi, Navi Mumbai",
    fulfillmentType: "In-Store Pickup",
    pricePerDay: 40000,
    availabilityStatus: "Booked",
    image: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=800&q=80",
    coordinates: { lat: 19.0771, lng: 72.9986 },
    instantDispatchAvailable: false
  },
  {
    id: "mmr-04",
    ownerEmail: "procurement@imperialbanquets.in",
    title: "Commercial Bulk Kitchen Setup & Cold Storage",
    category: "Kitchen",
    description: "Fully certified cloud kitchen prep station with commercial dishwashers and 2000L cold room.",
    shopName: "Royal Kitchens & Depot",
    vendorType: "Kitchen Facility",
    location: "Ghatkopar West, Mumbai",
    fulfillmentType: "In-Store Pickup",
    pricePerDay: 12000,
    availabilityStatus: "Available",
    image: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=800&q=80",
    coordinates: { lat: 19.0860, lng: 72.9090 },
    instantDispatchAvailable: true
  },
  {
    id: "mmr-05",
    ownerEmail: "procurement@imperialbanquets.in",
    title: "Industrial Heavy-Duty Gas Ranges & Fryers",
    category: "Kitchen",
    description: "4-burner heavy cast iron commercial LPG ranges with double-basket deep fryers.",
    shopName: "Metro Catering Hub",
    vendorType: "Equipment Rental Depot",
    location: "Kalyan West, Thane",
    fulfillmentType: "Site Delivery",
    pricePerDay: 3500,
    availabilityStatus: "Available",
    image: "https://images.unsplash.com/photo-1590725140246-20acdee442be?auto=format&fit=crop&w=800&q=80",
    coordinates: { lat: 19.2437, lng: 73.1355 },
    instantDispatchAvailable: true
  },
  {
    id: "mmr-06",
    ownerEmail: "procurement@imperialbanquets.in",
    title: "Walk-In Blast Freezer Unit (Trailer Mounted)",
    category: "Kitchen",
    description: "-18°C mobile deep freeze container unit with three-phase generator backup connection.",
    shopName: "ColdChain Express Depot",
    vendorType: "Warehouse Provider",
    location: "Bhiwandi Industrial Hub",
    fulfillmentType: "Site Delivery",
    pricePerDay: 7000,
    availabilityStatus: "Available",
    image: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80",
    coordinates: { lat: 19.2813, lng: 73.0483 },
    instantDispatchAvailable: false
  },
  {
    id: "mmr-07",
    ownerEmail: "procurement@imperialbanquets.in",
    title: "Refrigerated Catering Transport Van (3 Ton)",
    category: "Vehicle",
    description: "Insulated food transport van with temperature logging and hydraulic tail lift.",
    shopName: "Apex Catering Logistics",
    vendorType: "Fleet Owner",
    location: "Anjur Phata, Bhiwandi",
    fulfillmentType: "Site Delivery",
    pricePerDay: 4500,
    availabilityStatus: "Available",
    image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80",
    coordinates: { lat: 19.2736, lng: 73.0321 },
    instantDispatchAvailable: true
  },
  {
    id: "mmr-08",
    ownerEmail: "procurement@imperialbanquets.in",
    title: "Heavy-Duty Food Transport Truck",
    category: "Vehicle",
    description: "6-ton commercial transport vehicle suitable for mega banquet and festival setups.",
    shopName: "TransMMR Hospitality Fleet",
    vendorType: "Logistics Partner",
    location: "Panvel, Navi Mumbai",
    fulfillmentType: "Site Delivery",
    pricePerDay: 6000,
    availabilityStatus: "Available",
    image: "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=800&q=80",
    coordinates: { lat: 18.9894, lng: 73.1175 },
    instantDispatchAvailable: false
  },
  {
    id: "mmr-09",
    ownerEmail: "procurement@imperialbanquets.in",
    title: "High-Capacity Line Array Sound & Lighting Rig",
    category: "Equipment",
    description: "Complete 10,000W stage audio setup with digital mixing console, wireless mics, and LED moving heads.",
    shopName: "Grand Event Supplies",
    vendorType: "Event Warehouse",
    location: "Andheri East, Mumbai",
    fulfillmentType: "Site Delivery",
    pricePerDay: 15000,
    availabilityStatus: "Available",
    image: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=800&q=80",
    coordinates: { lat: 19.1136, lng: 72.8697 },
    instantDispatchAvailable: true
  },
  {
    id: "mmr-10",
    ownerEmail: "procurement@imperialbanquets.in",
    title: "Luxury Dining Tables & Banquet Chairs (Set of 200)",
    category: "Equipment",
    description: "200 Chiavari gold banquet chairs with cushioned seating and 25 round dining tables with satin overlays.",
    shopName: "Elite Furniture Depot",
    vendorType: "Rental Depot",
    location: "Dadar West, Mumbai",
    fulfillmentType: "Site Delivery",
    pricePerDay: 8500,
    availabilityStatus: "Available",
    image: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=800&q=80",
    coordinates: { lat: 19.0178, lng: 72.8478 },
    instantDispatchAvailable: true
  },
  {
    id: "mmr-11",
    ownerEmail: "procurement@imperialbanquets.in",
    title: "Outdoor Waterproof German Canopy Tents (50x30ft)",
    category: "Equipment",
    description: "Aluminum Pagoda German hangars engineered for monsoon waterproofing and outdoor buffet banquets.",
    shopName: "Suburban Tent & Decor House",
    vendorType: "Event Decorator",
    location: "Dombivli East, Thane",
    fulfillmentType: "Site Delivery",
    pricePerDay: 11000,
    availabilityStatus: "Booked",
    image: "https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=800&q=80",
    coordinates: { lat: 19.2184, lng: 73.0867 },
    instantDispatchAvailable: false
  },
  {
    id: "mmr-12",
    ownerEmail: "procurement@imperialbanquets.in",
    title: "Silent Diesel Generator Unit (125 kVA)",
    category: "Equipment",
    description: "Soundproof CPCB-II compliant diesel genset with automatic changeover switchboard and fuel tank.",
    shopName: "PowerGrid Events Solutions",
    vendorType: "Power Equipment Depot",
    location: "Vasai East, Extended MMR",
    fulfillmentType: "Site Delivery",
    pricePerDay: 5000,
    availabilityStatus: "Available",
    image: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80",
    coordinates: { lat: 19.3919, lng: 72.8397 },
    instantDispatchAvailable: true
  }
];

export const INITIAL_REQUESTS = [
  {
    id: "REQ-8091",
    assetId: "mmr-01",
    assetTitle: "500-Seater Banquet & Outdoor Lawn",
    providerEmail: "procurement@imperialbanquets.in",
    seekerEmail: "events@tajhotels.com",
    seekerBusiness: "Taj Lands End Banquets",
    seekerContact: "events@tajhotels.com",
    startDate: "2026-09-12",
    endDate: "2026-09-15",
    days: 3,
    dailyRate: 25000,
    totalAmount: 75000,
    tokenAmount: 15000,
    escrowDeposit: 12500,
    bookingMode: "Planned Advance",
    deliveryMode: "In-Store Pickup",
    deliveryFee: 0,
    deliveryLocation: "Lower Parel, Mumbai",
    status: "Pending",
    notes: "International Corporate Diamond Gala. 20% Token payment ready for instant date-locking.",
    auditStatus: "Pending Dispatch"
  },
  {
    id: "REQ-8092",
    assetId: "mmr-04",
    assetTitle: "Commercial Bulk Kitchen Setup & Cold Storage",
    providerEmail: "procurement@imperialbanquets.in",
    seekerEmail: "kitchen.ops@apexcatering.in",
    seekerBusiness: "Apex Gourmet Catering",
    seekerContact: "kitchen.ops@apexcatering.in",
    startDate: "2026-09-08",
    endDate: "2026-09-10",
    days: 2,
    dailyRate: 12000,
    totalAmount: 24000,
    tokenAmount: 4800,
    escrowDeposit: 6000,
    bookingMode: "Emergency Dispatch",
    deliveryMode: "Site Delivery",
    deliveryFee: 650,
    deliveryLocation: "Ghatkopar West, Mumbai",
    status: "Approved",
    notes: "Emergency 45-min fast-track delivery. Pre-pickup photo checklist signed off.",
    auditStatus: "Pre-Pickup Verified"
  },
  {
    id: "REQ-8093",
    assetId: "mmr-07",
    assetTitle: "Refrigerated Catering Transport Van (3 Ton)",
    providerEmail: "procurement@imperialbanquets.in",
    seekerEmail: "logistics@gourmetsymphony.com",
    seekerBusiness: "Gourmet Symphony Caterers",
    seekerContact: "logistics@gourmetsymphony.com",
    startDate: "2026-09-24",
    endDate: "2026-09-26",
    days: 2,
    dailyRate: 4500,
    totalAmount: 9000,
    tokenAmount: 1800,
    escrowDeposit: 2250,
    bookingMode: "Planned Advance",
    deliveryMode: "Site Delivery (Round-Trip -20%)",
    deliveryFee: 1120,
    deliveryLocation: "Jio World Convention Centre, BKC",
    status: "Negotiating",
    negotiationOffer: 8000,
    notes: "Seeking ₹8,000 package deal. Round-trip Porter logistics selected.",
    auditStatus: "Pending Dispatch"
  },
  {
    id: "REQ-8094",
    assetId: "mmr-09",
    assetTitle: "High-Capacity Line Array Sound & Lighting Rig",
    providerEmail: "procurement@imperialbanquets.in",
    seekerEmail: "production@zenithevents.com",
    seekerBusiness: "Royal Zenith Events & Staging",
    seekerContact: "production@zenithevents.com",
    startDate: "2026-09-02",
    endDate: "2026-09-04",
    days: 2,
    dailyRate: 15000,
    totalAmount: 30000,
    tokenAmount: 6000,
    escrowDeposit: 7500,
    bookingMode: "Planned Advance",
    deliveryMode: "Site Delivery",
    deliveryFee: 780,
    deliveryLocation: "Andheri East Exhibition Grounds",
    status: "Approved",
    notes: "Post-event return completed. Awaiting Escrow release sign-off.",
    auditStatus: "Post-Return Inspected"
  }
];

class FileDatabase {
  constructor() {
    this.init();
  }

  init() {
    if (!fs.existsSync(DB_FILE)) {
      this.data = {
        users: [...INITIAL_DEMO_USERS],
        resources: [...INITIAL_RESOURCES],
        requests: [...INITIAL_REQUESTS]
      };
      this.save();
    } else {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
        if (!this.data.users) this.data.users = [...INITIAL_DEMO_USERS];
        if (!this.data.resources || this.data.resources.length === 0) this.data.resources = [...INITIAL_RESOURCES];
        if (!this.data.requests) this.data.requests = [...INITIAL_REQUESTS];
      } catch (err) {
        console.error('Error reading db.json, re-initializing:', err);
        this.data = {
          users: [...INITIAL_DEMO_USERS],
          resources: [...INITIAL_RESOURCES],
          requests: [...INITIAL_REQUESTS]
        };
        this.save();
      }
    }
  }

  save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving db.json:', err);
    }
  }

  // Users API
  getUsers() { return this.data.users; }
  findUserByEmail(email) {
    if (!email) return null;
    return this.data.users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  }
  createUser(userData) {
    const existing = this.findUserByEmail(userData.email);
    if (existing) {
      return existing;
    }
    const user = {
      email: userData.email.toLowerCase(),
      password: userData.password || 'default-pwd',
      businessName: userData.businessName || 'Enterprise Partner',
      businessType: userData.businessType || 'Hotel & Resort',
      role: userData.role || 'Provider & Seeker',
      location: userData.location || 'Lower Parel, Mumbai',
      contactPhone: userData.contactPhone || '',
      verified: true,
      createdAt: new Date().toISOString()
    };
    this.data.users.push(user);
    this.save();
    return user;
  }
  updateUser(email, updateData) {
    const idx = this.data.users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
    if (idx === -1) return null;
    this.data.users[idx] = { ...this.data.users[idx], ...updateData };
    this.save();
    return this.data.users[idx];
  }

  // Resources API
  getResources() { return this.data.resources; }
  findResourceById(id) {
    return this.data.resources.find(r => r.id === id) || null;
  }
  createResource(resourceData) {
    const resource = {
      id: resourceData.id || `mmr-${Date.now()}`,
      ownerEmail: resourceData.ownerEmail.toLowerCase(),
      title: resourceData.title,
      category: resourceData.category || 'Venue',
      description: resourceData.description || '',
      shopName: resourceData.shopName || 'Commercial Partner',
      vendorType: resourceData.vendorType || 'Hospitality Depot',
      location: resourceData.location || 'Lower Parel, Mumbai',
      fulfillmentType: resourceData.fulfillmentType || 'In-Store Pickup',
      pricePerDay: Number(resourceData.pricePerDay) || 10000,
      availabilityStatus: resourceData.availabilityStatus || 'Available',
      image: resourceData.image || '',
      coordinates: resourceData.coordinates || { lat: 19.0674, lng: 72.8687 },
      instantDispatchAvailable: Boolean(resourceData.instantDispatchAvailable),
      createdAt: new Date().toISOString()
    };
    this.data.resources.unshift(resource);
    this.save();
    return resource;
  }
  updateResource(id, updateData) {
    const idx = this.data.resources.findIndex(r => r.id === id);
    if (idx === -1) return null;
    this.data.resources[idx] = { ...this.data.resources[idx], ...updateData };
    this.save();
    return this.data.resources[idx];
  }
  deleteResource(id, ownerEmail) {
    const idx = this.data.resources.findIndex(r => r.id === id);
    if (idx === -1) return false;
    if (ownerEmail && this.data.resources[idx].ownerEmail.toLowerCase() !== ownerEmail.toLowerCase()) {
      return false; // Unauthorized
    }
    this.data.resources.splice(idx, 1);
    this.save();
    return true;
  }

  // Requests API
  getRequests() { return this.data.requests; }
  findRequestById(id) {
    return this.data.requests.find(r => r.id === id) || null;
  }
  createRequest(reqData) {
    const req = {
      id: reqData.id || `REQ-${Math.floor(1000 + Math.random() * 9000)}`,
      assetId: reqData.assetId,
      assetTitle: reqData.assetTitle,
      providerEmail: reqData.providerEmail.toLowerCase(),
      seekerEmail: reqData.seekerEmail.toLowerCase(),
      seekerBusiness: reqData.seekerBusiness,
      seekerContact: reqData.seekerContact,
      startDate: reqData.startDate,
      endDate: reqData.endDate,
      days: Number(reqData.days) || 1,
      dailyRate: Number(reqData.dailyRate),
      totalAmount: Number(reqData.totalAmount),
      tokenAmount: Number(reqData.tokenAmount) || 0,
      escrowDeposit: Number(reqData.escrowDeposit) || 0,
      bookingMode: reqData.bookingMode || 'Planned Advance',
      deliveryMode: reqData.deliveryMode || 'In-Store Pickup',
      deliveryFee: Number(reqData.deliveryFee) || 0,
      deliveryLocation: reqData.deliveryLocation || 'In-Store Pickup',
      status: reqData.status || 'Pending',
      negotiationOffer: reqData.negotiationOffer ? Number(reqData.negotiationOffer) : undefined,
      notes: reqData.notes || '',
      auditStatus: reqData.auditStatus || 'Pending Dispatch',
      createdAt: new Date().toISOString()
    };
    this.data.requests.unshift(req);
    this.save();
    return req;
  }
  updateRequest(id, updateData) {
    const idx = this.data.requests.findIndex(r => r.id === id);
    if (idx === -1) return null;
    this.data.requests[idx] = { ...this.data.requests[idx], ...updateData };
    this.save();
    return this.data.requests[idx];
  }
}

export const fileDb = new FileDatabase();
