/**
 * B2B Hospitality Resource Exchange - Central Data Layer
 * Localized exclusively for Mumbai Metropolitan Region (MMR)
 * Includes GPS coordinates, Multi-Photo Image Galleries, Trust Badges,
 * Verified Ratings, Specifications, and Escrow/Audit schemas.
 */

const MMR_CLIENT_ORIGIN = {
  name: "Bandra Kurla Complex (BKC) Enterprise Depot",
  coordinates: { lat: 19.0674, lng: 72.8687 }
};

const MMR_REGIONS = [
  "Mumbai",
  "Thane",
  "Navi Mumbai",
  "Bhiwandi",
  "Kalyan",
  "Vasai"
];

const CATEGORIES = [
  { id: "all", label: "All Categories", icon: "grid", emoji: "🏢" },
  { id: "Venue", label: "Venues & Banquets", icon: "champagne-glasses", emoji: "🏨" },
  { id: "Kitchen", label: "Commercial Kitchens", icon: "utensils", emoji: "🍽️" },
  { id: "Vehicle", label: "Logistics & Vehicles", icon: "truck", emoji: "🚐" },
  { id: "Equipment", label: "Event Equipment", icon: "speaker", emoji: "🎪" },
  { id: "Furniture", label: "Hospitality Furniture", icon: "armchair", emoji: "🪑" }
];

const BUSINESS_TYPES = [
  "Hotel & Resort",
  "Catering Enterprise",
  "Banquet Venue",
  "Event Planner & Production",
  "Cloud Kitchen Network",
  "Institutional Kitchen"
];

let inventoryData = [
  // 1. VENUES & BANQUETS
  {
    id: "mmr-01",
    title: "500-Seater Banquet & Outdoor Lawn",
    category: "Venue",
    shopName: "Imperial Banquets & Hospitality Ltd",
    vendorType: "Venue Provider",
    location: "Lower Parel, Mumbai",
    fulfillmentType: "In-Store Pickup",
    pricePerDay: 25000,
    securityDeposit: 10000,
    quantityAvailable: 1,
    availabilityStatus: "Available",
    verified: true,
    rating: 4.9,
    reviewsCount: 38,
    completedRentals: 42,
    description: "Centrally air-conditioned grand luxury hall with adjoining 8,000 sq.ft manicured lawn. Features dedicated VIP dressing suites, high-voltage 3-phase power line for concert audio, and valet parking for 120+ vehicles.",
    specifications: [
      "500 Seated / 800 Floating Capacity",
      "Full Central AC Climate Control",
      "Dedicated Bridal & VIP Green Rooms",
      "125 kVA Silent DG Backup Included",
      "Valet Parking for 120 Cars"
    ],
    photos: [
      "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=1200&q=80"
    ],
    image: "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1200&q=80",
    coordinates: { lat: 18.9986, lng: 72.8311 },
    instantDispatchAvailable: false,
    bookedDates: ["2026-09-12", "2026-09-13", "2026-09-14", "2026-09-15"],
    timeSlots: ["Morning (8 AM – 2 PM)", "Evening (5 PM – 12 AM)", "Full Day (24 Hrs)"]
  },
  {
    id: "mmr-02",
    title: "Air-Conditioned Grand Celebration Hall",
    category: "Venue",
    shopName: "Majestic Grand Venue",
    vendorType: "Event Space",
    location: "Majiwada, Thane",
    fulfillmentType: "In-Store Pickup",
    pricePerDay: 35000,
    securityDeposit: 15000,
    quantityAvailable: 1,
    availabilityStatus: "Available",
    verified: true,
    rating: 4.8,
    reviewsCount: 26,
    completedRentals: 31,
    description: "Premium Pillarless banquet hall situated at Majiwada Junction. Acoustic dampening ceiling, crystal chandeliers, built-in 4K projection screens, and integrated sound engineering consoles.",
    specifications: [
      "Pillarless 6,500 sq.ft Hall",
      "Crystal Chandelier Mood Lighting",
      "Dual 4K Laser Projection Screens",
      "Commercial Warming Kitchen Attached",
      "Service Lift Access for Heavy Staging"
    ],
    photos: [
      "https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1200&q=80"
    ],
    image: "https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=1200&q=80",
    coordinates: { lat: 19.2132, lng: 72.9774 },
    instantDispatchAvailable: false,
    bookedDates: [],
    timeSlots: ["Morning (8 AM – 3 PM)", "Evening (6 PM – 1 AM)"]
  },
  {
    id: "mmr-03",
    title: "Seaside Open-Air Pavilion & Lawn",
    category: "Venue",
    shopName: "Palm Beach Resort & Events",
    vendorType: "Hospitality Partner",
    location: "Vashi, Navi Mumbai",
    fulfillmentType: "In-Store Pickup",
    pricePerDay: 40000,
    securityDeposit: 20000,
    quantityAvailable: 1,
    availabilityStatus: "Booked",
    verified: true,
    rating: 4.9,
    reviewsCount: 44,
    completedRentals: 58,
    description: "Scenic waterfront open-air deck and landscaped tropical garden. Ideal for high-profile weddings, corporate annual summits, and brand launch cocktail galas.",
    specifications: [
      "Waterfront Sunset Vista Deck",
      "1,000 Guest Capacity",
      "Integrated Ambient Tree Spotlights",
      "Dedicated Food Court Service Paved Alley",
      "24/7 On-Site Security & Fire Marshall"
    ],
    photos: [
      "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1200&q=80"
    ],
    image: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1200&q=80",
    coordinates: { lat: 19.0771, lng: 72.9986 },
    instantDispatchAvailable: false,
    bookedDates: ["2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27"],
    timeSlots: ["Sunset & Evening (4 PM – 12 AM)"]
  },

  // 2. COMMERCIAL KITCHENS & APPLIANCES
  {
    id: "mmr-04",
    title: "Commercial Bulk Kitchen Setup & Cold Storage",
    category: "Kitchen",
    shopName: "Royal Kitchens & Depot",
    vendorType: "Kitchen Facility",
    location: "Ghatkopar West, Mumbai",
    fulfillmentType: "In-Store Pickup",
    pricePerDay: 12000,
    securityDeposit: 5000,
    quantityAvailable: 2,
    availabilityStatus: "Available",
    verified: true,
    rating: 4.9,
    reviewsCount: 31,
    completedRentals: 47,
    description: "Fully licensed FSSAI compliant industrial catering production commissary. Features 10-tray Rational Combi Steamer, walk-in 4°C walk-in chill room, 4-burner high-pressure gas banks, and stainless prep tables.",
    specifications: [
      "10-Tray Rational Combi Oven (Gas/Electric)",
      "Walk-in Cold Storage Room (0°C to 4°C)",
      "Triple Bowl Stainless Steel Pot Wash Sink",
      "Commercial Dough Kneader (50kg batch)",
      "FSSAI & Fire Safety NOC Certified"
    ],
    photos: [
      "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1590725140246-20acdee442be?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=80"
    ],
    image: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=1200&q=80",
    coordinates: { lat: 19.0860, lng: 72.9090 },
    instantDispatchAvailable: true,
    bookedDates: ["2026-09-08", "2026-09-09", "2026-09-10"],
    timeSlots: ["Shift A (4 AM – 2 PM)", "Shift B (2 PM – 12 AM)", "24-Hour Production Block"]
  },
  {
    id: "mmr-05",
    title: "Industrial Heavy-Duty Gas Ranges & Fryers",
    category: "Kitchen",
    shopName: "Metro Catering Hub",
    vendorType: "Equipment Rental Depot",
    location: "Kalyan West, Thane",
    fulfillmentType: "Site Delivery",
    pricePerDay: 3500,
    securityDeposit: 2000,
    quantityAvailable: 4,
    availabilityStatus: "Available",
    verified: true,
    rating: 4.7,
    reviewsCount: 19,
    completedRentals: 28,
    description: "Modular mobile commercial kitchen cooking bank. 4 heavy cast-iron burners with pilot ignition, twin 15L deep fat fryers, and integrated drip trays. Sanitized and tested before dispatch.",
    specifications: [
      "4-Burner High BTU Commercial Gas Range",
      "Twin 15L Double Basket Fryer Units",
      "Heavy Duty 304 Stainless Steel Body",
      "High-Pressure LPG Manifold Included",
      "Castor Wheels with Safety Floor Brakes"
    ],
    photos: [
      "https://images.unsplash.com/photo-1590725140246-20acdee442be?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=80"
    ],
    image: "https://images.unsplash.com/photo-1590725140246-20acdee442be?auto=format&fit=crop&w=1200&q=80",
    coordinates: { lat: 19.2437, lng: 73.1355 },
    instantDispatchAvailable: true,
    bookedDates: [],
    timeSlots: ["Single Day Rental", "Multi-Day Event Pack"]
  },
  {
    id: "mmr-06",
    title: "Walk-In Blast Freezer Unit (Trailer Mounted)",
    category: "Kitchen",
    shopName: "ColdChain Express Depot",
    vendorType: "Warehouse Provider",
    location: "Bhiwandi Industrial Hub",
    fulfillmentType: "Site Delivery",
    pricePerDay: 7000,
    securityDeposit: 3500,
    quantityAvailable: 1,
    availabilityStatus: "Available",
    verified: true,
    rating: 4.8,
    reviewsCount: 22,
    completedRentals: 36,
    description: "Mobile containerized blast chiller and deep freezer capable of pulling down hot banquet dishes from 70°C to -18°C in under 90 minutes. Digital HACCP temperature datalogging included.",
    specifications: [
      "-22°C Deep Freeze / -40°C Blast Mode",
      "Trailer Mounted with Towing Hitch",
      "Digital HACCP Compliance Datalogger",
      "Backup Diesel Generator Ready",
      "Internal Safety Release Panic Handle"
    ],
    photos: [
      "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80"
    ],
    image: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=80",
    coordinates: { lat: 19.2813, lng: 73.0483 },
    instantDispatchAvailable: false,
    bookedDates: [],
    timeSlots: ["24-Hour Continuous Cooling Block"]
  },

  // 3. LOGISTICS & VEHICLES
  {
    id: "mmr-07",
    title: "Refrigerated Catering Transport Van (3 Ton)",
    category: "Vehicle",
    shopName: "Apex Catering Logistics",
    vendorType: "Fleet Owner",
    location: "Anjur Phata, Bhiwandi",
    fulfillmentType: "Site Delivery",
    pricePerDay: 4500,
    securityDeposit: 2500,
    quantityAvailable: 3,
    availabilityStatus: "Available",
    verified: true,
    rating: 4.9,
    reviewsCount: 41,
    completedRentals: 64,
    description: "Insulated thermo-king reefer truck tailored for perishable catering transportation, gourmet dairy, and iced banquet desserts across Mumbai, Navi Mumbai, and Thane.",
    specifications: [
      "3-Ton Payload Insulated Container",
      "Thermo-King Chiller (0°C to +4°C)",
      "Real-Time GPS & Temperature Telematics",
      "Driver + Loading Helper Option Available",
      "24-Hour Roadside Breakdown Assistance"
    ],
    photos: [
      "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=80"
    ],
    image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80",
    coordinates: { lat: 19.2736, lng: 73.0321 },
    instantDispatchAvailable: true,
    bookedDates: ["2026-09-24", "2026-09-25", "2026-09-26"],
    timeSlots: ["Morning Shift (6 AM – 2 PM)", "Evening Shift (3 PM – 11 PM)", "Full Day (24 Hrs)"]
  },
  {
    id: "mmr-08",
    title: "7-Seater Executive Hospitality Van (Luxury MPV)",
    category: "Vehicle",
    shopName: "TransMMR Hospitality Fleet",
    vendorType: "Logistics Partner",
    location: "Panvel, Navi Mumbai",
    fulfillmentType: "Site Delivery",
    pricePerDay: 4800,
    securityDeposit: 2500,
    quantityAvailable: 2,
    availabilityStatus: "Available",
    verified: true,
    rating: 4.8,
    reviewsCount: 35,
    completedRentals: 49,
    description: "Executive 7-seater MPV with plush reclining captain seats, dual-zone AC, ambient interior lighting, and rear luggage compartment for guest airport transfers and VIP delegation transport.",
    specifications: [
      "7-Seater (Reclining Captain Chairs)",
      "Dual-Zone Climate Control AC",
      "Commercial Yellow Plate All-Maharashtra Permit",
      "Chauffeur in Uniform & Verified KYC",
      "Clean Sanitized Interior with Bottled Water"
    ],
    photos: [
      "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=1200&q=80"
    ],
    image: "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1200&q=80",
    coordinates: { lat: 18.9894, lng: 73.1175 },
    instantDispatchAvailable: true,
    bookedDates: [],
    timeSlots: ["8 Hours / 80 Km", "12 Hours / 120 Km", "Outstation 24-Hr"]
  },

  // 4. EVENT EQUIPMENT & FURNITURE
  {
    id: "mmr-09",
    title: "High-Capacity Line Array Sound & Lighting Rig",
    category: "Equipment",
    shopName: "Grand Event Supplies & Audio",
    vendorType: "Event Warehouse",
    location: "Andheri East, Mumbai",
    fulfillmentType: "Site Delivery",
    pricePerDay: 15000,
    securityDeposit: 7500,
    quantityAvailable: 2,
    availabilityStatus: "Available",
    verified: true,
    rating: 4.9,
    reviewsCount: 52,
    completedRentals: 71,
    description: "Tour-grade dual 8-inch active line array system (8 tops + 4 dual 18-inch subwoofers) paired with 16 DMX motorized moving heads and a digital 32-channel Behringer sound console.",
    specifications: [
      "15 kW RMS Line Array Tops & Subs",
      "32-Channel Digital Sound Console",
      "16 Moving Head Beam/Spot Lights + DMX",
      "Heavy Aluminium Truss Rigging Included",
      "Certified Sound Engineer on Site"
    ],
    photos: [
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1200&q=80"
    ],
    image: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80",
    coordinates: { lat: 19.1136, lng: 72.8697 },
    instantDispatchAvailable: true,
    bookedDates: ["2026-09-02", "2026-09-03", "2026-09-04"],
    timeSlots: ["Concert / Event Night (4 PM – 1 AM)", "Full 24-Hr Rig Rental"]
  },
  {
    id: "mmr-10",
    title: "Luxury Dining Tables & Banquet Chairs (Set of 200)",
    category: "Equipment",
    shopName: "Elite Furniture Depot",
    vendorType: "Rental Depot",
    location: "Dadar West, Mumbai",
    fulfillmentType: "Site Delivery",
    pricePerDay: 8500,
    securityDeposit: 3500,
    quantityAvailable: 5,
    availabilityStatus: "Available",
    verified: true,
    rating: 4.8,
    reviewsCount: 29,
    completedRentals: 44,
    description: "Gold Chiavari chairs with ivory velvet cushions and 25 round 6-seater wooden banquet tables. Complete with stain-resistant champagne satin tablecloths and runners.",
    specifications: [
      "200 Heavy Resin Gold Chiavari Chairs",
      "25 Solid Round Wooden Dining Tables (60-inch)",
      "Premium Ivory Velvet Padded Seat Cushions",
      "Champagne Satin Table Linen Included",
      "Stacked & Wrapped for Safe Transit"
    ],
    photos: [
      "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=1200&q=80"
    ],
    image: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80",
    coordinates: { lat: 19.0178, lng: 72.8478 },
    instantDispatchAvailable: true,
    bookedDates: [],
    timeSlots: ["12-Hour Event Duration", "24-Hour Rental Block"]
  },
  {
    id: "mmr-11",
    title: "Outdoor Waterproof German Canopy Tents (50x30ft)",
    category: "Equipment",
    shopName: "Suburban Tent & Decor House",
    vendorType: "Event Decorator",
    location: "Dombivli East, Thane",
    fulfillmentType: "Site Delivery",
    pricePerDay: 11000,
    securityDeposit: 5000,
    quantityAvailable: 2,
    availabilityStatus: "Booked",
    verified: true,
    rating: 4.7,
    reviewsCount: 23,
    completedRentals: 37,
    description: "Heavy-duty aluminum framed German pagoda canopy marquee. 100% waterproof, flame retardant, and rated to withstand monsoon gusts up to 80 km/h.",
    specifications: [
      "50 x 30 Feet Heavy Aluminium Pagoda Frame",
      "650 GSM PVC Waterproof & Fire-Retardant Fabric",
      "Side Flaps with Transparent French Windows",
      "Includes Anchoring Hardware & Riggers",
      "Quick 3-Hour Assembly Time"
    ],
    photos: [
      "https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80"
    ],
    image: "https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=1200&q=80",
    coordinates: { lat: 19.2184, lng: 73.0867 },
    instantDispatchAvailable: false,
    bookedDates: ["2026-09-28", "2026-09-29", "2026-09-30"],
    timeSlots: ["Full Day Setup & Event"]
  },
  {
    id: "mmr-12",
    title: "Silent Diesel Generator Unit (125 kVA)",
    category: "Equipment",
    shopName: "PowerGrid Events Solutions",
    vendorType: "Power Equipment Depot",
    location: "Vasai East, Extended MMR",
    fulfillmentType: "Site Delivery",
    pricePerDay: 5000,
    securityDeposit: 2500,
    quantityAvailable: 3,
    availabilityStatus: "Available",
    verified: true,
    rating: 4.9,
    reviewsCount: 46,
    completedRentals: 62,
    description: "Acoustic canopy enclosed 125 kVA Cummins powered diesel generator. Operates at under 65 dBA noise level, with automatic changeover switch (AMF panel) and on-board diesel tank for 12 continuous hours.",
    specifications: [
      "125 kVA / 100 kW 3-Phase Continuous Output",
      "Ultra-Silent Acoustic Canopy (<65 dBA at 1m)",
      "Automatic Mains Failure (AMF) Panel Included",
      "12-Hour Continuous Run Fuel Tank Capacity",
      "Delivered with Licensed Electrical Technician"
    ],
    photos: [
      "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=80"
    ],
    image: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80",
    coordinates: { lat: 19.3919, lng: 72.8397 },
    instantDispatchAvailable: true,
    bookedDates: [],
    timeSlots: ["12-Hour Event Duty", "24-Hour Emergency Standby"]
  }
];

const INITIAL_REQUESTS = [
  {
    id: "REQ-8091",
    assetId: "mmr-01",
    assetTitle: "500-Seater Banquet & Outdoor Lawn",
    seekerBusiness: "Taj Lands End Banquets",
    seekerContact: "events@tajhotels.com",
    seekerRating: 4.9,
    seekerLocation: "Bandra West, Mumbai",
    startDate: "2026-09-12",
    endDate: "2026-09-15",
    days: 3,
    timeSlot: "Full Day (24 Hrs)",
    dailyRate: 25000,
    totalAmount: 75000,
    tokenAmount: 15000, // 20%
    escrowDeposit: 10000,
    bookingMode: "Planned Advance",
    deliveryMode: "In-Store Pickup",
    deliveryFee: 0,
    deliveryLocation: "Lower Parel, Mumbai",
    status: "Approved",
    paymentStatus: "Paid (Token Verified)",
    paymentMethod: "UPI (HDFC Bank)",
    notes: "International Corporate Diamond Gala. 20% Token payment verified via escrow. Calendar locked.",
    auditStatus: "Pending Dispatch",
    history: [
      { sender: "seeker", type: "offer", amount: 75000, date: "2026-09-01", message: "Standard booking request with 20% token deposit." },
      { sender: "provider", type: "accept", amount: 75000, date: "2026-09-02", message: "Booking accepted. Dates locked on calendar." }
    ]
  },
  {
    id: "REQ-8092",
    assetId: "mmr-04",
    assetTitle: "Commercial Bulk Kitchen Setup & Cold Storage",
    seekerBusiness: "Apex Gourmet Catering",
    seekerContact: "kitchen.ops@apexcatering.in",
    seekerRating: 4.8,
    seekerLocation: "Ghatkopar West, Mumbai",
    startDate: "2026-09-08",
    endDate: "2026-09-10",
    days: 2,
    timeSlot: "Shift A (4 AM – 2 PM)",
    dailyRate: 12000,
    totalAmount: 24000,
    tokenAmount: 4800,
    escrowDeposit: 5000,
    bookingMode: "Emergency Dispatch",
    deliveryMode: "Site Delivery",
    deliveryFee: 650,
    deliveryLocation: "Ghatkopar West, Mumbai",
    status: "Approved",
    paymentStatus: "Paid (Token Verified)",
    paymentMethod: "Credit Card (Visa Business)",
    notes: "Emergency 45-min fast-track delivery. Pre-pickup photo checklist signed off.",
    auditStatus: "Pre-Pickup Verified",
    history: [
      { sender: "seeker", type: "emergency", amount: 24650, date: "2026-09-07", message: "Urgent catering production overflow." }
    ]
  },
  {
    id: "REQ-8093",
    assetId: "mmr-07",
    assetTitle: "Refrigerated Catering Transport Van (3 Ton)",
    seekerBusiness: "Gourmet Symphony Caterers",
    seekerContact: "logistics@gourmetsymphony.com",
    seekerRating: 4.7,
    seekerLocation: "Jio World Convention Centre, BKC",
    startDate: "2026-09-24",
    endDate: "2026-09-26",
    days: 2,
    timeSlot: "Full Day (24 Hrs)",
    dailyRate: 4500,
    totalAmount: 9000,
    tokenAmount: 1800,
    escrowDeposit: 2500,
    bookingMode: "Planned Advance",
    deliveryMode: "Site Delivery (Round-Trip -20%)",
    deliveryFee: 1120,
    deliveryLocation: "Jio World Convention Centre, BKC",
    status: "Negotiating",
    negotiationOffer: 8000,
    seekerOffer: 7500,
    providerCounter: 8000,
    paymentStatus: "Pending Negotiation",
    notes: "Provider counter-offered ₹8,000 for 2 days. Awaiting seeker confirmation.",
    auditStatus: "Pending Dispatch",
    history: [
      { sender: "seeker", type: "offer", amount: 7500, date: "2026-09-20", message: "Seeking ₹7,500 package deal for 2-day catering delivery." },
      { sender: "provider", type: "counter", amount: 8000, date: "2026-09-21", message: "We can do ₹8,000 inclusive of round-trip driver allowance." }
    ]
  },
  {
    id: "REQ-8094",
    assetId: "mmr-09",
    assetTitle: "High-Capacity Line Array Sound & Lighting Rig",
    seekerBusiness: "Royal Zenith Events & Staging",
    seekerContact: "production@zenithevents.com",
    seekerRating: 4.9,
    seekerLocation: "Andheri East, Mumbai",
    startDate: "2026-09-02",
    endDate: "2026-09-04",
    days: 2,
    timeSlot: "Concert / Event Night (4 PM – 1 AM)",
    dailyRate: 15000,
    totalAmount: 30000,
    tokenAmount: 6000,
    escrowDeposit: 7500,
    bookingMode: "Planned Advance",
    deliveryMode: "Site Delivery",
    deliveryFee: 780,
    deliveryLocation: "Andheri East Exhibition Grounds",
    status: "Completed",
    paymentStatus: "Settled & Escrow Released",
    paymentMethod: "Net Banking (ICICI Bank)",
    notes: "Post-event return completed. Escrow deposit released.",
    auditStatus: "Post-Return Inspected",
    history: [
      { sender: "seeker", type: "offer", amount: 30000, date: "2026-08-28", message: "Confirmed booking with sound technician." },
      { sender: "provider", type: "accept", amount: 30000, date: "2026-08-29", message: "Sound rig dispatched and verified." }
    ]
  }
];

const DEMO_USERS = [
  {
    businessName: "Imperial Banquets & Hospitality Ltd",
    email: "procurement@imperialbanquets.in",
    businessType: "Hotel & Resort",
    role: "Provider & Seeker",
    location: "Lower Parel, Mumbai",
    verified: true,
    rating: 4.9,
    reviewsCount: 38,
    contactPhone: "+91 98200 12345",
    completedRentals: 42
  },
  {
    businessName: "Metro Catering Logistics Network",
    email: "fleet@metrocatering.in",
    businessType: "Catering Enterprise",
    role: "Provider",
    location: "Kalyan West, Thane",
    verified: true,
    rating: 4.8,
    reviewsCount: 29,
    contactPhone: "+91 98211 54321",
    completedRentals: 34
  },
  {
    businessName: "Grand Event Supplies & Audio",
    email: "production@grandevents.in",
    businessType: "Event Planner & Production",
    role: "Seeker",
    location: "Andheri East, Mumbai",
    verified: true,
    rating: 4.9,
    reviewsCount: 52,
    contactPhone: "+91 98222 98765",
    completedRentals: 58
  }
];

// Universal browser & Node exports
if (typeof window !== 'undefined') {
  window.MMR_CLIENT_ORIGIN = MMR_CLIENT_ORIGIN;
  window.MMR_REGIONS = MMR_REGIONS;
  window.CATEGORIES = CATEGORIES;
  window.BUSINESS_TYPES = BUSINESS_TYPES;
  window.inventoryData = inventoryData;
  window.INITIAL_REQUESTS = INITIAL_REQUESTS;
  window.DEMO_USERS = DEMO_USERS;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MMR_CLIENT_ORIGIN,
    MMR_REGIONS,
    CATEGORIES,
    BUSINESS_TYPES,
    inventoryData,
    INITIAL_REQUESTS,
    DEMO_USERS
  };
}
