/**
 * HospitaLink B2B Hospitality Resource Exchange
 * React + Bootstrap + React-Bootstrap Full-Stack Controller
 * 
 * Multi-User System with Real-Time REST API Sync, MongoDB Atlas Cloud Support,
 * Dual-Mode Booking, 3PL Logistics Calculator, Smart Calendar Lock,
 * 3-Way Counter Negotiation, 2-Step Condition Audit, and ROI Fleet Simulator.
 */

const { useState, useEffect, useMemo, useCallback, useRef } = React;

// Fallback Depot Coordinates (BKC Central Logistics Depot)
const MMR_DEPOT_COORDS = { lat: 19.0674, lng: 72.8687 };

// API Endpoint Base
const API_BASE = (typeof window !== 'undefined' && window.location.origin && window.location.origin.startsWith('http'))
  ? (window.location.port === '3001' || !window.location.port ? '/api' : 'http://localhost:3001/api')
  : 'http://localhost:3001/api';

// Verified Image Safe Fallback
function getSafeImageUrl(imgUrl, category = "Venue") {
  if (!imgUrl || typeof imgUrl !== 'string' || imgUrl.includes('photo-1545232979-fbfd43e1d1eb')) {
    return 'https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=800&q=80';
  }
  return imgUrl;
}

// Great-Circle Distance Calculation (Haversine Formula)
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 6.5;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// 3PL Logistics Fare Calculator with 20% Return Leg Discount
function calculateLogisticsFare(distanceKm, isRoundTrip) {
  const baseFare = 350;
  const perKm = 25;
  const oneWay = baseFare + Math.round(distanceKm * perKm);
  return isRoundTrip ? Math.round(oneWay * 2 * 0.80) : oneWay;
}

// Coordinate lookup for MMR locations
const MMR_COORDS_MAP = {
  "Lower Parel, Mumbai": { lat: 18.9986, lng: 72.8311 },
  "Andheri East, Mumbai": { lat: 19.1136, lng: 72.8697 },
  "Dadar West, Mumbai": { lat: 19.0178, lng: 72.8478 },
  "Ghatkopar West, Mumbai": { lat: 19.0860, lng: 72.9090 },
  "Majiwada, Thane": { lat: 19.2132, lng: 72.9774 },
  "Dombivli East, Thane": { lat: 19.2183, lng: 73.0867 },
  "Kalyan West, Thane": { lat: 19.2437, lng: 73.1355 },
  "Vashi, Navi Mumbai": { lat: 19.0771, lng: 72.9986 },
  "Panvel, Navi Mumbai": { lat: 18.9894, lng: 73.1175 },
  "Bhiwandi Industrial Hub": { lat: 19.2967, lng: 73.0631 },
  "Anjur Phata, Bhiwandi": { lat: 19.2814, lng: 73.0489 },
  "Vasai East, Extended MMR": { lat: 19.3919, lng: 72.8397 }
};

// =========================================================================
// MAIN REACT COMPONENT: HospitaLinkApp
// =========================================================================
function HospitaLinkApp() {
  // Theme state
  const [theme, setTheme] = useState(() => localStorage.getItem('hospitalink_theme') || 'light');
  
  // Navigation / View state ('seeker' | 'provider')
  const [currentView, setCurrentView] = useState('seeker');
  const [providerTab, setProviderTab] = useState('pipeline'); // 'pipeline' | 'fleet' | 'sent' | 'calendar' | 'roi'

  // User state
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = localStorage.getItem('hospitalink_current_user');
      if (stored) return JSON.parse(stored);
      return (window.DEMO_USERS && window.DEMO_USERS[0]) || {
        businessName: "Imperial Banquets & Hospitality Ltd",
        email: "procurement@imperialbanquets.in",
        businessType: "Hotel & Resort",
        role: "Provider & Seeker",
        location: "Lower Parel, Mumbai",
        verified: true
      };
    } catch {
      return null;
    }
  });

  // Resources (Inventory) & Requests state
  const [inventory, setInventory] = useState(() => {
    try {
      const stored = localStorage.getItem('hospitalink_inventory_mmr_v3') || localStorage.getItem('resources');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      return window.inventoryData || [];
    } catch {
      return window.inventoryData || [];
    }
  });

  const [requests, setRequests] = useState(() => {
    try {
      const stored = localStorage.getItem('hospitalink_requests_mmr_v3');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      return window.INITIAL_REQUESTS || [];
    } catch {
      return window.INITIAL_REQUESTS || [];
    }
  });

  // Filter Toolbar state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedRadius, setSelectedRadius] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [selectedPriceRange, setSelectedPriceRange] = useState('all');
  const [selectedFulfillment, setSelectedFulfillment] = useState('all');
  const [sortBy, setSortBy] = useState('featured');
  const [emergencyMode, setEmergencyMode] = useState(false);

  // Modals state
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authTab, setAuthTab] = useState('login'); // 'login' | 'register'
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [rentalModalAsset, setRentalModalAsset] = useState(null);
  const [listModalAsset, setListModalAsset] = useState(null); // null = new, object = edit
  const [negotiateModalReq, setNegotiateModalReq] = useState(null);
  const [auditModalReq, setAuditModalReq] = useState(null);
  const [auditStep, setAuditStep] = useState(1);
  const [quickViewAsset, setQuickViewAsset] = useState(null);

  // ROI Calculator state
  const [roiAssets, setRoiAssets] = useState(2);
  const [roiDays, setRoiDays] = useState(12);
  const [roiRate, setRoiRate] = useState(15000);

  // Toast Stack state
  const [toasts, setToasts] = useState([]);

  // Toast Helper
  const showToast = useCallback(({ title, message, type = 'info' }) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  // Hydrate Lucide Icons on DOM updates
  useEffect(() => {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  });

  // Apply theme to document element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('hospitalink_theme', theme);
  }, [theme]);

  // Sync with Backend REST API on mount and user change
  const syncFromBackend = useCallback(async () => {
    try {
      const email = currentUser?.email || '';
      const [resResources, resRequests] = await Promise.allSettled([
        fetch(`${API_BASE}/resources`).then(r => r.ok ? r.json() : null),
        fetch(email ? `${API_BASE}/requests?email=${encodeURIComponent(email)}` : `${API_BASE}/requests`, {
          headers: { 'x-user-email': email }
        }).then(r => r.ok ? r.json() : null)
      ]);

      if (resResources.status === 'fulfilled' && Array.isArray(resResources.value) && resResources.value.length > 0) {
        setInventory(resResources.value);
        localStorage.setItem('hospitalink_inventory_mmr_v3', JSON.stringify(resResources.value));
        localStorage.setItem('resources', JSON.stringify(resResources.value));
      }

      if (resRequests.status === 'fulfilled' && Array.isArray(resRequests.value)) {
        setRequests(resRequests.value);
        localStorage.setItem('hospitalink_requests_mmr_v3', JSON.stringify(resRequests.value));
      }
    } catch (err) {
      console.warn('Backend REST API sync notice:', err);
    }
  }, [currentUser]);

  useEffect(() => {
    syncFromBackend();
  }, [syncFromBackend]);

  // Persist Current User changes
  const handleSetCurrentUser = useCallback((user) => {
    setCurrentUser(user);
    if (user) {
      localStorage.setItem('hospitalink_current_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('hospitalink_current_user');
    }
  }, []);

  // Theme Toggle
  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  }, []);

  // View Switch
  const handleSwitchView = useCallback((view) => {
    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Emergency Mode Toggle
  const toggleEmergencyMode = useCallback(() => {
    setEmergencyMode(prev => {
      const next = !prev;
      if (next) {
        setSelectedRadius("10");
        showToast({
          title: "⚡ Emergency Dispatch Activated",
          message: "Filtered strictly to instant 30-60 min dispatch assets within 10 km radius.",
          type: "warning"
        });
      } else {
        setSelectedRadius("all");
        showToast({
          title: "Marketplace Standard Mode",
          message: "Displaying full catalog across all MMR regions.",
          type: "info"
        });
      }
      return next;
    });
  }, [showToast]);

  // Reset Filters
  const handleResetFilters = useCallback(() => {
    setSearchQuery('');
    setActiveCategory('all');
    setSelectedRadius('all');
    setSelectedLocation('all');
    setSelectedPriceRange('all');
    setSelectedFulfillment('all');
    setSortBy('featured');
    setEmergencyMode(false);
    showToast({ title: "Filters Cleared", message: "Marketplace view reset to full MMR inventory.", type: "info" });
  }, [showToast]);

  // =========================================================================
  // API MUTATION HANDLERS
  // =========================================================================

  // 1. Auth: Login
  const handleLoginSubmit = async (email, password) => {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail) return;

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: password || 'demo-password' })
      });
      const data = await res.json();
      if (data.user) {
        handleSetCurrentUser(data.user);
        setAuthModalOpen(false);
        showToast({ title: "Login Successful", message: `Signed in as ${data.user.businessName}`, type: "success" });
        return;
      }
    } catch (e) {
      console.warn('API fallback login:', e);
    }

    // Local fallback user creation
    const defaultName = cleanEmail.split('@')[0].replace('.', ' ').toUpperCase() + " ENTERPRISE";
    const user = {
      businessName: defaultName,
      email: cleanEmail,
      businessType: "Hotel & Resort",
      role: "Provider & Seeker",
      location: "Lower Parel, Mumbai",
      verified: true
    };
    handleSetCurrentUser(user);
    setAuthModalOpen(false);
    showToast({ title: "Login Successful", message: `Signed in as ${user.businessName}`, type: "success" });
  };

  // 2. Auth: Register
  const handleRegisterSubmit = async (userData) => {
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      const data = await res.json();
      if (data.user) {
        handleSetCurrentUser(data.user);
        setAuthModalOpen(false);
        showToast({ title: "Registration Approved", message: `Organization ${data.user.businessName} verified on MMR Exchange.`, type: "success" });
        return;
      }
    } catch (e) {
      console.warn('API fallback register:', e);
    }

    handleSetCurrentUser(userData);
    setAuthModalOpen(false);
    showToast({ title: "Registration Approved", message: `Organization ${userData.businessName} verified on MMR Exchange.`, type: "success" });
  };

  // 3. Auth: Demo User Quick Sign-In
  const handleLoginDemo = async (index) => {
    const demoUsers = window.DEMO_USERS || [];
    const user = demoUsers[index] || {
      businessName: "Imperial Banquets & Hospitality Ltd",
      email: "procurement@imperialbanquets.in",
      businessType: "Hotel & Resort",
      role: "Provider & Seeker",
      location: "Lower Parel, Mumbai",
      verified: true
    };
    handleSetCurrentUser(user);
    setAuthModalOpen(false);
    showToast({ title: "Enterprise Session Verified", message: `Welcome back, ${user.businessName}. Authorized for MMR trading grid.`, type: "success" });

    try {
      await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email })
      });
    } catch (err) {
      console.warn('Demo login API sync:', err);
    }
  };

  // 4. Auth: Update Profile
  const handleUpdateProfile = async (updateFields) => {
    const updated = { ...currentUser, ...updateFields };
    handleSetCurrentUser(updated);
    setProfileModalOpen(false);
    showToast({ title: "Profile Updated", message: "Business details and location saved successfully.", type: "success" });

    try {
      await fetch(`${API_BASE}/auth/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentUser.email, ...updateFields })
      });
    } catch (err) {
      console.warn('Profile update API sync:', err);
    }
  };

  // 5. Auth: Logout
  const handleLogout = () => {
    handleSetCurrentUser(null);
    showToast({ title: "Session Terminated", message: "You have signed out from the enterprise portal.", type: "info" });
  };

  // 6. Resource: Create / Update
  const handleSaveResource = async (resourceData, editId) => {
    const ownerEmail = (currentUser?.email || "procurement@imperialbanquets.in").toLowerCase();
    const coords = MMR_COORDS_MAP[resourceData.location] || MMR_DEPOT_COORDS;

    if (editId) {
      // Update
      const updatedList = inventory.map(item => {
        if (item.id === editId) {
          return { ...item, ...resourceData, coordinates: coords, ownerEmail: item.ownerEmail || ownerEmail };
        }
        return item;
      });
      setInventory(updatedList);
      localStorage.setItem('hospitalink_inventory_mmr_v3', JSON.stringify(updatedList));
      localStorage.setItem('resources', JSON.stringify(updatedList));
      setListModalAsset(null);
      showToast({ title: "Asset Updated", message: `"${resourceData.title}" details updated successfully.`, type: "success" });

      try {
        await fetch(`${API_BASE}/resources/${encodeURIComponent(editId)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-user-email': ownerEmail },
          body: JSON.stringify({ ...resourceData, coordinates: coords, ownerEmail })
        });
      } catch (err) {
        console.warn('Update resource API sync:', err);
      }
    } else {
      // Create
      const newAsset = {
        id: `mmr-${Date.now()}`,
        ownerEmail: ownerEmail,
        ...resourceData,
        coordinates: coords
      };
      const updatedList = [newAsset, ...inventory];
      setInventory(updatedList);
      localStorage.setItem('hospitalink_inventory_mmr_v3', JSON.stringify(updatedList));
      localStorage.setItem('resources', JSON.stringify(updatedList));
      setListModalAsset(null);
      showToast({ title: "Asset Published to MMR Grid", message: `${newAsset.title} is now discoverable across the B2B exchange.`, type: "success" });

      try {
        await fetch(`${API_BASE}/resources`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-email': ownerEmail },
          body: JSON.stringify(newAsset)
        });
      } catch (err) {
        console.warn('Create resource API sync:', err);
      }
    }
  };

  // 7. Resource: Delete
  const handleDeleteResource = async (id) => {
    const item = inventory.find(a => a.id === id);
    const itemName = item ? item.title : id;
    if (!window.confirm(`Are you sure you want to remove "${itemName}" from your listed fleet?`)) {
      return;
    }

    const updatedList = inventory.filter(a => a.id !== id);
    setInventory(updatedList);
    localStorage.setItem('hospitalink_inventory_mmr_v3', JSON.stringify(updatedList));
    localStorage.setItem('resources', JSON.stringify(updatedList));
    showToast({ title: "Resource Deleted", message: `"${itemName}" was removed from inventory.`, type: "info" });

    try {
      await fetch(`${API_BASE}/resources/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'x-user-email': currentUser?.email || '' }
      });
    } catch (err) {
      console.warn('Delete resource API sync:', err);
    }
  };

  // 8. Resource: Toggle Availability Status
  const handleToggleAvailability = async (id) => {
    const item = inventory.find(a => a.id === id);
    if (!item) return;

    const nextStatus = item.availabilityStatus === 'Available' ? 'Booked' : 'Available';
    const updatedList = inventory.map(a => a.id === id ? { ...a, availabilityStatus: nextStatus } : a);
    setInventory(updatedList);
    localStorage.setItem('hospitalink_inventory_mmr_v3', JSON.stringify(updatedList));
    localStorage.setItem('resources', JSON.stringify(updatedList));
    showToast({ title: "Availability Toggled", message: `${item.title} is now marked as ${nextStatus}.`, type: "info" });

    try {
      await fetch(`${API_BASE}/resources/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-user-email': currentUser?.email || '' },
        body: JSON.stringify({ availabilityStatus: nextStatus })
      });
    } catch (err) {
      console.warn('Toggle avail API sync:', err);
    }
  };

  // 9. Booking: Create Request & Lock Calendar
  const handleCreateBooking = async (bookingData) => {
    const newRequestId = `REQ-${Math.floor(1000 + Math.random() * 9000)}`;
    const asset = inventory.find(a => a.id === bookingData.assetId);
    const providerEmail = (asset?.ownerEmail || "procurement@imperialbanquets.in").toLowerCase();
    const seekerEmail = (currentUser?.email || "events@tajhotels.com").toLowerCase();

    // Prevent double booking
    if (asset && asset.availabilityStatus === 'Booked') {
      showToast({ title: "Double-Booking Blocked", message: "This asset is already booked for these dates.", type: "warning" });
      return;
    }

    const newRequest = {
      id: newRequestId,
      assetId: bookingData.assetId,
      assetTitle: asset ? asset.title : 'Hospitality Resource',
      providerEmail: providerEmail,
      seekerEmail: seekerEmail,
      seekerBusiness: currentUser?.businessName || "Taj Lands End Banquets",
      seekerContact: seekerEmail,
      startDate: bookingData.startDate,
      endDate: bookingData.endDate,
      days: bookingData.days,
      dailyRate: asset ? asset.pricePerDay : 15000,
      totalAmount: bookingData.grandTotal,
      tokenAmount: bookingData.tokenAmount,
      escrowDeposit: bookingData.escrowDeposit,
      bookingMode: bookingData.bookingMode === 'emergency' ? 'Emergency Dispatch' : 'Planned Advance',
      deliveryMode: bookingData.isDelivery ? (bookingData.isRoundTrip ? 'Site Delivery (Round-Trip -20%)' : 'Site Delivery') : 'In-Store Pickup',
      deliveryFee: bookingData.logisticsFee,
      deliveryLocation: bookingData.deliveryAddress,
      status: "Approved",
      notes: bookingData.bookingMode === 'emergency'
        ? "⚡ Emergency 30-60 min dispatch contract activated."
        : `20% Token Amount (₹${bookingData.tokenAmount.toLocaleString('en-IN')}) verified via platform escrow. Calendar frozen.`,
      auditStatus: "Pending Dispatch"
    };

    // Smart calendar lock: mark asset as Booked
    const updatedInventory = inventory.map(a => a.id === bookingData.assetId ? { ...a, availabilityStatus: 'Booked' } : a);
    setInventory(updatedInventory);
    localStorage.setItem('hospitalink_inventory_mmr_v3', JSON.stringify(updatedInventory));
    localStorage.setItem('resources', JSON.stringify(updatedInventory));

    const updatedRequests = [newRequest, ...requests];
    setRequests(updatedRequests);
    localStorage.setItem('hospitalink_requests_mmr_v3', JSON.stringify(updatedRequests));

    setRentalModalAsset(null);

    if (bookingData.bookingMode === 'emergency') {
      showToast({
        title: "⚡ Emergency Dispatch Confirmed!",
        message: `Booking ${newRequestId} dispatched! 3PL driver en route. Calendar locked for ${asset?.title}.`,
        type: "success"
      });
    } else {
      showToast({
        title: "Date Locked with 20% Token!",
        message: `Received ₹${bookingData.tokenAmount.toLocaleString('en-IN')} token. Calendar frozen to prevent double-booking.`,
        type: "success"
      });
    }

    try {
      await fetch(`${API_BASE}/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-email': seekerEmail },
        body: JSON.stringify(newRequest)
      });
    } catch (err) {
      console.warn('Create request API sync:', err);
    }
  };

  // 10. Workflow: Accept Request
  const handleAcceptRequest = async (reqId) => {
    const target = requests.find(r => r.id === reqId);
    if (!target) return;

    const updatedRequests = requests.map(r => r.id === reqId ? { ...r, status: 'Approved' } : r);
    setRequests(updatedRequests);
    localStorage.setItem('hospitalink_requests_mmr_v3', JSON.stringify(updatedRequests));

    // Ensure asset calendar is locked
    const updatedInventory = inventory.map(a => a.id === target.assetId ? { ...a, availabilityStatus: 'Booked' } : a);
    setInventory(updatedInventory);
    localStorage.setItem('hospitalink_inventory_mmr_v3', JSON.stringify(updatedInventory));

    showToast({
      title: "Request Approved & Calendar Locked",
      message: `${reqId} confirmed. Security escrow held. Asset calendar frozen against double-booking.`,
      type: "success"
    });

    try {
      await fetch(`${API_BASE}/requests/${encodeURIComponent(reqId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-email': currentUser?.email || '' },
        body: JSON.stringify({ status: 'Approved' })
      });
    } catch (err) {
      console.warn('Accept request API sync:', err);
    }
  };

  // 11. Workflow: Reject Request
  const handleRejectRequest = async (reqId) => {
    const target = requests.find(r => r.id === reqId);
    if (!target) return;

    const updatedRequests = requests.map(r => r.id === reqId ? { ...r, status: 'Rejected' } : r);
    setRequests(updatedRequests);
    localStorage.setItem('hospitalink_requests_mmr_v3', JSON.stringify(updatedRequests));

    // Release asset availability if no other confirmed bookings
    const otherConfirmed = updatedRequests.some(r => r.assetId === target.assetId && r.id !== reqId && (r.status === 'Approved' || r.status === 'Confirmed'));
    if (!otherConfirmed) {
      const updatedInventory = inventory.map(a => a.id === target.assetId ? { ...a, availabilityStatus: 'Available' } : a);
      setInventory(updatedInventory);
      localStorage.setItem('hospitalink_inventory_mmr_v3', JSON.stringify(updatedInventory));
    }

    showToast({
      title: "Booking Rejected",
      message: `Request ${reqId} declined. Asset returned to available inventory.`,
      type: "info"
    });

    try {
      await fetch(`${API_BASE}/requests/${encodeURIComponent(reqId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-email': currentUser?.email || '' },
        body: JSON.stringify({ status: 'Rejected' })
      });
    } catch (err) {
      console.warn('Reject request API sync:', err);
    }
  };

  // 12. Workflow: Submit Negotiation Counter-Offer
  const handleNegotiateSubmit = async (reqId, counterPrice, counterMessage) => {
    const notes = `Counter-Offer: ₹${counterPrice.toLocaleString('en-IN')} | Terms: ${counterMessage}`;
    const updatedRequests = requests.map(r => r.id === reqId ? { ...r, status: 'Negotiating', negotiationOffer: counterPrice, notes } : r);
    setRequests(updatedRequests);
    localStorage.setItem('hospitalink_requests_mmr_v3', JSON.stringify(updatedRequests));
    setNegotiateModalReq(null);

    showToast({
      title: "Counter-Offer Dispatched",
      message: `Counter-offer of ₹${counterPrice.toLocaleString('en-IN')} transmitted.`,
      type: "success"
    });

    try {
      await fetch(`${API_BASE}/requests/${encodeURIComponent(reqId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-email': currentUser?.email || '' },
        body: JSON.stringify({ status: 'Negotiating', negotiationOffer: counterPrice, notes })
      });
    } catch (err) {
      console.warn('Negotiate request API sync:', err);
    }
  };

  // 13. Workflow: Submit Condition Audit Sign-Off
  const handleAuditSubmit = async () => {
    const req = auditModalReq;
    if (!req) return;

    if (auditStep === 1) {
      // Step 1: Pre-Dispatch Verification
      const updatedRequests = requests.map(r => r.id === req.id ? { ...r, auditStatus: "Pre-Pickup Verified" } : r);
      setRequests(updatedRequests);
      localStorage.setItem('hospitalink_requests_mmr_v3', JSON.stringify(updatedRequests));
      showToast({
        title: "Pre-Dispatch Audit Certified",
        message: "Photo inspection stamped with GPS signature. Logistics driver cleared for pickup.",
        type: "success"
      });
      setAuditStep(2);

      try {
        await fetch(`${API_BASE}/requests/${encodeURIComponent(req.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'x-user-email': currentUser?.email || '' },
          body: JSON.stringify({ auditStatus: "Pre-Pickup Verified" })
        });
      } catch (err) {
        console.warn('Audit step 1 API sync:', err);
      }
    } else {
      // Step 2: Post-Return Escrow Release & Completion
      const updatedRequests = requests.map(r => r.id === req.id ? { ...r, auditStatus: "Escrow Released & Completed", status: "Completed" } : r);
      setRequests(updatedRequests);
      localStorage.setItem('hospitalink_requests_mmr_v3', JSON.stringify(updatedRequests));

      // Release asset to Available
      const updatedInventory = inventory.map(a => a.id === req.assetId ? { ...a, availabilityStatus: 'Available' } : a);
      setInventory(updatedInventory);
      localStorage.setItem('hospitalink_inventory_mmr_v3', JSON.stringify(updatedInventory));

      setAuditModalReq(null);
      showToast({
        title: "Escrow Deposit Released",
        message: `₹${(req.escrowDeposit || 12500).toLocaleString('en-IN')} escrow credited back to Seeker. Asset marked Available.`,
        type: "success"
      });

      try {
        await fetch(`${API_BASE}/requests/${encodeURIComponent(req.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'x-user-email': currentUser?.email || '' },
          body: JSON.stringify({ auditStatus: "Escrow Released & Completed", status: "Completed" })
        });
      } catch (err) {
        console.warn('Audit step 2 API sync:', err);
      }
    }
  };

  // 14. Reset / Reload Default MMR Fleet
  const handleReloadDefaultFleet = async () => {
    const def = window.inventoryData || [];
    setInventory(JSON.parse(JSON.stringify(def)));
    localStorage.setItem('hospitalink_inventory_mmr_v3', JSON.stringify(def));
    localStorage.setItem('resources', JSON.stringify(def));
    showToast({ title: "Default MMR Fleet Loaded", message: "Restored 12 verified standard MMR hospitality assets.", type: "success" });

    try {
      await fetch(`${API_BASE}/reset-fleet`, { method: 'POST' });
    } catch (err) {
      console.warn('Reset fleet API sync:', err);
    }
  };

  // =========================================================================
  // FILTERED DATA CALCULATIONS
  // =========================================================================

  // Filtered Public Marketplace Listings
  const filteredMarketplaceListings = useMemo(() => {
    return inventory.filter(asset => {
      // Emergency mode filter: only instant dispatch within proximity
      if (emergencyMode && !asset.instantDispatchAvailable) return false;

      // Category filter
      if (activeCategory !== 'all' && asset.category !== activeCategory) return false;

      // Location filter
      if (selectedLocation !== 'all' && asset.location !== selectedLocation) return false;

      // Fulfillment filter
      if (selectedFulfillment !== 'all' && asset.fulfillmentType !== selectedFulfillment) return false;

      // Price filter
      if (selectedPriceRange === 'under-10k' && asset.pricePerDay >= 10000) return false;
      if (selectedPriceRange === '10k-25k' && (asset.pricePerDay < 10000 || asset.pricePerDay > 25000)) return false;
      if (selectedPriceRange === 'above-25k' && asset.pricePerDay <= 25000) return false;

      // Distance calculation from BKC Depot
      const coords = asset.coordinates || MMR_DEPOT_COORDS;
      const dist = calculateDistanceKm(MMR_DEPOT_COORDS.lat, MMR_DEPOT_COORDS.lng, coords.lat, coords.lng);
      asset._distanceKm = dist;

      // Radius filter
      if (selectedRadius !== 'all') {
        const maxDist = parseFloat(selectedRadius);
        if (dist > maxDist) return false;
      }

      // Search query filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (asset.title || '').toLowerCase().includes(q);
        const matchShop = (asset.shopName || '').toLowerCase().includes(q);
        const matchCategory = (asset.category || '').toLowerCase().includes(q);
        const matchLocation = (asset.location || '').toLowerCase().includes(q);
        if (!matchTitle && !matchShop && !matchCategory && !matchLocation) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'price-low') return a.pricePerDay - b.pricePerDay;
      if (sortBy === 'price-high') return b.pricePerDay - a.pricePerDay;
      if (sortBy === 'proximity') return (a._distanceKm || 0) - (b._distanceKm || 0);
      return 0; // featured default
    });
  }, [inventory, emergencyMode, activeCategory, selectedLocation, selectedFulfillment, selectedPriceRange, selectedRadius, searchQuery, sortBy]);

  // User-Specific Provider Fleet & Requests (Multi-User Separation)
  const userEmail = (currentUser?.email || "procurement@imperialbanquets.in").toLowerCase();
  const isDemoUser = userEmail === "procurement@imperialbanquets.in";

  const userFleet = useMemo(() => {
    return inventory.filter(a => {
      if (isDemoUser) {
        return !a.ownerEmail || a.ownerEmail.toLowerCase() === userEmail;
      }
      return a.ownerEmail && a.ownerEmail.toLowerCase() === userEmail;
    });
  }, [inventory, isDemoUser, userEmail]);

  const userIncomingRequests = useMemo(() => {
    return requests.filter(req => {
      if (isDemoUser) return true;
      const pEmail = (req.providerEmail || '').toLowerCase();
      return pEmail === userEmail;
    });
  }, [requests, isDemoUser, userEmail]);

  const userSeekerRequests = useMemo(() => {
    return requests.filter(req => {
      const sEmail = (req.seekerEmail || '').toLowerCase();
      return sEmail === userEmail;
    });
  }, [requests, userEmail]);

  // Provider KPIs
  const providerKpis = useMemo(() => {
    let rev = 0;
    let pending = 0;
    let active = 0;

    userIncomingRequests.forEach(r => {
      if (r.status === 'Approved' || r.status === 'Confirmed' || r.status === 'Completed') {
        rev += (r.totalAmount || 0);
        active++;
      } else if (r.status === 'Pending' || r.status === 'Negotiating') {
        pending++;
      }
    });

    const baseRev = isDemoUser ? 284500 : 0;
    const totalAssets = userFleet.length;
    const bookedCount = userFleet.filter(a => a.availabilityStatus === 'Booked').length;
    const utilRate = totalAssets > 0 ? ((bookedCount / totalAssets) * 100).toFixed(1) : (isDemoUser ? '75.0' : '0.0');

    return {
      revenue: rev + baseRev,
      pendingRequests: pending,
      activeUnits: active,
      utilizationRate: utilRate
    };
  }, [userIncomingRequests, userFleet, isDemoUser]);

  return (
    <div className="app-root-container">
      {/* ================= 1. SITE HEADER & NAVIGATION ================= */}
      <header className="site-header">
        <div className="container">
          <nav className="nav-inner">
            {/* Brand Insignia */}
            <a href="#" className="brand-group" onClick={(e) => { e.preventDefault(); handleSwitchView('seeker'); }}>
              <div className="brand-logo-icon">
                <i data-lucide="layers"></i>
              </div>
              <div className="brand-title-wrap">
                <div className="brand-name">
                  <span>HospitaLink</span>
                  <span className="brand-badge">B2B Exchange</span>
                </div>
                <span className="brand-subtitle">Commercial Asset Sharing Network</span>
              </div>
            </a>

            {/* View Mode Switcher Pill */}
            <div className="nav-center">
              <div className="view-switch-pill" role="tablist" aria-label="View Mode">
                <button
                  className={`view-btn ${currentView === 'seeker' ? 'active' : ''}`}
                  onClick={() => handleSwitchView('seeker')}
                  role="tab"
                  aria-selected={currentView === 'seeker'}
                >
                  <i data-lucide="search" style={{ width: '1rem', height: '1rem' }}></i>
                  <span>Seeker Marketplace</span>
                </button>
                <button
                  className={`view-btn ${currentView === 'provider' ? 'active' : ''}`}
                  onClick={() => handleSwitchView('provider')}
                  role="tab"
                  aria-selected={currentView === 'provider'}
                >
                  <i data-lucide="layout-dashboard" style={{ width: '1rem', height: '1rem' }}></i>
                  <span>Provider Dashboard</span>
                  {userIncomingRequests.filter(r => r.status === 'Pending' || r.status === 'Negotiating').length > 0 && (
                    <span className="badge bg-danger rounded-pill ms-1" style={{ fontSize: '0.65rem' }}>
                      {userIncomingRequests.filter(r => r.status === 'Pending' || r.status === 'Negotiating').length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Nav Actions Right */}
            <div className="nav-actions">
              {/* Theme Toggle */}
              <button className="theme-toggle-btn" onClick={toggleTheme} title="Toggle Light / Dark Theme" aria-label="Toggle theme">
                <i data-lucide={theme === 'dark' ? 'sun' : 'moon'}></i>
              </button>

              {/* Auth User Status */}
              {currentUser ? (
                <div className="dropdown">
                  <div
                    className="user-badge-pill"
                    role="button"
                    data-bs-toggle="dropdown"
                    aria-expanded="false"
                    onClick={() => setProfileModalOpen(true)}
                  >
                    <span className="user-dot"></span>
                    <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', lineHeight: '1.1' }}>
                      <span className="user-biz-name">{currentUser.businessName}</span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        {currentUser.businessType} • {(currentUser.location || 'Mumbai').split(',')[0]}
                      </span>
                    </div>
                    <button
                      className="logout-btn"
                      onClick={(e) => { e.stopPropagation(); handleLogout(); }}
                      title="Sign Out"
                      aria-label="Sign out"
                    >
                      <i data-lucide="log-out" style={{ width: '0.85rem', height: '0.85rem' }}></i>
                    </button>
                  </div>
                </div>
              ) : (
                <button className="auth-trigger-btn" onClick={() => { setAuthTab('login'); setAuthModalOpen(true); }}>
                  <i data-lucide="building" style={{ width: '1rem', height: '1rem' }}></i>
                  <span>Enterprise Login</span>
                </button>
              )}
            </div>
          </nav>
        </div>
      </header>

      {/* ================= 2. HERO BANNER & LIVE METRICS ================= */}
      <section className="hero-section">
        <div className="container">
          <div className="hero-content">
            <div className="hero-headline-wrap">
              <div className="hero-pill-tag">
                <i data-lucide="shield-check" style={{ width: '0.9rem', height: '0.9rem' }}></i>
                <span>Verified Commercial Fleet & Equipment Grid</span>
              </div>
              <h1 className="hero-title">
                Enterprise Hospitality <span className="hero-highlight">Resource Exchange</span>
              </h1>
              <p className="hero-desc">
                Instantly borrow, rent, or monetize high-capacity commercial kitchen assets, luxury banquet setups, cold-chain logistics vans, and event staging equipment across Mumbai and Thane metropolitan hubs.
              </p>
            </div>

            {/* 4 Live Metrics Cards */}
            <div className="metric-strip-grid">
              <div className="metric-strip-card">
                <div className="metric-icon-wrap" style={{ color: 'var(--accent-primary)', backgroundColor: 'var(--accent-primary-subtle)' }}>
                  <i data-lucide="layers"></i>
                </div>
                <div className="metric-text-wrap">
                  <span className="metric-val">{inventory.length}</span>
                  <span className="metric-lbl">Active Commercial Nodes</span>
                </div>
              </div>

              <div className="metric-strip-card">
                <div className="metric-icon-wrap" style={{ color: 'var(--accent-emerald)', backgroundColor: 'var(--accent-emerald-subtle)' }}>
                  <i data-lucide="zap"></i>
                </div>
                <div className="metric-text-wrap">
                  <span className="metric-val">30–60 Min</span>
                  <span className="metric-lbl">Avg MMR Dispatch Time</span>
                </div>
              </div>

              <div className="metric-strip-card">
                <div className="metric-icon-wrap" style={{ color: 'var(--accent-amber)', backgroundColor: 'var(--accent-amber-subtle)' }}>
                  <i data-lucide="clipboard-check"></i>
                </div>
                <div className="metric-text-wrap">
                  <span className="metric-val">100%</span>
                  <span className="metric-lbl">Digital Condition Audits</span>
                </div>
              </div>

              <div className="metric-strip-card">
                <div className="metric-icon-wrap" style={{ color: 'var(--accent-purple)', backgroundColor: 'var(--accent-purple-subtle)' }}>
                  <i data-lucide="lock"></i>
                </div>
                <div className="metric-text-wrap">
                  <span className="metric-val">₹25.8L</span>
                  <span className="metric-lbl">Escrow Protected Trading</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= 3. VIEW: SEEKER MARKETPLACE ================= */}
      {currentView === 'seeker' && (
        <main className="view-container active" id="view-seeker">
          <div className="container">
            {/* Category Pills Navigation */}
            <nav className="category-pills-bar" aria-label="Category filter pills">
              <div className="category-pills-inner">
                {[
                  { id: "all", label: "All Categories", icon: "grid" },
                  { id: "Venue", label: "Venues & Banquets", icon: "champagne-glasses" },
                  { id: "Kitchen", label: "Commercial Kitchens", icon: "utensils" },
                  { id: "Vehicle", label: "Logistics & Vehicles", icon: "truck" },
                  { id: "Equipment", label: "Event Equipment", icon: "speaker" }
                ].map(cat => (
                  <button
                    key={cat.id}
                    className={`category-pill ${activeCategory === cat.id ? 'active' : ''}`}
                    onClick={() => setActiveCategory(cat.id)}
                  >
                    <i data-lucide={cat.icon} style={{ width: '0.9rem', height: '0.9rem' }}></i>
                    <span>{cat.label}</span>
                  </button>
                ))}
              </div>
            </nav>

            {/* Filter Toolbar & Search */}
            <div className="filter-toolbar">
              <div className="search-box">
                <i data-lucide="search" className="search-icon"></i>
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search banquets, cold rooms, catering vans, sound systems..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="filters-row">
                {/* Emergency Mode Toggle */}
                <button
                  className={`btn-emergency-mode ${emergencyMode ? 'active' : ''}`}
                  onClick={toggleEmergencyMode}
                  title="Filter to instant 30-60 min dispatch"
                >
                  <i data-lucide="zap"></i>
                  <span>⚡ 30–60 Min Dispatch</span>
                </button>

                {/* Proximity Radius */}
                <div className="filter-group">
                  <label htmlFor="filter-radius">Radius:</label>
                  <select
                    id="filter-radius"
                    className="filter-select"
                    value={selectedRadius}
                    onChange={(e) => setSelectedRadius(e.target.value)}
                  >
                    <option value="all">All MMR (25 km)</option>
                    <option value="5">Within 5 km</option>
                    <option value="10">Within 10 km</option>
                    <option value="15">Within 15 km</option>
                  </select>
                </div>

                {/* MMR Region */}
                <div className="filter-group">
                  <label htmlFor="filter-location">Region:</label>
                  <select
                    id="filter-location"
                    className="filter-select"
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                  >
                    <option value="all">All MMR Hubs</option>
                    <option value="Lower Parel, Mumbai">Lower Parel, Mumbai</option>
                    <option value="Andheri East, Mumbai">Andheri East, Mumbai</option>
                    <option value="Dadar West, Mumbai">Dadar West, Mumbai</option>
                    <option value="Ghatkopar West, Mumbai">Ghatkopar West, Mumbai</option>
                    <option value="Majiwada, Thane">Majiwada, Thane</option>
                    <option value="Dombivli East, Thane">Dombivli East, Thane</option>
                    <option value="Kalyan West, Thane">Kalyan West, Thane</option>
                    <option value="Vashi, Navi Mumbai">Vashi, Navi Mumbai</option>
                    <option value="Panvel, Navi Mumbai">Panvel, Navi Mumbai</option>
                    <option value="Bhiwandi Industrial Hub">Bhiwandi Industrial Hub</option>
                    <option value="Anjur Phata, Bhiwandi">Anjur Phata, Bhiwandi</option>
                    <option value="Vasai East, Extended MMR">Vasai East, Extended MMR</option>
                  </select>
                </div>

                {/* Category Dropdown */}
                <div className="filter-group">
                  <label htmlFor="filter-category">Category:</label>
                  <select
                    id="filter-category"
                    className="filter-select"
                    value={activeCategory}
                    onChange={(e) => setActiveCategory(e.target.value)}
                  >
                    <option value="all">All Categories</option>
                    <option value="Venue">Venues &amp; Banquets</option>
                    <option value="Kitchen">Commercial Kitchens</option>
                    <option value="Vehicle">Logistics Vehicles</option>
                    <option value="Equipment">Event Equipment</option>
                  </select>
                </div>

                {/* Price Filter */}
                <div className="filter-group">
                  <label htmlFor="filter-price">Daily Price:</label>
                  <select
                    id="filter-price"
                    className="filter-select"
                    value={selectedPriceRange}
                    onChange={(e) => setSelectedPriceRange(e.target.value)}
                  >
                    <option value="all">Any Rate</option>
                    <option value="under-10k">Under ₹10,000</option>
                    <option value="10k-25k">₹10,000 – ₹25,000</option>
                    <option value="above-25k">Above ₹25,000</option>
                  </select>
                </div>

                {/* Fulfillment */}
                <div className="filter-group">
                  <label htmlFor="filter-fulfillment">Fulfillment:</label>
                  <select
                    id="filter-fulfillment"
                    className="filter-select"
                    value={selectedFulfillment}
                    onChange={(e) => setSelectedFulfillment(e.target.value)}
                  >
                    <option value="all">All Modes</option>
                    <option value="In-Store Pickup">In-Store Pickup</option>
                    <option value="Site Delivery">Site Delivery</option>
                  </select>
                </div>

                {/* Sort By */}
                <div className="filter-group">
                  <label htmlFor="sort-select">Sort:</label>
                  <select
                    id="sort-select"
                    className="filter-select"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <option value="featured">Featured First</option>
                    <option value="price-low">Price: Low to High</option>
                    <option value="price-high">Price: High to Low</option>
                    <option value="proximity">Proximity (Nearest)</option>
                  </select>
                </div>

                {/* Clear Filters */}
                <button className="reset-filters-btn" onClick={handleResetFilters} title="Reset all filters">
                  <i data-lucide="rotate-ccw"></i>
                  <span>Reset</span>
                </button>
              </div>
            </div>

            {/* Results Header Bar */}
            <div className="results-header-bar">
              <div className="results-counter">
                Showing <strong>{filteredMarketplaceListings.length}</strong> verified commercial resources in MMR
              </div>
              <button className="btn-primary-action" onClick={() => setListModalAsset({})}>
                <i data-lucide="plus-circle" style={{ width: '1rem', height: '1rem' }}></i>
                <span>List Commercial Asset</span>
              </button>
            </div>

            {/* Listings Grid */}
            <div className="listings-grid">
              {filteredMarketplaceListings.length === 0 ? (
                <div className="empty-state-wrap" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem 1rem' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🔍</div>
                  <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No MMR Assets Match Your Search Criteria</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '480px', margin: '0 auto 1.25rem' }}>
                    {emergencyMode
                      ? 'No emergency units found within proximity radius. Try increasing radius or disabling Emergency Mode.'
                      : 'Try adjusting your region filter, daily price range, or category filter.'}
                  </p>
                  <button className="btn-primary-action" onClick={handleResetFilters} style={{ margin: '0 auto' }}>
                    Reset Filters
                  </button>
                </div>
              ) : (
                filteredMarketplaceListings.map(asset => {
                  const isAvailable = asset.availabilityStatus === 'Available';
                  const imgUrl = getSafeImageUrl(asset.image, asset.category);
                  const distanceText = `${asset._distanceKm || 6.5} km from BKC`;
                  const isOwner = currentUser && asset.ownerEmail && asset.ownerEmail.toLowerCase() === currentUser.email.toLowerCase();

                  return (
                    <article key={asset.id} className={`asset-card ${!isAvailable ? 'is-booked' : ''}`} data-id={asset.id}>
                      {/* Media */}
                      <div className="card-media">
                        <img src={imgUrl} alt={asset.title} loading="lazy" />
                        <span className="card-category-badge">{asset.category}</span>
                        <span className={`card-status-pill ${isAvailable ? 'available' : 'booked'}`}>
                          {isAvailable ? 'Available' : 'Booked'}
                        </span>
                        {asset.instantDispatchAvailable && (
                          <span className="instant-dispatch-badge" style={{ position: 'absolute', bottom: '8px', left: '8px' }}>
                            <i data-lucide="zap" style={{ width: '0.75rem', height: '0.75rem' }}></i>
                            ⚡ 30–60 Min Dispatch
                          </span>
                        )}
                      </div>

                      {/* Body */}
                      <div className="card-body">
                        <div className="card-provider-row">
                          <span className="provider-info">{asset.shopName}</span>
                          <span className="proximity-tag">📍 {distanceText}</span>
                        </div>

                        <h3 className="card-title" title={asset.title}>{asset.title}</h3>

                        <div className="card-location-row">
                          <span className="store-location-badge">
                            <i data-lucide="map-pin" style={{ width: '0.85rem', height: '0.85rem' }}></i>
                            <span>{asset.location}</span>
                          </span>
                          <span className={`fulfillment-badge ${asset.fulfillmentType === 'Site Delivery' ? 'fulfillment-delivery' : 'fulfillment-pickup'}`}>
                            {asset.fulfillmentType}
                          </span>
                        </div>

                        {/* Footer & Actions */}
                        <div className="card-footer">
                          <div className="price-box">
                            <span className="price-amount">₹{(asset.pricePerDay || 0).toLocaleString('en-IN')}</span>
                            <span className="price-period">per calendar day</span>
                          </div>

                          <div className="card-actions">
                            <button
                              className="btn-quickview"
                              onClick={() => setQuickViewAsset(asset)}
                              title="Quick Specs & Details"
                            >
                              <i data-lucide="eye" style={{ width: '1rem', height: '1rem' }}></i>
                            </button>

                            <button
                              className={`btn-request-rent ${!isAvailable ? 'btn-booked-action' : ''}`}
                              style={!isAvailable ? { backgroundColor: 'var(--accent-amber)', cursor: 'not-allowed' } : {}}
                              onClick={() => {
                                if (!isAvailable) {
                                  showToast({
                                    title: "Asset Date-Locked",
                                    message: `${asset.title} is already booked for these dates.`,
                                    type: "warning"
                                  });
                                  return;
                                }
                                setRentalModalAsset(asset);
                              }}
                            >
                              {!isAvailable ? 'Date Locked' : (emergencyMode ? '⚡ Instant Dispatch' : 'Request Rent')}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Provider Edit / Delete Bar */}
                      {isOwner && (
                        <div className="card-manage-bar">
                          <button
                            type="button"
                            className="btn-card-action btn-edit-action"
                            onClick={() => setListModalAsset(asset)}
                            title="Edit this resource"
                          >
                            <i data-lucide="edit-3" style={{ width: '0.8rem', height: '0.8rem' }}></i>
                            <span>✏️ Edit</span>
                          </button>
                          <button
                            type="button"
                            className="btn-card-action btn-delete-action"
                            onClick={() => handleDeleteResource(asset.id)}
                            title="Delete this resource"
                          >
                            <i data-lucide="trash-2" style={{ width: '0.8rem', height: '0.8rem' }}></i>
                            <span>🗑️ Delete</span>
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })
              )}
            </div>
          </div>
        </main>
      )}

      {/* ================= 4. VIEW: PROVIDER DASHBOARD ================= */}
      {currentView === 'provider' && (
        <main className="view-container active" id="view-provider">
          <div className="container">
            {/* KPI Cards Grid */}
            <div className="prov-stats-grid">
              <div className="prov-stat-card">
                <div className="prov-stat-hdr">
                  <span className="prov-stat-title">Contract Leased Revenue</span>
                  <div className="prov-stat-icon-wrap" style={{ color: 'var(--accent-emerald)', backgroundColor: 'var(--accent-emerald-subtle)' }}>
                    <i data-lucide="wallet"></i>
                  </div>
                </div>
                <div className="prov-stat-number">₹{providerKpis.revenue.toLocaleString('en-IN')}</div>
                <div className="prov-stat-foot">Platform escrow + verified token receipts</div>
              </div>

              <div className="prov-stat-card">
                <div className="prov-stat-hdr">
                  <span className="prov-stat-title">Pending Pipeline Requests</span>
                  <div className="prov-stat-icon-wrap" style={{ color: 'var(--accent-amber)', backgroundColor: 'var(--accent-amber-subtle)' }}>
                    <i data-lucide="clock"></i>
                  </div>
                </div>
                <div className="prov-stat-number">{providerKpis.pendingRequests} Requests</div>
                <div className="prov-stat-foot">Awaiting acceptance or counter-proposal</div>
              </div>

              <div className="prov-stat-card">
                <div className="prov-stat-hdr">
                  <span className="prov-stat-title">Active Leased Units</span>
                  <div className="prov-stat-icon-wrap" style={{ color: 'var(--accent-primary)', backgroundColor: 'var(--accent-primary-subtle)' }}>
                    <i data-lucide="truck"></i>
                  </div>
                </div>
                <div className="prov-stat-number">{providerKpis.activeUnits} Units Active</div>
                <div className="prov-stat-foot">On-site or dispatched under active SLA</div>
              </div>

              <div className="prov-stat-card">
                <div className="prov-stat-hdr">
                  <span className="prov-stat-title">Fleet Utilization Rate</span>
                  <div className="prov-stat-icon-wrap" style={{ color: 'var(--accent-purple)', backgroundColor: 'var(--accent-purple-subtle)' }}>
                    <i data-lucide="percent"></i>
                  </div>
                </div>
                <div className="prov-stat-number">{providerKpis.utilizationRate}%</div>
                <div className="prov-stat-foot">30-day commercial calendar occupancy</div>
              </div>
            </div>

            {/* Provider Navigation Sub-Tabs */}
            <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
              <div className="btn-group" role="group" aria-label="Provider Tabs">
                <button
                  className={`btn ${providerTab === 'pipeline' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setProviderTab('pipeline')}
                >
                  <i data-lucide="inbox" style={{ width: '0.9rem', height: '0.9rem', marginRight: '4px' }}></i>
                  Incoming Requests ({userIncomingRequests.length})
                </button>
                <button
                  className={`btn ${providerTab === 'fleet' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setProviderTab('fleet')}
                >
                  <i data-lucide="layers" style={{ width: '0.9rem', height: '0.9rem', marginRight: '4px' }}></i>
                  My Private Fleet ({userFleet.length})
                </button>
                <button
                  className={`btn ${providerTab === 'sent' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setProviderTab('sent')}
                >
                  <i data-lucide="send" style={{ width: '0.9rem', height: '0.9rem', marginRight: '4px' }}></i>
                  My Sent Bookings ({userSeekerRequests.length})
                </button>
                <button
                  className={`btn ${providerTab === 'calendar' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setProviderTab('calendar')}
                >
                  <i data-lucide="calendar" style={{ width: '0.9rem', height: '0.9rem', marginRight: '4px' }}></i>
                  Calendar &amp; Availability
                </button>
                <button
                  className={`btn ${providerTab === 'roi' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setProviderTab('roi')}
                >
                  <i data-lucide="calculator" style={{ width: '0.9rem', height: '0.9rem', marginRight: '4px' }}></i>
                  Fleet ROI Simulator
                </button>
              </div>

              <div className="d-flex gap-2">
                <button className="btn btn-sm btn-primary" onClick={() => setListModalAsset({})}>
                  <i data-lucide="plus-circle" style={{ width: '0.85rem', height: '0.85rem', marginRight: '4px' }}></i>
                  List Commercial Asset
                </button>
                <button className="btn btn-sm btn-outline-secondary" onClick={handleReloadDefaultFleet}>
                  <i data-lucide="rotate-ccw" style={{ width: '0.85rem', height: '0.85rem', marginRight: '4px' }}></i>
                  Reload Fleet
                </button>
              </div>
            </div>

            {/* TAB 1: INCOMING REQUESTS PIPELINE */}
            {providerTab === 'pipeline' && (
              <div className="dash-card">
                <div className="dash-card-header">
                  <div>
                    <h3 className="dash-card-title">Incoming Rental Requests &amp; Counter-Offers</h3>
                    <span className="dash-card-subtitle">Manage bookings, counter-proposals, and digital audits</span>
                  </div>
                  <span className="badge bg-primary rounded-pill px-3 py-2">
                    {userIncomingRequests.length} Total Requests
                  </span>
                </div>

                <div className="table-responsive">
                  <table className="prov-table">
                    <thead>
                      <tr>
                        <th>Request ID</th>
                        <th>Target Resource</th>
                        <th>Requester Enterprise</th>
                        <th>Booking Dates</th>
                        <th>Contract Value</th>
                        <th>Escrow / Mode</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userIncomingRequests.length === 0 ? (
                        <tr>
                          <td colSpan="8" style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</div>
                            <div style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>No incoming requests currently in pipeline.</div>
                            <div style={{ fontSize: '0.8rem' }}>When seekers request your listed assets, they will appear here for acceptance.</div>
                          </td>
                        </tr>
                      ) : (
                        userIncomingRequests.map(req => {
                          let statusClass = 'pending';
                          if (req.status === 'Approved' || req.status === 'Confirmed') statusClass = 'approved';
                          if (req.status === 'Rejected') statusClass = 'rejected';
                          if (req.status === 'Negotiating') statusClass = 'negotiating';
                          if (req.status === 'Completed') statusClass = 'approved';

                          return (
                            <tr key={req.id}>
                              <td>
                                <strong style={{ color: 'var(--accent-primary)' }}>{req.id}</strong>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{req.auditStatus || 'Pending Dispatch'}</div>
                              </td>
                              <td>
                                <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{req.assetTitle}</div>
                                <span className="coordinates-tag">{(req.assetId || 'ASSET').toUpperCase()}</span>
                              </td>
                              <td>
                                <div style={{ fontWeight: '600' }}>{req.seekerBusiness}</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{req.seekerContact}</div>
                              </td>
                              <td>
                                <span className={`instant-dispatch-badge ${req.bookingMode === 'Emergency Dispatch' ? '' : 'bg-light text-dark'}`} style={{ padding: '2px 6px', fontSize: '0.7rem' }}>
                                  {req.bookingMode === 'Emergency Dispatch' ? '⚡ Emergency' : '📅 Planned'}
                                </span>
                                <div style={{ fontSize: '0.75rem', marginTop: '2px', color: 'var(--text-primary)' }}>
                                  {req.startDate} → {req.endDate} ({req.days}d)
                                </div>
                              </td>
                              <td>
                                <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>₹{(req.totalAmount || 0).toLocaleString('en-IN')}</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--accent-emerald)' }}>Token: ₹{(req.tokenAmount || 0).toLocaleString('en-IN')}</div>
                              </td>
                              <td>
                                <div style={{ fontSize: '0.78rem' }}>Escrow: <strong>₹{(req.escrowDeposit || 0).toLocaleString('en-IN')}</strong></div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{req.deliveryMode || 'Site Delivery'}</div>
                              </td>
                              <td>
                                <span className={`status-badge ${statusClass}`}>{req.status}</span>
                                {req.negotiationOffer && (
                                  <div style={{ fontSize: '0.7rem', color: 'var(--accent-purple)', marginTop: '2px' }}>
                                    Offer: ₹{req.negotiationOffer.toLocaleString('en-IN')}
                                  </div>
                                )}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                  {req.status === 'Pending' || req.status === 'Negotiating' ? (
                                    <>
                                      <button className="action-table-btn btn-accept-req" onClick={() => handleAcceptRequest(req.id)} title="Accept & Freeze Calendar">
                                        <i data-lucide="check" style={{ width: '0.85rem', height: '0.85rem' }}></i> Accept
                                      </button>
                                      <button className="action-table-btn btn-negotiate-req" onClick={() => setNegotiateModalReq(req)} title="Send Counter-Offer">
                                        <i data-lucide="message-square" style={{ width: '0.85rem', height: '0.85rem' }}></i> Counter
                                      </button>
                                      <button className="action-table-btn btn-reject-req" onClick={() => handleRejectRequest(req.id)} title="Reject Request">
                                        <i data-lucide="x" style={{ width: '0.85rem', height: '0.85rem' }}></i>
                                      </button>
                                    </>
                                  ) : (
                                    <button className="action-table-btn btn-audit-req" onClick={() => { setAuditModalReq(req); setAuditStep(1); }} title="2-Step Photo Audit & Escrow">
                                      <i data-lucide="clipboard-check" style={{ width: '0.85rem', height: '0.85rem', color: 'var(--accent-emerald)' }}></i> Audit
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2: MY PRIVATE FLEET */}
            {providerTab === 'fleet' && (
              <div className="dash-card">
                <div className="dash-card-header">
                  <div>
                    <h3 className="dash-card-title">Registered Commercial Fleet</h3>
                    <span className="dash-card-subtitle">Manage listings, live rates, dispatch modes, and availability</span>
                  </div>
                  <button className="btn-primary-action" onClick={() => setListModalAsset({})}>
                    <i data-lucide="plus-circle" style={{ width: '0.9rem', height: '0.9rem' }}></i>
                    <span>List New Asset</span>
                  </button>
                </div>

                <div className="table-responsive">
                  <table className="prov-table">
                    <thead>
                      <tr>
                        <th>Asset ID</th>
                        <th>Commercial Title</th>
                        <th>Category</th>
                        <th>Shop / Facility</th>
                        <th>Vendor Type</th>
                        <th>MMR Location</th>
                        <th>Fulfillment</th>
                        <th>Daily Rate</th>
                        <th>Availability</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userFleet.length === 0 ? (
                        <tr>
                          <td colSpan="10" style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📦</div>
                            <div style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.35rem' }}>No resources listed yet in your private fleet.</div>
                            <div style={{ fontSize: '0.9rem', marginBottom: '1.25rem' }}>Click 'List Asset' to publish commercial resources to the MMR exchange!</div>
                            <button className="btn-primary-action" onClick={() => setListModalAsset({})}>
                              List Asset Now
                            </button>
                          </td>
                        </tr>
                      ) : (
                        userFleet.map(asset => {
                          const isAvail = asset.availabilityStatus === 'Available';
                          return (
                            <tr key={asset.id}>
                              <td><strong className="coordinates-tag">{asset.id.toUpperCase()}</strong></td>
                              <td>
                                <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{asset.title}</div>
                                {asset.instantDispatchAvailable && (
                                  <span style={{ fontSize: '0.68rem', color: '#ea580c' }}>⚡ Instant Dispatch Enabled</span>
                                )}
                              </td>
                              <td><span className="category-badge-chip">{asset.category}</span></td>
                              <td>{asset.shopName}</td>
                              <td><span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{asset.vendorType}</span></td>
                              <td>{asset.location}</td>
                              <td><span className={`fulfillment-badge ${asset.fulfillmentType === 'Site Delivery' ? 'fulfillment-delivery' : 'fulfillment-pickup'}`}>{asset.fulfillmentType}</span></td>
                              <td><strong>₹{(asset.pricePerDay || 0).toLocaleString('en-IN')}</strong></td>
                              <td>
                                <button
                                  className={`status-badge ${isAvail ? 'approved' : 'pending'}`}
                                  onClick={() => handleToggleAvailability(asset.id)}
                                  style={{ cursor: 'pointer', border: 'none' }}
                                  title="Click to toggle Available / Booked"
                                >
                                  {asset.availabilityStatus} ↻
                                </button>
                              </td>
                              <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                <button className="action-table-btn btn-edit-fleet-asset me-1" onClick={() => setListModalAsset(asset)} title="Edit">
                                  <i data-lucide="edit-3" style={{ width: '0.85rem', height: '0.85rem' }}></i> Edit
                                </button>
                                <button className="action-table-btn btn-delete-fleet-asset text-danger" onClick={() => handleDeleteResource(asset.id)} title="Delete">
                                  <i data-lucide="trash-2" style={{ width: '0.85rem', height: '0.85rem' }}></i>
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: MY SENT BOOKING REQUESTS (SEEKER OUTBOX) */}
            {providerTab === 'sent' && (
              <div className="dash-card">
                <div className="dash-card-header">
                  <div>
                    <h3 className="dash-card-title">My Outgoing Rental Requests</h3>
                    <span className="dash-card-subtitle">Bookings requested across external MMR providers</span>
                  </div>
                </div>

                <div className="table-responsive">
                  <table className="prov-table">
                    <thead>
                      <tr>
                        <th>Booking ID</th>
                        <th>Resource</th>
                        <th>Dates</th>
                        <th>Contract Amount</th>
                        <th>Token Paid</th>
                        <th>Escrow Deposit</th>
                        <th>Status</th>
                        <th>Terms / Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userSeekerRequests.length === 0 ? (
                        <tr>
                          <td colSpan="8" style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📤</div>
                            <div style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>You have not sent any rental requests yet.</div>
                            <div style={{ fontSize: '0.8rem' }}>Browse the Seeker Marketplace and click 'Request Rent' on any asset.</div>
                          </td>
                        </tr>
                      ) : (
                        userSeekerRequests.map(req => (
                          <tr key={req.id}>
                            <td><strong style={{ color: 'var(--accent-primary)' }}>{req.id}</strong></td>
                            <td><div style={{ fontWeight: '600' }}>{req.assetTitle}</div></td>
                            <td>{req.startDate} → {req.endDate} ({req.days}d)</td>
                            <td><strong>₹{(req.totalAmount || 0).toLocaleString('en-IN')}</strong></td>
                            <td><span style={{ color: 'var(--accent-emerald)', fontWeight: '600' }}>₹{(req.tokenAmount || 0).toLocaleString('en-IN')}</span></td>
                            <td>₹{(req.escrowDeposit || 0).toLocaleString('en-IN')} (Refundable)</td>
                            <td><span className={`status-badge ${req.status === 'Approved' ? 'approved' : (req.status === 'Rejected' ? 'rejected' : 'pending')}`}>{req.status}</span></td>
                            <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{req.notes || 'Standard booking'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 4: CALENDAR & AVAILABILITY GRID */}
            {providerTab === 'calendar' && (
              <div className="dash-card">
                <div className="dash-card-header">
                  <div>
                    <h3 className="dash-card-title">Fleet Calendar Schedule &amp; Double-Booking Protection</h3>
                    <span className="dash-card-subtitle">Real-time booking locks and availability timeline across your units</span>
                  </div>
                </div>

                <div className="p-3">
                  <div className="row g-3">
                    {userFleet.map(asset => {
                      const isBooked = asset.availabilityStatus === 'Booked';
                      return (
                        <div key={asset.id} className="col-md-6 col-lg-4">
                          <div className="border rounded p-3 bg-body" style={{ height: '100%' }}>
                            <div className="d-flex justify-content-between align-items-start mb-2">
                              <h6 className="fw-bold mb-0 text-truncate" title={asset.title}>{asset.title}</h6>
                              <span className={`badge ${isAvailStatusBadge(asset.availabilityStatus)}`}>
                                {asset.availabilityStatus}
                              </span>
                            </div>
                            <div className="small text-muted mb-2">{asset.category} • {asset.location}</div>
                            <div className="p-2 rounded bg-light border mb-2 small">
                              <strong>Current Status: </strong>
                              {isBooked ? (
                                <span className="text-danger fw-bold">🔒 Locked for Confirmed Rental</span>
                              ) : (
                                <span className="text-success fw-bold">🟢 Open for Booking</span>
                              )}
                            </div>
                            <button
                              className="btn btn-sm btn-outline-primary w-100"
                              onClick={() => handleToggleAvailability(asset.id)}
                            >
                              Toggle Availability State
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: FLEET MONETIZATION & ROI CALCULATOR */}
            {providerTab === 'roi' && (
              <div className="calculator-card">
                <div className="calculator-header">
                  <div className="calc-title-icon">
                    <i data-lucide="calculator"></i>
                  </div>
                  <div>
                    <h3 className="calc-main-title">Hospitality Fleet Monetization &amp; ROI Simulator</h3>
                    <p className="calc-sub-title">Project monthly gross/net revenue after 10% platform fee and capital expenditure payback horizon</p>
                  </div>
                </div>

                <div className="calc-grid">
                  <div className="calc-controls-col">
                    <div className="slider-group">
                      <div className="slider-header-row">
                        <label htmlFor="slider-assets">Idle Commercial Units for Exchange:</label>
                        <span className="slider-val-badge">{roiAssets} Unit{roiAssets > 1 ? 's' : ''}</span>
                      </div>
                      <input
                        type="range"
                        id="slider-assets"
                        className="custom-range-slider"
                        min="1"
                        max="10"
                        value={roiAssets}
                        onChange={(e) => setRoiAssets(parseInt(e.target.value, 10))}
                      />
                    </div>

                    <div className="slider-group">
                      <div className="slider-header-row">
                        <label htmlFor="slider-days">Monthly Leased Rental Days per Unit:</label>
                        <span className="slider-val-badge">{roiDays} Days</span>
                      </div>
                      <input
                        type="range"
                        id="slider-days"
                        className="custom-range-slider"
                        min="2"
                        max="30"
                        value={roiDays}
                        onChange={(e) => setRoiDays(parseInt(e.target.value, 10))}
                      />
                    </div>

                    <div className="slider-group">
                      <div className="slider-header-row">
                        <label htmlFor="slider-rate">Average Daily Exchange Rate (₹):</label>
                        <span className="slider-val-badge">₹{roiRate.toLocaleString('en-IN')} / day</span>
                      </div>
                      <input
                        type="range"
                        id="slider-rate"
                        className="custom-range-slider"
                        min="3000"
                        max="50000"
                        step="1000"
                        value={roiRate}
                        onChange={(e) => setRoiRate(parseInt(e.target.value, 10))}
                      />
                    </div>
                  </div>

                  <div className="calc-outputs-col">
                    <div className="calc-kpi-block highlight">
                      <span className="calc-kpi-label">Estimated Monthly Net Earnings (After 10% Fee)</span>
                      <div className="calc-kpi-val">₹{Math.round(roiAssets * roiDays * roiRate * 0.90).toLocaleString('en-IN')}</div>
                    </div>

                    <div className="calc-subkpis-row">
                      <div className="calc-kpi-block">
                        <span className="calc-kpi-label">Annual Net Projected Revenue</span>
                        <div className="calc-kpi-subval">
                          ₹{((roiAssets * roiDays * roiRate * 0.90 * 12) / 100000).toFixed(2)} Lakhs
                        </div>
                      </div>

                      <div className="calc-kpi-block">
                        <span className="calc-kpi-label">Fleet Utilization Rate</span>
                        <div className="calc-kpi-subval">{((roiDays / 30) * 100).toFixed(1)}%</div>
                      </div>

                      <div className="calc-kpi-block">
                        <span className="calc-kpi-label">Capex Payback Horizon</span>
                        <div className="calc-kpi-subval">
                          {((roiAssets * 1500000) / (roiAssets * roiDays * roiRate * 0.90)).toFixed(1)} Months
                        </div>
                      </div>
                    </div>

                    <button
                      className="btn-primary-action w-100 justify-content-center"
                      onClick={() => setListModalAsset({ pricePerDay: roiRate })}
                    >
                      <i data-lucide="plus-circle" style={{ width: '1rem', height: '1rem' }}></i>
                      <span>List Asset at this Daily Rate (₹{roiRate.toLocaleString('en-IN')})</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      )}

      {/* ================= 5. FOOTER ================= */}
      <footer className="site-footer">
        <div className="container">
          <div className="footer-inner">
            <div className="footer-brand-col">
              <div className="brand-group">
                <div className="brand-logo-icon">
                  <i data-lucide="layers"></i>
                </div>
                <div className="brand-title-wrap">
                  <div className="brand-name" style={{ color: '#ffffff' }}>
                    <span>HospitaLink</span>
                    <span className="brand-badge">B2B Exchange</span>
                  </div>
                  <span className="brand-subtitle" style={{ color: '#94a3b8' }}>MMR Commercial Grid</span>
                </div>
              </div>
              <p className="footer-desc">
                Mumbai Metropolitan Region's verified B2B hospitality asset exchange platform. Enabling cross-utilization of venues, commercial kitchen capacity, cold-chain transport, and event production staging equipment.
              </p>
            </div>

            <div className="footer-links-grid">
              <div className="footer-col">
                <h4 className="footer-col-title">Hospitality Sectors</h4>
                <ul className="footer-list">
                  <li><a href="#" onClick={(e) => { e.preventDefault(); setActiveCategory('Venue'); handleSwitchView('seeker'); }}>Hotels &amp; Resorts</a></li>
                  <li><a href="#" onClick={(e) => { e.preventDefault(); setActiveCategory('Kitchen'); handleSwitchView('seeker'); }}>Commercial Kitchens</a></li>
                  <li><a href="#" onClick={(e) => { e.preventDefault(); setActiveCategory('Venue'); handleSwitchView('seeker'); }}>Banquet Venues</a></li>
                  <li><a href="#" onClick={(e) => { e.preventDefault(); setActiveCategory('Vehicle'); handleSwitchView('seeker'); }}>3PL Cold-Chain Transport</a></li>
                  <li><a href="#" onClick={(e) => { e.preventDefault(); setActiveCategory('Equipment'); handleSwitchView('seeker'); }}>Event Staging &amp; AV</a></li>
                </ul>
              </div>

              <div className="footer-col">
                <h4 className="footer-col-title">Platform Features</h4>
                <ul className="footer-list">
                  <li><a href="#" onClick={(e) => { e.preventDefault(); toggleEmergencyMode(); }}>⚡ 30-60 Min Emergency Dispatch</a></li>
                  <li><a href="#" onClick={(e) => { e.preventDefault(); setProviderTab('roi'); handleSwitchView('provider'); }}>Fleet Monetization Simulator</a></li>
                  <li><a href="#" onClick={(e) => { e.preventDefault(); handleSwitchView('provider'); }}>2-Step Condition Audit</a></li>
                  <li><a href="#" onClick={(e) => { e.preventDefault(); handleSwitchView('seeker'); }}>3PL Logistics Calculator</a></li>
                  <li><a href="#" onClick={(e) => { e.preventDefault(); setProfileModalOpen(true); }}>Enterprise Escrow Security</a></li>
                </ul>
              </div>

              <div className="footer-col">
                <h4 className="footer-col-title">Metropolitan Hubs</h4>
                <div className="footer-hubs-chips">
                  {["Mumbai", "Thane", "Navi Mumbai", "Bhiwandi", "Kalyan", "Vasai"].map(hub => (
                    <span key={hub} className="footer-hub-chip">
                      <i data-lucide="map-pin" style={{ width: '0.75rem', height: '0.75rem', marginRight: '2px' }}></i>
                      {hub}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="footer-bottom">
            <span>&copy; {new Date().getFullYear()} HospitaLink B2B Hospitality Exchange Ltd. All rights reserved.</span>
            <div className="footer-bottom-links">
              <a href="#">Terms of Service</a>
              <a href="#">Escrow SLA Agreement</a>
              <a href="#">Condition Audit Standards</a>
              <a href="#">Privacy Policy</a>
            </div>
          </div>
        </div>
      </footer>

      {/* ================= 6. INTERACTIVE MODALS ================= */}

      {/* MODAL 1: AUTH LOGIN / REGISTER */}
      {authModalOpen && (
        <AuthModal
          tab={authTab}
          setTab={setAuthTab}
          onClose={() => setAuthModalOpen(false)}
          onLogin={handleLoginSubmit}
          onRegister={handleRegisterSubmit}
          onDemoLogin={handleLoginDemo}
        />
      )}

      {/* MODAL 2: USER PROFILE */}
      {profileModalOpen && currentUser && (
        <ProfileModal
          user={currentUser}
          onClose={() => setProfileModalOpen(false)}
          onSave={handleUpdateProfile}
          onLogout={handleLogout}
        />
      )}

      {/* MODAL 3: RENTAL BOOKING & LOGISTICS CALCULATOR */}
      {rentalModalAsset && (
        <RentalBookingModal
          asset={rentalModalAsset}
          emergencyMode={emergencyMode}
          currentUser={currentUser}
          onClose={() => setRentalModalAsset(null)}
          onSubmit={handleCreateBooking}
        />
      )}

      {/* MODAL 4: LIST / EDIT ASSET */}
      {listModalAsset !== null && (
        <ListAssetModal
          asset={listModalAsset}
          currentUser={currentUser}
          onClose={() => setListModalAsset(null)}
          onSave={handleSaveResource}
        />
      )}

      {/* MODAL 5: NEGOTIATE COUNTER-OFFER */}
      {negotiateModalReq && (
        <NegotiateModal
          request={negotiateModalReq}
          onClose={() => setNegotiateModalReq(null)}
          onSubmit={handleNegotiateSubmit}
        />
      )}

      {/* MODAL 6: 2-STEP DIGITAL CONDITION AUDIT */}
      {auditModalReq && (
        <ConditionAuditModal
          request={auditModalReq}
          step={auditStep}
          setStep={setAuditStep}
          onClose={() => setAuditModalReq(null)}
          onSubmit={handleAuditSubmit}
        />
      )}

      {/* MODAL 7: QUICK VIEW SPECS */}
      {quickViewAsset && (
        <QuickViewModal
          asset={quickViewAsset}
          onClose={() => setQuickViewAsset(null)}
          onRequest={() => {
            const a = quickViewAsset;
            setQuickViewAsset(null);
            setRentalModalAsset(a);
          }}
        />
      )}

      {/* TOAST NOTIFICATION STACK */}
      <div className="toast-container" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type} show`} role="alert">
            <div className="toast-icon">
              <i data-lucide={t.type === 'success' ? 'check-circle' : (t.type === 'warning' ? 'alert-triangle' : 'info')}></i>
            </div>
            <div className="toast-content">
              <span className="toast-title">{t.title}</span>
              <span className="toast-message">{t.message}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Helper badge color
function isAvailStatusBadge(status) {
  if (status === 'Available') return 'bg-success';
  if (status === 'Booked') return 'bg-danger';
  return 'bg-warning text-dark';
}

// =========================================================================
// MODAL COMPONENTS
// =========================================================================

// --- 1. AUTH MODAL ---
function AuthModal({ tab, setTab, onClose, onLogin, onRegister, onDemoLogin }) {
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [bizName, setBizName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [bizType, setBizType] = useState('Hotel & Resort');
  const [regHub, setRegHub] = useState('Mumbai');

  return (
    <div className="modal-backdrop active" style={{ display: 'flex' }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-dialog">
        <div className="modal-header">
          <div>
            <div className="modal-title">Enterprise Authentication</div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>MMR Hospitality Trading Network</span>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <i data-lucide="x"></i>
          </button>
        </div>

        <div className="auth-tab-bar">
          <button className={`auth-tab-btn ${tab === 'login' ? 'active' : ''}`} onClick={() => setTab('login')}>
            Sign In
          </button>
          <button className={`auth-tab-btn ${tab === 'register' ? 'active' : ''}`} onClick={() => setTab('register')}>
            Register Enterprise
          </button>
        </div>

        {tab === 'login' ? (
          <form className="modal-body" onSubmit={(e) => { e.preventDefault(); onLogin(loginEmail, loginPassword); }}>
            <div className="demo-accounts-box">
              <span className="demo-badge-title">Quick Demo Sign-In (Verified Profiles):</span>
              <div className="demo-accounts-grid">
                <button type="button" className="demo-quick-btn" onClick={() => onDemoLogin(0)}>
                  🏛️ Imperial Banquets (Demo Host)
                </button>
                <button type="button" className="demo-quick-btn" onClick={() => onDemoLogin(1)}>
                  👨‍🍳 Royal Kitchens (Cloud Depot)
                </button>
                <button type="button" className="demo-quick-btn" onClick={() => onDemoLogin(2)}>
                  🚚 Express 3PL Logistics (Fleet)
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="login-email">Corporate Work Email</label>
              <input
                type="email"
                id="login-email"
                className="form-input"
                placeholder="e.g. procurement@tajhotels.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="login-pwd">Password</label>
              <input
                type="password"
                id="login-pwd"
                className="form-input"
                placeholder="••••••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
              />
            </div>

            <div className="modal-footer" style={{ padding: 0, background: 'transparent', border: 'none' }}>
              <button type="button" className="reset-filters-btn" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary-action">
                <i data-lucide="log-in" style={{ width: '1rem', height: '1rem' }}></i>
                <span>Sign In to Network</span>
              </button>
            </div>
          </form>
        ) : (
          <form className="modal-body" onSubmit={(e) => {
            e.preventDefault();
            onRegister({
              businessName: bizName || 'Hospitality Enterprise Ltd',
              email: regEmail || 'admin@hospitality.in',
              businessType: bizType,
              role: 'Provider & Seeker',
              location: `${regHub}, MMR`,
              verified: true
            });
          }}>
            <div className="form-group">
              <label className="form-label" htmlFor="reg-biz-name">Organization / Business Name</label>
              <input
                type="text"
                id="reg-biz-name"
                className="form-input"
                placeholder="e.g. Grand Palace Banquets & Catering"
                value={bizName}
                onChange={(e) => setBizName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="reg-email">Work Email</label>
              <input
                type="email"
                id="reg-email"
                className="form-input"
                placeholder="e.g. events@grandpalace.in"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-row-2">
              <div className="form-group">
                <label className="form-label" htmlFor="reg-biz-type">Sector</label>
                <select id="reg-biz-type" className="form-select" value={bizType} onChange={(e) => setBizType(e.target.value)}>
                  <option value="Hotel & Resort">Hotel &amp; Resort</option>
                  <option value="Catering Enterprise">Catering Enterprise</option>
                  <option value="Banquet Venue">Banquet Venue</option>
                  <option value="Event Planner & Production">Event Planner &amp; Production</option>
                  <option value="Cloud Kitchen Network">Cloud Kitchen Network</option>
                  <option value="Institutional Kitchen">Institutional Kitchen</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reg-hub">Primary MMR Hub</label>
                <select id="reg-hub" className="form-select" value={regHub} onChange={(e) => setRegHub(e.target.value)}>
                  {["Mumbai", "Thane", "Navi Mumbai", "Bhiwandi", "Kalyan", "Vasai"].map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="modal-footer" style={{ padding: 0, background: 'transparent', border: 'none' }}>
              <button type="button" className="reset-filters-btn" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary-action">
                <i data-lucide="shield-check" style={{ width: '1rem', height: '1rem' }}></i>
                <span>Register &amp; Verify Enterprise</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// --- 2. USER PROFILE MODAL ---
function ProfileModal({ user, onClose, onSave, onLogout }) {
  const [bizName, setBizName] = useState(user.businessName || '');
  const [bizType, setBizType] = useState(user.businessType || 'Hotel & Resort');
  const [location, setLocation] = useState(user.location || 'Lower Parel, Mumbai');
  const [phone, setPhone] = useState(user.contactPhone || '+91 98200 12345');

  return (
    <div className="modal-backdrop active" style={{ display: 'flex' }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-dialog">
        <div className="modal-header">
          <div>
            <div className="modal-title">My Enterprise Profile</div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Verified Hospitality Partner #{user.email}</span>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <i data-lucide="x"></i>
          </button>
        </div>

        <form className="modal-body" onSubmit={(e) => { e.preventDefault(); onSave({ businessName: bizName, businessType: bizType, location, contactPhone: phone }); }}>
          <div className="p-3 mb-3 rounded bg-light border d-flex justify-content-between align-items-center">
            <div>
              <div className="fw-bold">{user.email}</div>
              <span className="badge bg-success">✓ Verified MMR Trading Member</span>
            </div>
            <span className="coordinates-tag">Role: {user.role || 'Provider & Seeker'}</span>
          </div>

          <div className="form-group">
            <label className="form-label">Business / Hotel Organization Name</label>
            <input type="text" className="form-input" value={bizName} onChange={(e) => setBizName(e.target.value)} required />
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Business Category</label>
              <select className="form-select" value={bizType} onChange={(e) => setBizType(e.target.value)}>
                <option value="Hotel & Resort">Hotel &amp; Resort</option>
                <option value="Catering Enterprise">Catering Enterprise</option>
                <option value="Banquet Venue">Banquet Venue</option>
                <option value="Event Planner & Production">Event Planner &amp; Production</option>
                <option value="Cloud Kitchen Network">Cloud Kitchen Network</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Primary Operating Hub</label>
              <input type="text" className="form-input" value={location} onChange={(e) => setLocation(e.target.value)} required />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Dispatch / Contact Phone</label>
            <input type="text" className="form-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          <div className="modal-footer" style={{ padding: 0, background: 'transparent', border: 'none' }}>
            <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => { onClose(); onLogout(); }}>
              Sign Out
            </button>
            <div className="ms-auto d-flex gap-2">
              <button type="button" className="reset-filters-btn" onClick={onClose}>Close</button>
              <button type="submit" className="btn-primary-action">Save Changes</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- 3. RENTAL BOOKING & LOGISTICS MODAL ---
function RentalBookingModal({ asset, emergencyMode, currentUser, onClose, onSubmit }) {
  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  const after3Days = new Date();
  after3Days.setDate(after3Days.getDate() + 3);
  const after3DaysStr = after3Days.toISOString().split('T')[0];

  const [mode, setMode] = useState(emergencyMode ? 'emergency' : 'planned');
  const [startDate, setStartDate] = useState(emergencyMode ? todayStr : tomorrowStr);
  const [endDate, setEndDate] = useState(emergencyMode ? tomorrowStr : after3DaysStr);
  const [isDelivery, setIsDelivery] = useState(asset.fulfillmentType === 'Site Delivery');
  const [isRoundTrip, setIsRoundTrip] = useState(true);
  const [address, setAddress] = useState("Jio World Convention Centre, Hall 3, BKC, Mumbai");

  // Calculations
  const days = useMemo(() => {
    const s = new Date(startDate);
    const e = new Date(endDate);
    const diff = Math.round((e - s) / (1000 * 60 * 60 * 24));
    return Math.max(1, diff || 1);
  }, [startDate, endDate]);

  const dailyRate = asset.pricePerDay || 15000;
  const subtotal = days * dailyRate;
  const distance = asset._distanceKm || 6.5;
  const logisticsFee = isDelivery ? calculateLogisticsFare(distance, isRoundTrip) : 0;
  const escrowDeposit = Math.round(dailyRate * 0.5);
  const tokenAmount = Math.round(subtotal * 0.20);
  const grandTotal = subtotal + logisticsFee + escrowDeposit;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      assetId: asset.id,
      bookingMode: mode,
      startDate,
      endDate,
      days,
      isDelivery,
      isRoundTrip,
      deliveryAddress: isDelivery ? address : 'In-Store Pickup',
      logisticsFee,
      subtotal,
      tokenAmount,
      escrowDeposit,
      grandTotal
    });
  };

  return (
    <div className="modal-backdrop active" style={{ display: 'flex' }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-dialog">
        <div className="modal-header">
          <div>
            <div className="modal-title">Commercial Rental Booking Contract</div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Direct B2B Asset Allocation with Escrow Protection</span>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <i data-lucide="x"></i>
          </button>
        </div>

        <form className="modal-body" onSubmit={handleSubmit}>
          {/* Dual Mode Switch */}
          <div className="rental-mode-pill-bar">
            <button
              type="button"
              className={`rental-mode-btn ${mode === 'planned' ? 'active' : ''}`}
              onClick={() => setMode('planned')}
            >
              <i data-lucide="calendar" style={{ width: '0.9rem', height: '0.9rem' }}></i>
              <span>📅 Planned Advance (20% Token)</span>
            </button>
            <button
              type="button"
              className={`rental-mode-btn emergency-mode-btn ${mode === 'emergency' ? 'active' : ''}`}
              onClick={() => { setMode('emergency'); setStartDate(todayStr); }}
            >
              <i data-lucide="zap" style={{ width: '0.9rem', height: '0.9rem' }}></i>
              <span>⚡ Emergency (30–60 Min)</span>
            </button>
          </div>

          {/* Asset Summary */}
          <div className="rental-asset-summary-box">
            <img src={getSafeImageUrl(asset.image, asset.category)} alt={asset.title} style={{ width: '72px', height: '54px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {asset.title}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {asset.shopName} • <span style={{ color: 'var(--accent-primary)', fontWeight: '600' }}>₹{asset.pricePerDay.toLocaleString('en-IN')}/day</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--accent-emerald)', fontWeight: '600', marginTop: '2px' }}>
                📍 {asset.location} ({distance} km away)
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label" htmlFor="rent-start">Rental Start Date</label>
              <input
                type="date"
                id="rent-start"
                className="form-input"
                min={todayStr}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="rent-end">Rental End Date</label>
              <input
                type="date"
                id="rent-end"
                className="form-input"
                min={startDate}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* 3PL Logistics Simulator */}
          <div className="logistics-fare-box">
            <div className="logistics-hdr-row">
              <strong style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.84rem' }}>
                <i data-lucide="truck" style={{ width: '1rem', height: '1rem', color: 'var(--accent-primary)' }}></i>
                <span>3PL Logistics &amp; Transport Mode</span>
              </strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>📍 {distance} km from BKC</span>
            </div>

            <div className="form-row-2" style={{ marginTop: '0.25rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.84rem', cursor: 'pointer', padding: '0.5rem', background: 'var(--card-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <input type="radio" name="logistics-type" checked={!isDelivery} onChange={() => setIsDelivery(false)} />
                <span>In-Store Pickup (Free)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.84rem', cursor: 'pointer', padding: '0.5rem', background: 'var(--card-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <input type="radio" name="logistics-type" checked={isDelivery} onChange={() => setIsDelivery(true)} />
                <span>Site Delivery (3PL Porter/Borzo)</span>
              </label>
            </div>

            {isDelivery && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingTop: '0.35rem', borderTop: '1px dashed var(--border-strong)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span>Simulated 3PL Fare (Base ₹350 + ₹25/km):</span>
                  <strong>₹{logisticsFee.toLocaleString('en-IN')}</strong>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={isRoundTrip} onChange={(e) => setIsRoundTrip(e.target.checked)} style={{ accentColor: 'var(--accent-emerald)' }} />
                  <span>Add Return Leg Logistics (Round-Trip)</span>
                  <span className="logistics-discount-pill">20% OFF Return</span>
                </label>
              </div>
            )}
          </div>

          {isDelivery && (
            <div className="form-group">
              <label className="form-label">Delivery Address / Venue Site</label>
              <input type="text" className="form-input" value={address} onChange={(e) => setAddress(e.target.value)} required />
            </div>
          )}

          {/* Escrow Notice */}
          <div className="escrow-notice-card">
            <i data-lucide="shield-check" style={{ width: '1.25rem', height: '1.25rem', color: 'var(--accent-emerald)', flexShrink: 0 }}></i>
            <div>
              <strong>HospitaLink Platform Escrow Protection:</strong>
              <div style={{ marginTop: '2px' }}>Your security deposit is locked safely in platform escrow. It is released back automatically after the 2-step digital condition audit post-return.</div>
            </div>
          </div>

          {/* Cost Summary Breakdown */}
          <div className="calc-summary-card">
            <div className="calc-row">
              <span>Rental Duration:</span>
              <strong>{days} Day{days > 1 ? 's' : ''}</strong>
            </div>
            <div className="calc-row">
              <span>Base Daily Rental Subtotal:</span>
              <strong>₹{subtotal.toLocaleString('en-IN')}</strong>
            </div>
            <div className="calc-row">
              <span>3PL Logistics Fare:</span>
              <span>{isDelivery ? `₹${logisticsFee.toLocaleString('en-IN')} (${isRoundTrip ? 'Round-Trip -20%' : 'One-Way'})` : '₹0 (In-Store Pickup)'}</span>
            </div>
            {mode === 'planned' && (
              <div className="calc-row" style={{ color: 'var(--accent-primary)', fontWeight: '700' }}>
                <span>20% Token Amount to Lock Date:</span>
                <strong>₹{tokenAmount.toLocaleString('en-IN')}</strong>
              </div>
            )}
            <div className="calc-row">
              <span>Platform Escrow Deposit:</span>
              <span className="security-deposit-badge">₹{escrowDeposit.toLocaleString('en-IN')} (Refundable)</span>
            </div>
            <div className="calc-row grand-total">
              <span>Total Estimated Contract:</span>
              <span style={{ color: 'var(--accent-primary)' }}>₹{grandTotal.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div className="modal-footer" style={{ padding: 0, background: 'transparent', border: 'none', marginTop: '0.5rem' }}>
            <button type="button" className="reset-filters-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary-action">
              <i data-lucide={mode === 'emergency' ? 'zap' : 'lock'} style={{ width: '1rem', height: '1rem' }}></i>
              <span>
                {mode === 'emergency'
                  ? `⚡ Confirm Instant Dispatch (₹${grandTotal.toLocaleString('en-IN')})`
                  : `Lock Date with 20% Token (₹${tokenAmount.toLocaleString('en-IN')})`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- 4. LIST / EDIT ASSET MODAL ---
function ListAssetModal({ asset, currentUser, onClose, onSave }) {
  const isEdit = asset && asset.id;
  const [title, setTitle] = useState(asset?.title || '');
  const [category, setCategory] = useState(asset?.category || 'Venue');
  const [fulfillment, setFulfillment] = useState(asset?.fulfillmentType || 'In-Store Pickup');
  const [shopName, setShopName] = useState(asset?.shopName || (currentUser?.businessName || 'Hospitality Fleet Depot'));
  const [vendorType, setVendorType] = useState(asset?.vendorType || 'Commercial Partner');
  const [location, setLocation] = useState(asset?.location || 'Lower Parel, Mumbai');
  const [rate, setRate] = useState(asset?.pricePerDay || 15000);
  const [status, setStatus] = useState(asset?.availabilityStatus || 'Available');
  const [instantDispatch, setInstantDispatch] = useState(Boolean(asset?.instantDispatchAvailable));
  const [image, setImage] = useState(asset?.image || '');
  const [imgPreview, setImgPreview] = useState(asset?.image || '');

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setImage(event.target.result);
      setImgPreview(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handlePresetImage = (url) => {
    setImage(url);
    setImgPreview(url);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      title,
      category,
      fulfillmentType: fulfillment,
      shopName,
      vendorType,
      location,
      pricePerDay: parseInt(rate, 10),
      availabilityStatus: status,
      instantDispatchAvailable: instantDispatch,
      image: image || getSafeImageUrl('', category)
    }, isEdit ? asset.id : null);
  };

  return (
    <div className="modal-backdrop active" style={{ display: 'flex' }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-dialog">
        <div className="modal-header">
          <div className="modal-title">{isEdit ? 'Edit Commercial Asset' : 'List Commercial Asset for Exchange'}</div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <i data-lucide="x"></i>
          </button>
        </div>

        <form className="modal-body" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="asset-name">Asset Title</label>
            <input type="text" id="asset-name" className="form-input" placeholder="e.g. 500-Seater Banquet & Outdoor Lawn" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label" htmlFor="asset-cat">Category</label>
              <select id="asset-cat" className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="Venue">Venue (Venues &amp; Banquets)</option>
                <option value="Kitchen">Commercial Kitchen</option>
                <option value="Vehicle">Logistics Vehicle</option>
                <option value="Equipment">Event Equipment</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="asset-ful">Fulfillment Mode</label>
              <select id="asset-ful" className="form-select" value={fulfillment} onChange={(e) => setFulfillment(e.target.value)}>
                <option value="In-Store Pickup">In-Store Pickup</option>
                <option value="Site Delivery">Site Delivery</option>
              </select>
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label" htmlFor="asset-shop">Shop / Facility Name</label>
              <input type="text" id="asset-shop" className="form-input" value={shopName} onChange={(e) => setShopName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="asset-vt">Vendor Type</label>
              <input type="text" id="asset-vt" className="form-input" placeholder="e.g. Venue Provider, Kitchen Depot" value={vendorType} onChange={(e) => setVendorType(e.target.value)} required />
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label" htmlFor="asset-loc">MMR Location</label>
              <select id="asset-loc" className="form-select" value={location} onChange={(e) => setLocation(e.target.value)}>
                {Object.keys(MMR_COORDS_MAP).map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="asset-price">Daily Rental Rate (₹)</label>
              <input type="number" id="asset-price" className="form-input" min="500" value={rate} onChange={(e) => setRate(e.target.value)} required />
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label" htmlFor="asset-status">Availability Status</label>
              <select id="asset-status" className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="Available">Available</option>
                <option value="Booked">Booked</option>
              </select>
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', paddingTop: '1.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                <input type="checkbox" checked={instantDispatch} onChange={(e) => setInstantDispatch(e.target.checked)} style={{ accentColor: '#ea580c' }} />
                <span>⚡ Enable 30–60 Min Instant Dispatch</span>
              </label>
            </div>
          </div>

          {/* Image Upload & Presets */}
          <div className="form-group">
            <label className="form-label">Asset Photo (Upload File or Select Preset)</label>
            <input type="file" className="form-control form-control-sm mb-2" accept="image/*" onChange={handleFileUpload} />
            
            <div className="d-flex gap-1 flex-wrap mb-2">
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => handlePresetImage('https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=800&q=80')}>
                🏰 Grand Banquet
              </button>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => handlePresetImage('https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=800&q=80')}>
                🍳 Commercial Kitchen
              </button>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => handlePresetImage('https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80')}>
                🚚 Reefer Van
              </button>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => handlePresetImage('https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=800&q=80')}>
                🔊 Concert AV Setup
              </button>
            </div>

            {imgPreview && (
              <div className="mt-2 text-center border p-2 rounded bg-light">
                <img src={imgPreview} alt="Preview" style={{ maxHeight: '140px', maxWidth: '100%', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
              </div>
            )}
          </div>

          <div className="modal-footer" style={{ padding: 0, background: 'transparent', border: 'none' }}>
            <button type="button" className="reset-filters-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary-action">
              <i data-lucide="check" style={{ width: '1rem', height: '1rem' }}></i>
              <span>{isEdit ? 'Update Asset' : 'Publish to Marketplace'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- 5. NEGOTIATION MODAL ---
function NegotiateModal({ request, onClose, onSubmit }) {
  const [price, setPrice] = useState(Math.round((request.totalAmount || 20000) * 0.95));
  const [message, setMessage] = useState("We can accommodate your booking at this counter rate if site setup is scheduled after 2:00 PM.");

  return (
    <div className="modal-backdrop active" style={{ display: 'flex' }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-dialog">
        <div className="modal-header">
          <div>
            <div className="modal-title">Negotiate Commercial Terms</div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Counter-Offer Proposal for {request.id}</span>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <i data-lucide="x"></i>
          </button>
        </div>

        <form className="modal-body" onSubmit={(e) => { e.preventDefault(); onSubmit(request.id, price, message); }}>
          <div style={{ padding: '0.85rem', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            <div style={{ fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>{request.assetTitle}</div>
            <div>Requester: <strong>{request.seekerBusiness}</strong> ({request.seekerContact})</div>
            <div>Dates: <strong>{request.startDate} to {request.endDate}</strong> ({request.days} days)</div>
            <div>Current Contract Value: <strong>₹{(request.totalAmount || 0).toLocaleString('en-IN')}</strong></div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="neg-price">Counter-Offer Total Amount (₹)</label>
            <input type="number" id="neg-price" className="form-input" min="500" value={price} onChange={(e) => setPrice(parseInt(e.target.value, 10))} required />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="neg-msg">Counter-Offer Rationale / Terms</label>
            <textarea id="neg-msg" className="form-textarea" rows="3" value={message} onChange={(e) => setMessage(e.target.value)} required></textarea>
          </div>

          <div className="modal-footer" style={{ padding: 0, background: 'transparent', border: 'none' }}>
            <button type="button" className="reset-filters-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary-action" style={{ backgroundColor: 'var(--accent-purple)' }}>
              <i data-lucide="send" style={{ width: '1rem', height: '1rem' }}></i>
              <span>Send Counter-Offer</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- 6. 2-STEP CONDITION AUDIT MODAL ---
function ConditionAuditModal({ request, step, setStep, onClose, onSubmit }) {
  return (
    <div className="modal-backdrop active" style={{ display: 'flex' }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-dialog" style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">2-Step Digital Condition Audit &amp; Escrow</div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Pre-Pickup &amp; Post-Return Image Inspection</span>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <i data-lucide="x"></i>
          </button>
        </div>

        <div className="modal-body">
          {/* Step Bar */}
          <div className="audit-step-bar">
            <div className={`audit-step-pill ${step === 1 ? 'active' : ''}`} onClick={() => setStep(1)} style={{ cursor: 'pointer' }}>
              <div className="audit-step-num">1</div>
              <div>
                <div style={{ fontWeight: '700', fontSize: '0.85rem' }}>Pre-Dispatch Verification</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Before leaving provider hub</div>
              </div>
            </div>
            <div className={`audit-step-pill ${step === 2 ? 'active' : ''}`} onClick={() => setStep(2)} style={{ cursor: 'pointer' }}>
              <div className="audit-step-num">2</div>
              <div>
                <div style={{ fontWeight: '700', fontSize: '0.85rem' }}>Post-Return &amp; Escrow Release</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>After venue return completion</div>
              </div>
            </div>
          </div>

          <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <strong>{request.assetTitle}</strong>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Request: {request.id} • Seeker: {request.seekerBusiness}</div>
            </div>
            <span className="status-badge approved">{request.auditStatus || 'Pending Dispatch'}</span>
          </div>

          {step === 1 ? (
            <div>
              <div className="audit-checklist">
                <div style={{ fontWeight: '700', fontSize: '0.82rem', marginBottom: '0.2rem' }}>Pre-Dispatch Quality Checklist:</div>
                <label className="audit-check-item">
                  <input type="checkbox" defaultChecked />
                  <span>Physical exterior clean, no deep dents or structural fractures</span>
                </label>
                <label className="audit-check-item">
                  <input type="checkbox" defaultChecked />
                  <span>Operational testing completed &amp; factory power cables attached</span>
                </label>
                <label className="audit-check-item">
                  <input type="checkbox" defaultChecked />
                  <span>Sanitization seal &amp; food-grade hygiene inspection verified</span>
                </label>
              </div>

              <div className="photo-audit-grid">
                <div className="photo-audit-card">
                  <img src="https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=600&q=80" alt="Pre-Dispatch" />
                  <div className="photo-audit-meta">
                    <span>Pre-Dispatch Photo</span>
                    <span style={{ color: 'var(--accent-emerald)', fontWeight: '700' }}>✓ GPS Timestamped</span>
                  </div>
                </div>
                <div className="photo-audit-card" style={{ border: '1px dashed var(--border-strong)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem', textAlign: 'center' }}>
                  <i data-lucide="camera" style={{ width: '1.8rem', height: '1.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}></i>
                  <span style={{ fontSize: '0.78rem', fontWeight: '600' }}>Attach Inspection Angle</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>JPG, PNG up to 10MB</span>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="audit-checklist">
                <div style={{ fontWeight: '700', fontSize: '0.82rem', marginBottom: '0.2rem' }}>Post-Return Inspection Checklist:</div>
                <label className="audit-check-item">
                  <input type="checkbox" defaultChecked />
                  <span>Returned unit tested functional with no missing components</span>
                </label>
                <label className="audit-check-item">
                  <input type="checkbox" defaultChecked />
                  <span>Zero post-event transit damages or electrical defects</span>
                </label>
                <label className="audit-check-item">
                  <input type="checkbox" defaultChecked />
                  <span>Escrow deposit release authorized for Seeker account</span>
                </label>
              </div>

              <div className="photo-audit-grid">
                <div className="photo-audit-card">
                  <img src="https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=600&q=80" alt="Post-Return" />
                  <div className="photo-audit-meta">
                    <span>Return Inspection Photo</span>
                    <span style={{ color: 'var(--accent-emerald)', fontWeight: '700' }}>✓ Verified Intact</span>
                  </div>
                </div>
                <div className="escrow-notice-card" style={{ margin: 0 }}>
                  <i data-lucide="shield-check" style={{ width: '1.2rem', height: '1.2rem', color: 'var(--accent-emerald)', flexShrink: 0 }}></i>
                  <div>
                    <strong>Escrow Deposit Release: ₹{(request.escrowDeposit || 12500).toLocaleString('en-IN')}</strong>
                    <div style={{ fontSize: '0.75rem' }}>Upon provider sign-off, the 100% refundable deposit is credited back immediately.</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="reset-filters-btn" onClick={onClose}>Close</button>
          <button
            type="button"
            className="btn-primary-action"
            style={{ backgroundColor: step === 1 ? 'var(--accent-primary)' : 'var(--accent-emerald)' }}
            onClick={onSubmit}
          >
            <i data-lucide="shield-check" style={{ width: '1rem', height: '1rem' }}></i>
            <span>{step === 1 ? 'Sign Off Pre-Dispatch' : `Release Escrow Deposit (₹${(request.escrowDeposit || 12500).toLocaleString('en-IN')})`}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// --- 7. QUICK VIEW MODAL ---
function QuickViewModal({ asset, onClose, onRequest }) {
  const coords = asset.coordinates || MMR_DEPOT_COORDS;
  const distance = calculateDistanceKm(MMR_DEPOT_COORDS.lat, MMR_DEPOT_COORDS.lng, coords.lat, coords.lng);

  return (
    <div className="modal-backdrop active" style={{ display: 'flex' }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-dialog">
        <div className="modal-header">
          <div className="modal-title">{asset.title}</div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <i data-lucide="x"></i>
          </button>
        </div>

        <div className="modal-body">
          <div style={{ marginBottom: '1rem', borderRadius: 'var(--radius-md)', overflow: 'hidden', maxHeight: '240px' }}>
            <img src={getSafeImageUrl(asset.image, asset.category)} alt={asset.title} style={{ width: '100%', height: '240px', objectFit: 'cover' }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem' }}>
            <div>
              <span className="category-badge-chip">{asset.category}</span>
              <span className={`status-badge ${asset.availabilityStatus === 'Available' ? 'approved' : 'pending'}`} style={{ marginLeft: '0.5rem' }}>
                {asset.availabilityStatus}
              </span>
              {asset.instantDispatchAvailable && (
                <span className="instant-dispatch-badge" style={{ marginLeft: '0.4rem' }}>⚡ 30-60 Min Dispatch</span>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-primary)' }}>₹{(asset.pricePerDay || 0).toLocaleString('en-IN')}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>per calendar day</div>
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '0.9rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
            <h4 style={{ fontSize: '0.82rem', marginBottom: '0.35rem', color: 'var(--text-primary)' }}>MMR Host Enterprise</h4>
            <div style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--text-primary)' }}>{asset.shopName}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', fontWeight: '600' }}>{asset.vendorType}</div>
          </div>

          <div style={{ border: '1px solid var(--border-subtle)', padding: '0.9rem', borderRadius: 'var(--radius-md)' }}>
            <h4 style={{ fontSize: '0.82rem', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <i data-lucide="map-pin" style={{ width: '1rem', height: '1rem', color: 'var(--accent-rose)' }}></i>
              <span>MMR Hub Location &amp; Proximity</span>
            </h4>
            <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: '600' }}>{asset.location}</div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span className={`fulfillment-badge ${asset.fulfillmentType === 'Site Delivery' ? 'fulfillment-delivery' : 'fulfillment-pickup'}`}>
                {asset.fulfillmentType}
              </span>
              <span className="proximity-tag">📍 {distance} km from BKC</span>
              <span className="coordinates-tag">ID: {asset.id.toUpperCase()}</span>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="reset-filters-btn" onClick={onClose}>Close</button>
          <button type="button" className="btn-primary-action" onClick={onRequest}>
            Request Rental
          </button>
        </div>
      </div>
    </div>
  );
}

// Universal DOM Mount Bootstrap for React 18
function mountReactApp() {
  const container = document.getElementById('root');
  if (container) {
    const root = ReactDOM.createRoot(container);
    root.render(<HospitaLinkApp />);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountReactApp);
} else {
  mountReactApp();
}
