/**
 * HospitaLink B2B Hospitality Resource Exchange
 * React 18 + Bootstrap 5 Full-Stack Frontend Controller
 * 
 * Multi-User System with Real-Time REST API Sync, MongoDB Atlas Cloud Support,
 * Multi-Photo Galleries, Dedicated Seeker/Provider Negotiation Flow,
 * Interactive Checkout & Payment Simulator, Smart Calendar Lock System,
 * Collision/Double-Booking Prevention, 2-Step Condition Audit, and Fleet ROI Simulator.
 */

const { useState, useEffect, useMemo, useCallback, useRef } = React;

// Central Depot Coordinates (BKC Central Logistics Depot)
const MMR_DEPOT_COORDS = { lat: 19.0674, lng: 72.8687 };

// API Endpoint Base
const API_BASE = (typeof window !== 'undefined' && window.location.origin && window.location.origin.startsWith('http'))
  ? (window.location.port === '3001' || !window.location.port ? '/api' : 'http://localhost:3001/api')
  : 'http://localhost:3001/api';

// Verified Image Safe Fallback
function getSafeImageUrl(imgUrl, category = "Venue") {
  if (!imgUrl || typeof imgUrl !== 'string' || imgUrl.includes('photo-1545232979-fbfd43e1d1eb')) {
    return 'https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=1200&q=80';
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

// Smart Match Score Calculator (Returns percentage 80%–99%)
function calculateSmartMatchScore(asset, distanceKm, maxBudget = 50000) {
  let score = 95;
  // Distance factor
  if (distanceKm < 5) score += 3;
  else if (distanceKm > 15) score -= 6;
  else if (distanceKm > 20) score -= 10;
  
  // Rating factor
  if (asset.rating && asset.rating >= 4.9) score += 2;
  
  // Instant dispatch bonus
  if (asset.instantDispatchAvailable) score += 2;
  
  // Availability factor
  if (asset.availabilityStatus === 'Booked') score -= 15;
  
  return Math.min(99, Math.max(78, score));
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

// Check Date Overlap
function checkDateRangeOverlap(startA, endA, startB, endB) {
  if (!startA || !endA || !startB || !endB) return false;
  return (new Date(startA) <= new Date(endB)) && (new Date(endA) >= new Date(startB));
}

// =========================================================================
// MAIN REACT COMPONENT: HospitaLinkApp
// =========================================================================
function HospitaLinkApp() {
  // Theme state
  const [theme, setTheme] = useState(() => localStorage.getItem('hospitalink_theme') || 'light');
  
  // Navigation / View state ('seeker' | 'provider')
  const [currentView, setCurrentView] = useState('seeker');
  const [providerTab, setProviderTab] = useState('pipeline'); // 'pipeline' | 'fleet' | 'sent' | 'calendar' | 'roi'
  const [requestFilterStatus, setRequestFilterStatus] = useState('All');

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
        verified: true,
        rating: 4.9,
        reviewsCount: 38
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
  const [seekerNegotiateAsset, setSeekerNegotiateAsset] = useState(null); // Seeker starting negotiation
  const [providerCounterReq, setProviderCounterReq] = useState(null); // Provider countering
  const [paymentCheckoutData, setPaymentCheckoutData] = useState(null); // Checkout modal
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
    }, 4500);
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
        // Merge enriched photos and specs if available
        const enriched = resResources.value.map(item => {
          const localMatch = (window.inventoryData || []).find(d => d.id === item.id);
          return {
            ...localMatch,
            ...item,
            photos: item.photos && item.photos.length > 0 ? item.photos : (localMatch?.photos || [item.image || getSafeImageUrl('', item.category)]),
            specifications: item.specifications || localMatch?.specifications || ["High Capacity", "Commercial Grade", "FSSAI / Safety Tested"],
            securityDeposit: item.securityDeposit || localMatch?.securityDeposit || Math.round((item.pricePerDay || 15000) * 0.5),
            rating: item.rating || localMatch?.rating || 4.8,
            reviewsCount: item.reviewsCount || localMatch?.reviewsCount || 24,
            completedRentals: item.completedRentals || localMatch?.completedRentals || 35
          };
        });
        setInventory(enriched);
        localStorage.setItem('hospitalink_inventory_mmr_v3', JSON.stringify(enriched));
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
  // API & MUTATION HANDLERS
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
      verified: true,
      rating: 4.8,
      reviewsCount: 15
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

    handleSetCurrentUser({ ...userData, rating: 5.0, reviewsCount: 1 });
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
      verified: true,
      rating: 4.9,
      reviewsCount: 38
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
    const photos = resourceData.photos && resourceData.photos.length > 0 ? resourceData.photos : [resourceData.image || getSafeImageUrl('', resourceData.category)];

    if (editId) {
      // Update
      const updatedList = inventory.map(item => {
        if (item.id === editId) {
          return { ...item, ...resourceData, photos, coordinates: coords, ownerEmail: item.ownerEmail || ownerEmail };
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
          body: JSON.stringify({ ...resourceData, photos, coordinates: coords, ownerEmail })
        });
      } catch (err) {
        console.warn('Update resource API sync:', err);
      }
    } else {
      // Create
      const newAsset = {
        id: `mmr-${Date.now()}`,
        ownerEmail: ownerEmail,
        rating: 5.0,
        reviewsCount: 1,
        completedRentals: 0,
        verified: true,
        ...resourceData,
        photos,
        coordinates: coords,
        bookedDates: []
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

  // 9. Seeker: Initiate Negotiation
  const handleSeekerSendOffer = async (offerData) => {
    const asset = inventory.find(a => a.id === offerData.assetId);
    const providerEmail = (asset?.ownerEmail || "procurement@imperialbanquets.in").toLowerCase();
    const seekerEmail = (currentUser?.email || "events@tajhotels.com").toLowerCase();
    const newRequestId = `REQ-${Math.floor(1000 + Math.random() * 9000)}`;

    const newRequest = {
      id: newRequestId,
      assetId: offerData.assetId,
      assetTitle: asset ? asset.title : 'Hospitality Resource',
      providerEmail: providerEmail,
      seekerEmail: seekerEmail,
      seekerBusiness: currentUser?.businessName || "Taj Lands End Banquets",
      seekerContact: seekerEmail,
      seekerRating: currentUser?.rating || 4.9,
      seekerLocation: currentUser?.location || "Mumbai",
      startDate: offerData.startDate,
      endDate: offerData.endDate,
      days: offerData.days,
      timeSlot: offerData.timeSlot || "Full Day (24 Hrs)",
      quantity: offerData.quantity || 1,
      dailyRate: asset ? asset.pricePerDay : 15000,
      totalAmount: offerData.proposedTotal,
      tokenAmount: Math.round(offerData.proposedTotal * 0.20),
      escrowDeposit: asset?.securityDeposit || 5000,
      bookingMode: "Negotiated Offer",
      deliveryMode: offerData.isDelivery ? "Site Delivery" : "In-Store Pickup",
      deliveryFee: offerData.deliveryFee || 0,
      deliveryLocation: offerData.deliveryAddress || "Mumbai Venue",
      status: "Negotiating",
      seekerOffer: offerData.proposedDailyRate,
      paymentStatus: "Pending Negotiation",
      notes: offerData.message || `Seeker proposed rate of ₹${offerData.proposedDailyRate}/day.`,
      auditStatus: "Pending Dispatch",
      history: [
        {
          sender: "seeker",
          type: "offer",
          amount: offerData.proposedTotal,
          dailyRate: offerData.proposedDailyRate,
          date: new Date().toISOString().split('T')[0],
          message: offerData.message || "Proposed price for event booking."
        }
      ]
    };

    const updatedRequests = [newRequest, ...requests];
    setRequests(updatedRequests);
    localStorage.setItem('hospitalink_requests_mmr_v3', JSON.stringify(updatedRequests));
    setSeekerNegotiateAsset(null);

    showToast({
      title: "💬 Offer Transmitted to Provider",
      message: `Your offer of ₹${offerData.proposedDailyRate.toLocaleString('en-IN')}/day was sent to ${asset?.shopName}.`,
      type: "success"
    });

    try {
      await fetch(`${API_BASE}/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-email': seekerEmail },
        body: JSON.stringify(newRequest)
      });
    } catch (err) {
      console.warn('Negotiation offer API sync:', err);
    }
  };

  // 10. Provider: Send Counter-Offer
  const handleProviderCounterSubmit = async (reqId, counterPrice, counterMessage) => {
    const target = requests.find(r => r.id === reqId);
    if (!target) return;

    const days = target.days || 1;
    const newTotal = counterPrice * days + (target.deliveryFee || 0);
    const newHistory = [
      ...(target.history || []),
      {
        sender: "provider",
        type: "counter",
        amount: newTotal,
        dailyRate: counterPrice,
        date: new Date().toISOString().split('T')[0],
        message: counterMessage
      }
    ];

    const updatedRequests = requests.map(r => {
      if (r.id === reqId) {
        return {
          ...r,
          status: "Negotiating",
          providerCounter: counterPrice,
          totalAmount: newTotal,
          tokenAmount: Math.round(newTotal * 0.20),
          notes: `Provider Counter-Offer: ₹${counterPrice.toLocaleString('en-IN')}/day | Note: ${counterMessage}`,
          history: newHistory
        };
      }
      return r;
    });

    setRequests(updatedRequests);
    localStorage.setItem('hospitalink_requests_mmr_v3', JSON.stringify(updatedRequests));
    setProviderCounterReq(null);

    showToast({
      title: "💬 Counter-Offer Dispatched",
      message: `Transmitted counter-offer of ₹${counterPrice.toLocaleString('en-IN')}/day to seeker.`,
      type: "success"
    });

    try {
      await fetch(`${API_BASE}/requests/${encodeURIComponent(reqId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-email': currentUser?.email || '' },
        body: JSON.stringify({
          status: 'Negotiating',
          providerCounter: counterPrice,
          totalAmount: newTotal,
          tokenAmount: Math.round(newTotal * 0.20),
          notes: `Provider Counter-Offer: ₹${counterPrice.toLocaleString('en-IN')}/day | Note: ${counterMessage}`,
          history: newHistory
        })
      });
    } catch (err) {
      console.warn('Counter offer API sync:', err);
    }
  };

  // 11. Workflow: Accept Request (Provider or Seeker)
  const handleAcceptRequest = async (reqId) => {
    const target = requests.find(r => r.id === reqId);
    if (!target) return;

    // If Seeker is accepting provider's counter, trigger checkout modal directly!
    const isSeeker = currentUser?.email && target.seekerEmail && currentUser.email.toLowerCase() === target.seekerEmail.toLowerCase();
    if (isSeeker) {
      const asset = inventory.find(a => a.id === target.assetId) || {
        id: target.assetId,
        title: target.assetTitle,
        shopName: "Host Enterprise",
        pricePerDay: target.providerCounter || target.dailyRate,
        securityDeposit: target.escrowDeposit || 5000,
        image: getSafeImageUrl('')
      };

      setPaymentCheckoutData({
        requestId: target.id,
        asset: asset,
        startDate: target.startDate,
        endDate: target.endDate,
        days: target.days,
        timeSlot: target.timeSlot || "Full Day (24 Hrs)",
        quantity: target.quantity || 1,
        dailyRate: target.providerCounter || target.dailyRate,
        rentalSubtotal: (target.providerCounter || target.dailyRate) * target.days * (target.quantity || 1),
        logisticsFee: target.deliveryFee || 0,
        escrowDeposit: target.escrowDeposit || 5000,
        tokenAmount: target.tokenAmount || Math.round((target.totalAmount || 15000) * 0.20),
        grandTotal: target.totalAmount || 15000,
        deliveryMode: target.deliveryMode,
        isNegotiated: true
      });
      return;
    }

    // Provider accepting seeker's offer
    const updatedRequests = requests.map(r => r.id === reqId ? {
      ...r,
      status: 'Approved',
      notes: 'Offer Accepted by Provider. Calendar locked.'
    } : r);
    setRequests(updatedRequests);
    localStorage.setItem('hospitalink_requests_mmr_v3', JSON.stringify(updatedRequests));

    // Ensure asset calendar is locked
    const updatedInventory = inventory.map(a => a.id === target.assetId ? {
      ...a,
      availabilityStatus: 'Booked',
      bookedDates: [...(a.bookedDates || []), target.startDate, target.endDate].filter(Boolean)
    } : a);
    setInventory(updatedInventory);
    localStorage.setItem('hospitalink_inventory_mmr_v3', JSON.stringify(updatedInventory));

    showToast({
      title: "✓ Request Approved & Calendar Locked",
      message: `${reqId} confirmed. Dates locked on calendar to prevent double-booking.`,
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

  // 12. Workflow: Reject Request
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
      title: "Request Declined",
      message: `Request ${reqId} was declined. Dates returned to open inventory.`,
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

  // 13. Checkout & Payment Completion Handler
  const handleCompletePayment = async (paymentResult) => {
    const { checkoutData, paymentMethod, paymentDetails } = paymentResult;
    const assetId = checkoutData.asset.id;
    const isExistingReq = Boolean(checkoutData.requestId);
    const reqId = checkoutData.requestId || `REQ-${Math.floor(1000 + Math.random() * 9000)}`;

    // Update or create request
    let updatedRequests;
    if (isExistingReq) {
      updatedRequests = requests.map(r => {
        if (r.id === reqId) {
          return {
            ...r,
            status: "Approved",
            paymentStatus: `Paid via ${paymentMethod}`,
            paymentMethod,
            notes: `✓ Payment Verified (${paymentMethod}). 20% Token Amount locked in Escrow. Calendar Confirmed.`
          };
        }
        return r;
      });
    } else {
      const asset = inventory.find(a => a.id === assetId);
      const newRequest = {
        id: reqId,
        assetId: assetId,
        assetTitle: asset ? asset.title : checkoutData.asset.title,
        providerEmail: (asset?.ownerEmail || "procurement@imperialbanquets.in").toLowerCase(),
        seekerEmail: (currentUser?.email || "events@tajhotels.com").toLowerCase(),
        seekerBusiness: currentUser?.businessName || "Taj Lands End Banquets",
        seekerContact: currentUser?.email || "events@tajhotels.com",
        seekerRating: currentUser?.rating || 4.9,
        seekerLocation: currentUser?.location || "Mumbai",
        startDate: checkoutData.startDate,
        endDate: checkoutData.endDate,
        days: checkoutData.days,
        timeSlot: checkoutData.timeSlot,
        quantity: checkoutData.quantity,
        dailyRate: checkoutData.dailyRate,
        totalAmount: checkoutData.grandTotal,
        tokenAmount: checkoutData.tokenAmount,
        escrowDeposit: checkoutData.escrowDeposit,
        bookingMode: checkoutData.bookingMode === 'emergency' ? 'Emergency Dispatch' : 'Planned Advance',
        deliveryMode: checkoutData.deliveryMode,
        deliveryFee: checkoutData.logisticsFee,
        deliveryLocation: checkoutData.deliveryAddress || "Mumbai Site",
        status: "Approved",
        paymentStatus: `Paid via ${paymentMethod}`,
        paymentMethod,
        notes: `✓ Payment Verified (${paymentMethod}). 20% Token Amount locked in Escrow. Calendar Confirmed.`,
        auditStatus: "Pending Dispatch",
        history: [
          { sender: "seeker", type: "paid", amount: checkoutData.tokenAmount, date: new Date().toISOString().split('T')[0], message: `Payment verified via ${paymentMethod}` }
        ]
      };
      updatedRequests = [newRequest, ...requests];
    }

    setRequests(updatedRequests);
    localStorage.setItem('hospitalink_requests_mmr_v3', JSON.stringify(updatedRequests));

    // Calendar Lock: Mark asset as Booked & add booked dates
    const updatedInventory = inventory.map(a => {
      if (a.id === assetId) {
        const existingDates = Array.isArray(a.bookedDates) ? a.bookedDates : [];
        return {
          ...a,
          availabilityStatus: 'Booked',
          bookedDates: [...existingDates, checkoutData.startDate, checkoutData.endDate].filter(Boolean)
        };
      }
      return a;
    });
    setInventory(updatedInventory);
    localStorage.setItem('hospitalink_inventory_mmr_v3', JSON.stringify(updatedInventory));
    localStorage.setItem('resources', JSON.stringify(updatedInventory));

    // Backend sync
    try {
      if (isExistingReq) {
        await fetch(`${API_BASE}/requests/${encodeURIComponent(reqId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'x-user-email': currentUser?.email || '' },
          body: JSON.stringify({ status: 'Approved', paymentStatus: `Paid via ${paymentMethod}` })
        });
      } else {
        await fetch(`${API_BASE}/requests`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-email': currentUser?.email || '' },
          body: JSON.stringify(updatedRequests[0])
        });
      }
    } catch (err) {
      console.warn('Payment API sync:', err);
    }
  };

  // 14. Workflow: Submit Condition Audit Sign-Off
  const handleAuditSubmit = async () => {
    const req = auditModalReq;
    if (!req) return;

    if (auditStep === 1) {
      const updatedRequests = requests.map(r => r.id === req.id ? { ...r, auditStatus: "Pre-Pickup Verified" } : r);
      setRequests(updatedRequests);
      localStorage.setItem('hospitalink_requests_mmr_v3', JSON.stringify(updatedRequests));
      setAuditStep(2);
      showToast({ title: "Pre-Dispatch Verified", message: "Step 1 condition & hygiene inspection approved.", type: "success" });
    } else {
      const updatedRequests = requests.map(r => r.id === req.id ? { ...r, status: "Completed", auditStatus: "Post-Return Inspected" } : r);
      setRequests(updatedRequests);
      localStorage.setItem('hospitalink_requests_mmr_v3', JSON.stringify(updatedRequests));

      // Release asset to available
      const updatedInventory = inventory.map(a => a.id === req.assetId ? { ...a, availabilityStatus: 'Available' } : a);
      setInventory(updatedInventory);
      localStorage.setItem('hospitalink_inventory_mmr_v3', JSON.stringify(updatedInventory));

      setAuditModalReq(null);
      setAuditStep(1);
      showToast({
        title: "Escrow Deposit Released",
        message: `₹${(req.escrowDeposit || 5000).toLocaleString('en-IN')} security deposit refunded. Rental cycle complete.`,
        type: "success"
      });
    }
  };

  // =========================================================================
  // MEMOIZED FILTERING & METRICS COMPUTATION
  // =========================================================================

  // Enriched inventory with real-time distance and smart match score
  const enrichedInventory = useMemo(() => {
    return inventory.map(asset => {
      const coords = asset.coordinates || MMR_DEPOT_COORDS;
      const distance = calculateDistanceKm(MMR_DEPOT_COORDS.lat, MMR_DEPOT_COORDS.lng, coords.lat, coords.lng);
      const matchScore = calculateSmartMatchScore(asset, distance);
      const photos = asset.photos && asset.photos.length > 0 ? asset.photos : [getSafeImageUrl(asset.image, asset.category)];

      return {
        ...asset,
        _distanceKm: distance,
        _matchScore: matchScore,
        photos: photos,
        rating: asset.rating || 4.8,
        reviewsCount: asset.reviewsCount || 24,
        securityDeposit: asset.securityDeposit || Math.round((asset.pricePerDay || 15000) * 0.5),
        specifications: asset.specifications || ["High Capacity", "Commercial Grade", "Sanitized Unit"]
      };
    });
  }, [inventory]);

  // Filtered Marketplace Assets
  const filteredInventory = useMemo(() => {
    return enrichedInventory.filter(asset => {
      // 1. Category Filter
      if (activeCategory !== 'all' && asset.category !== activeCategory) {
        return false;
      }

      // 2. Emergency Mode Filter
      if (emergencyMode && !asset.instantDispatchAvailable) {
        return false;
      }

      // 3. Radius Filter
      if (selectedRadius !== 'all') {
        const maxKm = parseFloat(selectedRadius);
        if (asset._distanceKm > maxKm) return false;
      }

      // 4. MMR Region Filter
      if (selectedLocation !== 'all' && asset.location !== selectedLocation) {
        return false;
      }

      // 5. Price Range Filter
      if (selectedPriceRange !== 'all') {
        const price = asset.pricePerDay || 0;
        if (selectedPriceRange === 'under-10k' && price >= 10000) return false;
        if (selectedPriceRange === '10k-25k' && (price < 10000 || price > 25000)) return false;
        if (selectedPriceRange === 'above-25k' && price <= 25000) return false;
      }

      // 6. Fulfillment Filter
      if (selectedFulfillment !== 'all' && asset.fulfillmentType !== selectedFulfillment) {
        return false;
      }

      // 7. Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (asset.title || '').toLowerCase().includes(q);
        const matchShop = (asset.shopName || '').toLowerCase().includes(q);
        const matchLoc = (asset.location || '').toLowerCase().includes(q);
        const matchCat = (asset.category || '').toLowerCase().includes(q);
        const matchSpecs = (asset.specifications || []).some(s => s.toLowerCase().includes(q));
        if (!matchTitle && !matchShop && !matchLoc && !matchCat && !matchSpecs) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'distance') return a._distanceKm - b._distanceKm;
      if (sortBy === 'price-low') return (a.pricePerDay || 0) - (b.pricePerDay || 0);
      if (sortBy === 'price-high') return (b.pricePerDay || 0) - (a.pricePerDay || 0);
      if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
      if (sortBy === 'match') return (b._matchScore || 0) - (a._matchScore || 0);
      return (b.instantDispatchAvailable ? 1 : 0) - (a.instantDispatchAvailable ? 1 : 0);
    });
  }, [enrichedInventory, activeCategory, emergencyMode, selectedRadius, selectedLocation, selectedPriceRange, selectedFulfillment, searchQuery, sortBy]);

  // Provider Data (User's owned resources & incoming requests)
  const userFleet = useMemo(() => {
    if (!currentUser || !currentUser.email) return enrichedInventory.slice(0, 3);
    const email = currentUser.email.toLowerCase();
    const isDemoHost = email === "procurement@imperialbanquets.in";
    return enrichedInventory.filter(a => {
      if (isDemoHost) return a.ownerEmail === email || !a.ownerEmail || a.shopName?.includes("Imperial");
      return a.ownerEmail === email;
    });
  }, [enrichedInventory, currentUser]);

  const userIncomingRequests = useMemo(() => {
    if (!currentUser || !currentUser.email) return requests;
    const email = currentUser.email.toLowerCase();
    const isDemoHost = email === "procurement@imperialbanquets.in";
    return requests.filter(r => {
      if (isDemoHost) return r.providerEmail === email || !r.providerEmail;
      return r.providerEmail === email;
    });
  }, [requests, currentUser]);

  const filteredIncomingRequests = useMemo(() => {
    if (requestFilterStatus === 'All') return userIncomingRequests;
    if (requestFilterStatus === 'Pending') return userIncomingRequests.filter(r => r.status === 'Pending');
    if (requestFilterStatus === 'Negotiating') return userIncomingRequests.filter(r => r.status === 'Negotiating');
    if (requestFilterStatus === 'Approved') return userIncomingRequests.filter(r => r.status === 'Approved' || r.status === 'Confirmed');
    if (requestFilterStatus === 'Completed') return userIncomingRequests.filter(r => r.status === 'Completed');
    if (requestFilterStatus === 'Rejected') return userIncomingRequests.filter(r => r.status === 'Rejected');
    return userIncomingRequests;
  }, [userIncomingRequests, requestFilterStatus]);

  const userSeekerRequests = useMemo(() => {
    if (!currentUser || !currentUser.email) return [];
    const email = currentUser.email.toLowerCase();
    return requests.filter(r => r.seekerEmail === email);
  }, [requests, currentUser]);

  // Direct checkout trigger from rental modal
  const handleInitiateDirectCheckout = (bookingData) => {
    setRentalModalAsset(null);
    const asset = inventory.find(a => a.id === bookingData.assetId);

    // Collision check: verify no confirmed booking overlaps
    const hasCollision = requests.some(r =>
      r.assetId === bookingData.assetId &&
      (r.status === 'Approved' || r.status === 'Confirmed') &&
      checkDateRangeOverlap(r.startDate, r.endDate, bookingData.startDate, bookingData.endDate)
    );

    if (hasCollision) {
      showToast({
        title: "⚠️ Collision Detected",
        message: "Resource unavailable — this date range is already locked by another confirmed booking.",
        type: "warning"
      });
      return;
    }

    setPaymentCheckoutData({
      asset: asset || bookingData.asset,
      startDate: bookingData.startDate,
      endDate: bookingData.endDate,
      days: bookingData.days,
      timeSlot: bookingData.timeSlot || "Full Day (24 Hrs)",
      quantity: bookingData.quantity || 1,
      dailyRate: asset ? asset.pricePerDay : 15000,
      rentalSubtotal: bookingData.subtotal,
      logisticsFee: bookingData.logisticsFee,
      escrowDeposit: bookingData.escrowDeposit,
      tokenAmount: bookingData.tokenAmount,
      grandTotal: bookingData.grandTotal,
      bookingMode: bookingData.bookingMode,
      deliveryMode: bookingData.deliveryMode,
      deliveryAddress: bookingData.deliveryAddress
    });
  };

  return (
    <div className="app-container" data-theme={theme}>
      {/* ================= 1. HEADER & TOP NAVIGATION ================= */}
      <header className="site-header">
        <div className="container">
          <nav className="nav-inner" aria-label="Main Navigation">
            {/* Brand Logo & Tagline */}
            <div className="brand-group" onClick={() => handleSwitchView('seeker')} style={{ cursor: 'pointer' }}>
              <div className="brand-logo-icon">
                <i data-lucide="layers"></i>
              </div>
              <div className="brand-title-wrap">
                <div className="brand-name">
                  <span>Hospitality</span><span className="brand-hub-accent">Hub</span>
                  <span className="brand-badge">B2B Exchange</span>
                </div>
                <span className="brand-subtitle">MMR Commercial Fleet Grid</span>
              </div>
            </div>

            {/* View Switcher Pill Navigation */}
            <div className="nav-center-segment">
              <div className="view-switcher-pill" role="tablist">
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
              {/* Add Asset Quick Button */}
              <button
                className="btn btn-sm btn-outline-primary d-none d-md-flex align-items-center gap-1"
                onClick={() => setListModalAsset({})}
                title="List a new resource"
              >
                <i data-lucide="plus-circle" style={{ width: '0.9rem', height: '0.9rem' }}></i>
                <span>+ List Resource</span>
              </button>

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
                    onClick={() => setProfileModalOpen(true)}
                  >
                    <span className="user-dot"></span>
                    <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', lineHeight: '1.1' }}>
                      <span className="user-biz-name">{currentUser.businessName}</span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        ★ {currentUser.rating || 4.9} • {currentUser.businessType}
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
                <span>Verified Commercial Fleet &amp; Equipment Grid</span>
              </div>
              <h1 className="hero-title">
                B2B Hospitality <span className="hero-highlight">Resource Exchange</span>
              </h1>
              <p className="hero-desc">
                Instantly borrow, rent, or monetize high-capacity commercial kitchen assets, luxury banquet setups, 7-seater executive vehicles, cold-chain logistics vans, and event staging equipment across Mumbai and Thane metropolitan hubs.
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
                  <span className="metric-lbl">Photo Condition Audits</span>
                </div>
              </div>

              <div className="metric-strip-card">
                <div className="metric-icon-wrap" style={{ color: 'var(--accent-purple)', backgroundColor: 'var(--accent-purple-subtle)' }}>
                  <i data-lucide="lock"></i>
                </div>
                <div className="metric-text-wrap">
                  <span className="metric-val">🔒 Active</span>
                  <span className="metric-lbl">Calendar Lock &amp; Escrow</span>
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
            {/* Category Pills Navigation with Emojis & Icons */}
            <nav className="category-pills-bar" aria-label="Category filter pills">
              <div className="category-pills-inner">
                {(window.CATEGORIES || [
                  { id: "all", label: "All Categories", icon: "grid", emoji: "🏢" },
                  { id: "Venue", label: "Venues & Banquets", icon: "champagne-glasses", emoji: "🏨" },
                  { id: "Kitchen", label: "Commercial Kitchens", icon: "utensils", emoji: "🍽️" },
                  { id: "Vehicle", label: "Logistics & Vehicles", icon: "truck", emoji: "🚐" },
                  { id: "Equipment", label: "Event Equipment", icon: "speaker", emoji: "🎪" },
                  { id: "Furniture", label: "Hospitality Furniture", icon: "armchair", emoji: "🪑" }
                ]).map(cat => (
                  <button
                    key={cat.id}
                    className={`category-pill ${activeCategory === cat.id ? 'active' : ''}`}
                    onClick={() => setActiveCategory(cat.id)}
                  >
                    <span style={{ fontSize: '1rem', marginRight: '4px' }}>{cat.emoji}</span>
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
                  placeholder="Search 7-seater cars, banquets, combi ovens, reefer vans, lighting rigs..."
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

                {/* Sort By */}
                <div className="filter-group">
                  <label htmlFor="filter-sort">Sort By:</label>
                  <select
                    id="filter-sort"
                    className="filter-select"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <option value="featured">Featured / Instant</option>
                    <option value="match">Smart Match %</option>
                    <option value="distance">Proximity (Nearest)</option>
                    <option value="rating">Top Rated (★)</option>
                    <option value="price-low">Price: Low to High</option>
                    <option value="price-high">Price: High to Low</option>
                  </select>
                </div>

                {/* Reset Filters */}
                <button className="reset-filters-btn" onClick={handleResetFilters} title="Reset all filters">
                  <i data-lucide="rotate-ccw"></i>
                  <span>Reset</span>
                </button>
              </div>
            </div>

            {/* Inventory Grid Section */}
            <div className="inventory-section">
              <div className="inventory-header-row">
                <div className="inventory-count-text">
                  Showing <strong>{filteredInventory.length}</strong> commercial hospitality resources across MMR
                </div>
                <div className="inventory-tag-chips">
                  {emergencyMode && <span className="inventory-chip-warn">⚡ 30-60 Min Instant Dispatch Active</span>}
                  {activeCategory !== 'all' && <span className="inventory-chip-info">Category: {activeCategory}</span>}
                </div>
              </div>

              {filteredInventory.length === 0 ? (
                <div className="empty-state-card">
                  <div className="empty-icon-wrap">
                    <i data-lucide="search-x"></i>
                  </div>
                  <h3 className="empty-title">No Hospitality Assets Found</h3>
                  <p className="empty-desc">
                    No resources matched your current filter criteria. Try clearing radius or category constraints.
                  </p>
                  <button className="btn-primary-action" onClick={handleResetFilters}>
                    <i data-lucide="rotate-ccw" style={{ width: '1rem', height: '1rem' }}></i>
                    <span>Reset All Filters</span>
                  </button>
                </div>
              ) : (
                <div className="inventory-grid">
                  {filteredInventory.map(asset => (
                    <ResourceCard
                      key={asset.id}
                      asset={asset}
                      onQuickView={() => setQuickViewAsset(asset)}
                      onRent={() => setRentalModalAsset(asset)}
                      onNegotiate={() => setSeekerNegotiateAsset(asset)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      )}

      {/* ================= 4. VIEW: PROVIDER DASHBOARD ================= */}
      {currentView === 'provider' && (
        <main className="view-container active" id="view-provider">
          <div className="container">
            {/* Provider Top Header */}
            <div className="prov-header-banner">
              <div className="prov-header-info">
                <div className="prov-avatar-icon">
                  <i data-lucide="building-2"></i>
                </div>
                <div>
                  <div className="d-flex align-items-center gap-2">
                    <h2 className="prov-biz-name">{currentUser?.businessName || "Hospitality Fleet Depot"}</h2>
                    <span className="trust-verified-chip">✓ Verified Business</span>
                  </div>
                  <p className="prov-biz-meta">
                    {currentUser?.businessType || "Hospitality Partner"} • {currentUser?.location || "Mumbai Hub"} • ★ {currentUser?.rating || 4.9} ({currentUser?.reviewsCount || 38} Reviews)
                  </p>
                </div>
              </div>

              <div className="prov-header-actions">
                <button className="btn-primary-action" onClick={() => setListModalAsset({})}>
                  <i data-lucide="plus-circle" style={{ width: '1rem', height: '1rem' }}></i>
                  <span>+ List Commercial Resource</span>
                </button>
              </div>
            </div>

            {/* Provider Navigation Tabs */}
            <nav className="prov-tab-nav" aria-label="Provider Sub-navigation">
              <button
                className={`prov-tab-btn ${providerTab === 'pipeline' ? 'active' : ''}`}
                onClick={() => setProviderTab('pipeline')}
              >
                <i data-lucide="inbox"></i>
                <span>Incoming Requests Pipeline</span>
                {userIncomingRequests.filter(r => r.status === 'Pending' || r.status === 'Negotiating').length > 0 && (
                  <span className="tab-counter-badge">
                    {userIncomingRequests.filter(r => r.status === 'Pending' || r.status === 'Negotiating').length}
                  </span>
                )}
              </button>

              <button
                className={`prov-tab-btn ${providerTab === 'fleet' ? 'active' : ''}`}
                onClick={() => setProviderTab('fleet')}
              >
                <i data-lucide="layers"></i>
                <span>My Listed Resources ({userFleet.length})</span>
              </button>

              <button
                className={`prov-tab-btn ${providerTab === 'sent' ? 'active' : ''}`}
                onClick={() => setProviderTab('sent')}
              >
                <i data-lucide="send"></i>
                <span>My Outgoing Bookings ({userSeekerRequests.length})</span>
              </button>

              <button
                className={`prov-tab-btn ${providerTab === 'calendar' ? 'active' : ''}`}
                onClick={() => setProviderTab('calendar')}
              >
                <i data-lucide="calendar"></i>
                <span>Fleet Calendar Schedule</span>
              </button>

              <button
                className={`prov-tab-btn ${providerTab === 'roi' ? 'active' : ''}`}
                onClick={() => setProviderTab('roi')}
              >
                <i data-lucide="calculator"></i>
                <span>Monetization &amp; ROI Simulator</span>
              </button>
            </nav>

            {/* TAB 1: INCOMING REQUESTS PIPELINE */}
            {providerTab === 'pipeline' && (
              <div className="dash-card">
                <div className="dash-card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
                  <div>
                    <h3 className="dash-card-title">Commercial Booking &amp; Negotiation Pipeline</h3>
                    <span className="dash-card-subtitle">Review incoming seeker requests, negotiate rates, accept contracts, and perform condition sign-offs</span>
                  </div>

                  {/* Filter Status Chips */}
                  <div className="d-flex gap-1 flex-wrap">
                    {['All', 'Pending', 'Negotiating', 'Approved', 'Completed', 'Rejected'].map(st => (
                      <button
                        key={st}
                        className={`btn btn-xs ${requestFilterStatus === st ? 'btn-primary' : 'btn-outline-secondary'}`}
                        style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-pill)' }}
                        onClick={() => setRequestFilterStatus(st)}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="table-responsive">
                  <table className="prov-table">
                    <thead>
                      <tr>
                        <th>Booking ID</th>
                        <th>Seeker Business Info</th>
                        <th>Resource Requested</th>
                        <th>Dates &amp; Time</th>
                        <th>Financials &amp; Offer</th>
                        <th>Current Status</th>
                        <th>Inspection Audit</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredIncomingRequests.length === 0 ? (
                        <tr>
                          <td colSpan="8" style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
                            <div style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>No booking requests found for this filter.</div>
                            <div style={{ fontSize: '0.8rem' }}>When seekers request or negotiate on your resources, they will appear here.</div>
                          </td>
                        </tr>
                      ) : (
                        filteredIncomingRequests.map(req => {
                          const isPending = req.status === 'Pending';
                          const isNegotiating = req.status === 'Negotiating';
                          const isApproved = req.status === 'Approved' || req.status === 'Confirmed';
                          const isCompleted = req.status === 'Completed';
                          const isRejected = req.status === 'Rejected';

                          return (
                            <tr key={req.id}>
                              <td>
                                <strong style={{ color: 'var(--accent-primary)', fontSize: '0.85rem' }}>{req.id}</strong>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{req.bookingMode || 'Standard'}</div>
                              </td>
                              <td>
                                <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{req.seekerBusiness}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  ★ {req.seekerRating || 4.8} • {req.seekerLocation || "Mumbai"}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--accent-primary)' }}>{req.seekerContact}</div>
                              </td>
                              <td>
                                <div style={{ fontWeight: '600', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={req.assetTitle}>
                                  {req.assetTitle}
                                </div>
                                <span className={`fulfillment-badge ${req.deliveryMode?.includes('Delivery') ? 'fulfillment-delivery' : 'fulfillment-pickup'}`} style={{ fontSize: '0.68rem' }}>
                                  {req.deliveryMode || 'In-Store Pickup'}
                                </span>
                              </td>
                              <td>
                                <div style={{ fontWeight: '600' }}>{req.startDate} → {req.endDate}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  {req.days} Day{req.days > 1 ? 's' : ''} • {req.timeSlot || 'Full Day'}
                                </div>
                              </td>
                              <td>
                                <div><strong>Total: ₹{(req.totalAmount || 0).toLocaleString('en-IN')}</strong></div>
                                {req.seekerOffer && (
                                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-primary)' }}>
                                    Seeker Offer: ₹{req.seekerOffer.toLocaleString('en-IN')}/d
                                  </div>
                                )}
                                {req.providerCounter && (
                                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-purple)', fontWeight: '600' }}>
                                    Your Counter: ₹{req.providerCounter.toLocaleString('en-IN')}/d
                                  </div>
                                )}
                                <div style={{ fontSize: '0.72rem', color: 'var(--accent-emerald)', fontWeight: '600' }}>
                                  Token (20%): ₹{(req.tokenAmount || Math.round((req.totalAmount || 0) * 0.2)).toLocaleString('en-IN')}
                                </div>
                              </td>
                              <td>
                                <span className={`status-badge ${isApproved ? 'approved' : (isNegotiating ? 'negotiating' : (isCompleted ? 'completed' : (isRejected ? 'rejected' : 'pending')))}`}>
                                  {isApproved ? '🟢 APPROVED' : (isNegotiating ? '🟡 NEGOTIATING' : (isCompleted ? '⚪ COMPLETED' : (isRejected ? '🔴 REJECTED' : '🟡 PENDING')))}
                                </span>
                                {req.paymentStatus && (
                                  <div style={{ fontSize: '0.68rem', color: 'var(--accent-emerald)', fontWeight: '600', marginTop: '2px' }}>
                                    ✓ {req.paymentStatus}
                                  </div>
                                )}
                              </td>
                              <td>
                                <button
                                  className="action-table-btn btn-audit"
                                  onClick={() => { setAuditModalReq(req); setAuditStep(req.auditStatus === 'Pre-Pickup Verified' ? 2 : 1); }}
                                  title="View/Sign Digital Condition Audit"
                                >
                                  <i data-lucide="clipboard-check" style={{ width: '0.85rem', height: '0.85rem' }}></i>
                                  <span>{req.auditStatus || 'Pending Dispatch'}</span>
                                </button>
                              </td>
                              <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                {(isPending || isNegotiating) && (
                                  <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                                    <button className="action-table-btn btn-accept" onClick={() => handleAcceptRequest(req.id)} title="Accept Booking & Lock Calendar">
                                      <i data-lucide="check" style={{ width: '0.85rem', height: '0.85rem' }}></i> Accept
                                    </button>
                                    <button className="action-table-btn btn-negotiate" onClick={() => setProviderCounterReq(req)} title="Send Counter-Offer">
                                      <i data-lucide="message-square" style={{ width: '0.85rem', height: '0.85rem' }}></i> Counter
                                    </button>
                                    <button className="action-table-btn btn-reject" onClick={() => handleRejectRequest(req.id)} title="Decline Request">
                                      <i data-lucide="x" style={{ width: '0.85rem', height: '0.85rem' }}></i>
                                    </button>
                                  </div>
                                )}
                                {isApproved && (
                                  <span className="text-success fw-bold small">🔒 Dates Locked</span>
                                )}
                                {isCompleted && (
                                  <span className="text-muted small">✓ Settled</span>
                                )}
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

            {/* TAB 2: MY LISTED RESOURCES (FLEET) */}
            {providerTab === 'fleet' && (
              <div className="dash-card">
                <div className="dash-card-header d-flex justify-content-between align-items-center">
                  <div>
                    <h3 className="dash-card-title">Commercial Inventory &amp; Fleet Management</h3>
                    <span className="dash-card-subtitle">Active hospitality nodes registered under your organization</span>
                  </div>
                  <button className="btn-primary-action btn-sm" onClick={() => setListModalAsset({})}>
                    <i data-lucide="plus-circle" style={{ width: '0.9rem', height: '0.9rem' }}></i>
                    <span>Add New Asset</span>
                  </button>
                </div>

                <div className="table-responsive">
                  <table className="prov-table">
                    <thead>
                      <tr>
                        <th>Photo</th>
                        <th>Asset Title</th>
                        <th>Category</th>
                        <th>Facility Name</th>
                        <th>Location</th>
                        <th>Price &amp; Deposit</th>
                        <th>Availability</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userFleet.length === 0 ? (
                        <tr>
                          <td colSpan="8" style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📦</div>
                            <div style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>No commercial resources listed yet.</div>
                            <div style={{ fontSize: '0.8rem' }}>Click "+ Add New Asset" to list banquets, kitchens, vehicles, or equipment.</div>
                          </td>
                        </tr>
                      ) : (
                        userFleet.map(asset => {
                          const isAvail = asset.availabilityStatus === 'Available';
                          return (
                            <tr key={asset.id}>
                              <td>
                                <img
                                  src={getSafeImageUrl(asset.photos?.[0] || asset.image, asset.category)}
                                  alt={asset.title}
                                  style={{ width: '56px', height: '42px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                                />
                              </td>
                              <td>
                                <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{asset.title}</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ID: {asset.id.toUpperCase()}</div>
                                {asset.instantDispatchAvailable && (
                                  <span className="instant-dispatch-badge" style={{ fontSize: '0.65rem' }}>⚡ 30-60m Dispatch</span>
                                )}
                              </td>
                              <td><span className="category-badge-chip">{asset.category}</span></td>
                              <td>{asset.shopName}</td>
                              <td>{asset.location}</td>
                              <td>
                                <strong>₹{(asset.pricePerDay || 0).toLocaleString('en-IN')}</strong>/d
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Dep: ₹{(asset.securityDeposit || 5000).toLocaleString('en-IN')}</div>
                              </td>
                              <td>
                                <button
                                  className={`status-badge ${isAvail ? 'approved' : 'pending'}`}
                                  onClick={() => handleToggleAvailability(asset.id)}
                                  style={{ cursor: 'pointer', border: 'none' }}
                                  title="Click to toggle Available / Booked"
                                >
                                  {isAvail ? '🟢 AVAILABLE' : '🔵 BOOKED'} ↻
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

            {/* TAB 3: MY OUTGOING BOOKINGS (SEEKER OUTBOX) */}
            {providerTab === 'sent' && (
              <div className="dash-card">
                <div className="dash-card-header">
                  <div>
                    <h3 className="dash-card-title">My Outgoing Rental Requests &amp; Orders</h3>
                    <span className="dash-card-subtitle">Track bookings requested by you, review provider counter-offers, and proceed to payment</span>
                  </div>
                </div>

                <div className="table-responsive">
                  <table className="prov-table">
                    <thead>
                      <tr>
                        <th>Booking ID</th>
                        <th>Resource</th>
                        <th>Dates &amp; Time</th>
                        <th>Contract Value</th>
                        <th>Token Amount</th>
                        <th>Status</th>
                        <th>Terms / Counter-Offers</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userSeekerRequests.length === 0 ? (
                        <tr>
                          <td colSpan="8" style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📤</div>
                            <div style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>You have not sent any rental requests yet.</div>
                            <div style={{ fontSize: '0.8rem' }}>Browse the Seeker Marketplace and click 'Request Rental' or 'Negotiate' on any asset.</div>
                          </td>
                        </tr>
                      ) : (
                        userSeekerRequests.map(req => {
                          const hasCounter = Boolean(req.providerCounter);
                          const isNegotiating = req.status === 'Negotiating';

                          return (
                            <tr key={req.id}>
                              <td><strong style={{ color: 'var(--accent-primary)' }}>{req.id}</strong></td>
                              <td>
                                <div style={{ fontWeight: '600' }}>{req.assetTitle}</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{req.deliveryMode}</div>
                              </td>
                              <td>{req.startDate} → {req.endDate} ({req.days}d)</td>
                              <td><strong>₹{(req.totalAmount || 0).toLocaleString('en-IN')}</strong></td>
                              <td><span style={{ color: 'var(--accent-emerald)', fontWeight: '600' }}>₹{(req.tokenAmount || 0).toLocaleString('en-IN')}</span></td>
                              <td>
                                <span className={`status-badge ${req.status === 'Approved' ? 'approved' : (req.status === 'Negotiating' ? 'negotiating' : (req.status === 'Rejected' ? 'rejected' : 'pending'))}`}>
                                  {req.status === 'Approved' ? '🟢 APPROVED' : (req.status === 'Negotiating' ? '🟡 NEGOTIATING' : req.status)}
                                </span>
                              </td>
                              <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)', maxWidth: '240px' }}>
                                {hasCounter ? (
                                  <div style={{ color: 'var(--accent-purple)', fontWeight: '600' }}>
                                    Provider Countered: ₹{req.providerCounter.toLocaleString('en-IN')}/d
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{req.notes}</div>
                                  </div>
                                ) : (
                                  req.notes || 'Standard booking'
                                )}
                              </td>
                              <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                {isNegotiating && hasCounter && (
                                  <div className="d-flex gap-1 justify-content-end">
                                    <button
                                      className="btn btn-xs btn-success d-flex align-items-center gap-1"
                                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                                      onClick={() => handleAcceptRequest(req.id)}
                                      title="Accept counter-offer & open checkout"
                                    >
                                      <i data-lucide="credit-card" style={{ width: '0.8rem', height: '0.8rem' }}></i>
                                      <span>Pay &amp; Lock</span>
                                    </button>
                                    <button
                                      className="btn btn-xs btn-outline-danger"
                                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                                      onClick={() => handleRejectRequest(req.id)}
                                      title="Decline counter-offer"
                                    >
                                      Decline
                                    </button>
                                  </div>
                                )}
                                {req.status === 'Approved' && (
                                  <span className="badge bg-success">✓ Confirmed &amp; Locked</span>
                                )}
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

            {/* TAB 4: CALENDAR & AVAILABILITY SCHEDULE */}
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
                      const activeBookings = requests.filter(r => r.assetId === asset.id && (r.status === 'Approved' || r.status === 'Confirmed'));

                      return (
                        <div key={asset.id} className="col-md-6 col-lg-4">
                          <div className="border rounded p-3 bg-body" style={{ height: '100%', borderRadius: 'var(--radius-md)' }}>
                            <div className="d-flex justify-content-between align-items-start mb-2">
                              <h6 className="fw-bold mb-0 text-truncate" title={asset.title}>{asset.title}</h6>
                              <span className={`badge ${isAvailStatusBadge(asset.availabilityStatus)}`}>
                                {isBooked ? '🔒 LOCKED' : '🟢 OPEN'}
                              </span>
                            </div>
                            <div className="small text-muted mb-2">{asset.category} • {asset.location}</div>

                            {/* Calendar Days Simulation Box */}
                            <div className="mb-2">
                              <div className="d-flex justify-content-between small text-muted mb-1">
                                <span>September 2026</span>
                                <span>Status Timeline</span>
                              </div>
                              <div className="calendar-grid-wrapper">
                                {[24, 25, 26, 27, 28, 29, 30].map(day => {
                                  const dateStr = `2026-09-${day < 10 ? '0' + day : day}`;
                                  const isDateBooked = isBooked || (asset.bookedDates || []).includes(dateStr);
                                  return (
                                    <div
                                      key={day}
                                      className={`calendar-day-cell ${isDateBooked ? 'booked' : 'available'}`}
                                      title={isDateBooked ? `${dateStr}: 🔒 Locked` : `${dateStr}: 🟢 Available`}
                                    >
                                      <span>{day}</span>
                                      <span style={{ fontSize: '0.65rem' }}>{isDateBooked ? '🔒' : '✓'}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="p-2 rounded bg-light border mb-2 small">
                              <strong>Current Lock State: </strong>
                              {isBooked ? (
                                <span className="text-danger fw-bold">🔒 Locked for Confirmed Booking</span>
                              ) : (
                                <span className="text-success fw-bold">🟢 Available for Instant Request</span>
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
                    <span>Hospitality</span><span className="brand-hub-accent">Hub</span>
                    <span className="brand-badge">B2B Exchange</span>
                  </div>
                  <span className="brand-subtitle" style={{ color: '#94a3b8' }}>MMR Commercial Grid</span>
                </div>
              </div>
              <p className="footer-desc">
                Mumbai Metropolitan Region's verified B2B hospitality asset exchange platform. Enabling cross-utilization of venues, commercial kitchen capacity, executive vehicles, cold-chain transport, and event production staging equipment.
              </p>
            </div>

            <div className="footer-links-grid">
              <div className="footer-col">
                <h4 className="footer-col-title">Hospitality Sectors</h4>
                <ul className="footer-list">
                  <li><a href="#" onClick={(e) => { e.preventDefault(); setActiveCategory('Venue'); handleSwitchView('seeker'); }}>Hotels &amp; Banquets</a></li>
                  <li><a href="#" onClick={(e) => { e.preventDefault(); setActiveCategory('Kitchen'); handleSwitchView('seeker'); }}>Commercial Kitchens</a></li>
                  <li><a href="#" onClick={(e) => { e.preventDefault(); setActiveCategory('Vehicle'); handleSwitchView('seeker'); }}>Executive 7-Seater &amp; Reefer Vans</a></li>
                  <li><a href="#" onClick={(e) => { e.preventDefault(); setActiveCategory('Equipment'); handleSwitchView('seeker'); }}>Event Staging &amp; AV Rigging</a></li>
                </ul>
              </div>

              <div className="footer-col">
                <h4 className="footer-col-title">Platform Features</h4>
                <ul className="footer-list">
                  <li><a href="#" onClick={(e) => { e.preventDefault(); toggleEmergencyMode(); }}>⚡ 30-60 Min Emergency Dispatch</a></li>
                  <li><a href="#" onClick={(e) => { e.preventDefault(); setProviderTab('roi'); handleSwitchView('provider'); }}>Fleet Monetization Simulator</a></li>
                  <li><a href="#" onClick={(e) => { e.preventDefault(); handleSwitchView('provider'); }}>2-Step Condition Audit</a></li>
                  <li><a href="#" onClick={(e) => { e.preventDefault(); handleSwitchView('seeker'); }}>3PL Logistics Calculator</a></li>
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
            <span>&copy; {new Date().getFullYear()} HospitalityHub B2B Hospitality Exchange Ltd. All rights reserved.</span>
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
          onSubmit={handleInitiateDirectCheckout}
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

      {/* MODAL 5: DEDICATED SEEKER NEGOTIATION MODAL */}
      {seekerNegotiateAsset && (
        <SeekerNegotiateModal
          asset={seekerNegotiateAsset}
          currentUser={currentUser}
          onClose={() => setSeekerNegotiateAsset(null)}
          onSubmit={handleSeekerSendOffer}
        />
      )}

      {/* MODAL 6: DEDICATED PROVIDER COUNTER-OFFER MODAL */}
      {providerCounterReq && (
        <ProviderCounterModal
          request={providerCounterReq}
          onClose={() => setProviderCounterReq(null)}
          onSubmit={handleProviderCounterSubmit}
        />
      )}

      {/* MODAL 7: CHECKOUT & PAYMENT SIMULATION MODAL */}
      {paymentCheckoutData && (
        <PaymentCheckoutModal
          checkoutData={paymentCheckoutData}
          currentUser={currentUser}
          onClose={() => setPaymentCheckoutData(null)}
          onSuccess={handleCompletePayment}
          onNavigateToBookings={() => {
            setPaymentCheckoutData(null);
            setProviderTab('sent');
            handleSwitchView('provider');
          }}
        />
      )}

      {/* MODAL 8: 2-STEP DIGITAL CONDITION AUDIT */}
      {auditModalReq && (
        <ConditionAuditModal
          request={auditModalReq}
          step={auditStep}
          setStep={setAuditStep}
          onClose={() => setAuditModalReq(null)}
          onSubmit={handleAuditSubmit}
        />
      )}

      {/* MODAL 9: ENRICHED QUICK VIEW & DETAILS MODAL */}
      {quickViewAsset && (
        <QuickViewModal
          asset={quickViewAsset}
          onClose={() => setQuickViewAsset(null)}
          onRequest={() => {
            const a = quickViewAsset;
            setQuickViewAsset(null);
            setRentalModalAsset(a);
          }}
          onNegotiate={() => {
            const a = quickViewAsset;
            setQuickViewAsset(null);
            setSeekerNegotiateAsset(a);
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
// SUB-COMPONENTS & MODALS
// =========================================================================

// --- PHOTO GALLERY COMPONENT ---
function PhotoGallery({ photos, title }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const photoList = Array.isArray(photos) && photos.length > 0
    ? photos
    : ['https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=1200&q=80'];

  const handlePrev = (e) => {
    e.stopPropagation();
    setActiveIdx(prev => (prev === 0 ? photoList.length - 1 : prev - 1));
  };

  const handleNext = (e) => {
    e.stopPropagation();
    setActiveIdx(prev => (prev === photoList.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="gallery-container">
      <div className="gallery-main-wrap">
        <img src={photoList[activeIdx]} alt={`${title} - view ${activeIdx + 1}`} className="gallery-main-img" />

        {photoList.length > 1 && (
          <>
            <button type="button" className="gallery-nav-btn prev" onClick={handlePrev} aria-label="Previous photo">
              <i data-lucide="chevron-left"></i>
            </button>
            <button type="button" className="gallery-nav-btn next" onClick={handleNext} aria-label="Next photo">
              <i data-lucide="chevron-right"></i>
            </button>
            <span className="gallery-counter-badge">{activeIdx + 1} / {photoList.length}</span>
          </>
        )}
      </div>

      {photoList.length > 1 && (
        <div className="gallery-thumbs-row">
          {photoList.map((img, idx) => (
            <button
              key={idx}
              type="button"
              className={`gallery-thumb-btn ${activeIdx === idx ? 'active' : ''}`}
              onClick={(e) => { e.stopPropagation(); setActiveIdx(idx); }}
            >
              <img src={img} alt={`Thumbnail ${idx + 1}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// --- RESOURCE CARD COMPONENT ---
function ResourceCard({ asset, onQuickView, onRent, onNegotiate }) {
  const isAvail = asset.availabilityStatus === 'Available';
  const mainPhoto = asset.photos?.[0] || asset.image || getSafeImageUrl('', asset.category);

  return (
    <div className="resource-card">
      <div className="resource-card-media" onClick={onQuickView} style={{ cursor: 'pointer' }}>
        <img src={mainPhoto} alt={asset.title} loading="lazy" />

        {/* Top Badges */}
        <div className="card-top-badges">
          <span className="category-badge-chip">{asset.category}</span>
          <span className="smart-match-pill" title="Computed proximity, budget & reliability compatibility">
            🎯 {asset._matchScore || 94}% Match
          </span>
        </div>

        {/* Instant Dispatch Pill */}
        {asset.instantDispatchAvailable && (
          <div className="instant-dispatch-badge">⚡ 30–60 Min Dispatch</div>
        )}

        {/* Availability Pill */}
        <div className="card-avail-pill">
          <span className={`status-badge ${isAvail ? 'approved' : 'pending'}`}>
            {isAvail ? '🟢 AVAILABLE' : '🔒 BOOKED'}
          </span>
        </div>
      </div>

      <div className="resource-card-body">
        <div className="resource-vendor-row">
          <span className="resource-vendor-name">{asset.shopName}</span>
          <span className="trust-rating-chip">★ {asset.rating || 4.8} ({asset.reviewsCount || 24})</span>
        </div>

        <h3 className="resource-title" onClick={onQuickView} style={{ cursor: 'pointer' }}>
          {asset.title}
        </h3>

        {/* Specifications Snippets */}
        <div className="spec-tags-grid">
          {(asset.specifications || []).slice(0, 2).map((spec, i) => (
            <span key={i} className="spec-tag">{spec}</span>
          ))}
        </div>

        <div className="resource-location-row">
          <span className="resource-loc-text">
            <i data-lucide="map-pin" style={{ width: '0.85rem', height: '0.85rem', color: 'var(--accent-rose)', display: 'inline', verticalAlign: 'middle', marginRight: '2px' }}></i>
            {asset.location}
          </span>
          <span className="resource-dist-text">📍 {asset._distanceKm || 6.5} km</span>
        </div>

        <div className="resource-price-footer">
          <div>
            <span className="price-val">₹{(asset.pricePerDay || 0).toLocaleString('en-IN')}</span>
            <span className="price-unit"> / day</span>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Dep: ₹{(asset.securityDeposit || 5000).toLocaleString('en-IN')} (Refundable)
            </div>
          </div>

          <div className="card-actions-row">
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={onNegotiate}
              title="Propose a custom rental rate"
            >
              <i data-lucide="message-square" style={{ width: '0.85rem', height: '0.85rem' }}></i>
              <span>Negotiate</span>
            </button>
            <button
              className="btn-primary-action btn-sm"
              onClick={onRent}
              disabled={!isAvail}
              title={isAvail ? "Request instant booking contract" : "Resource currently booked"}
            >
              <i data-lucide={isAvail ? "calendar" : "lock"} style={{ width: '0.85rem', height: '0.85rem' }}></i>
              <span>{isAvail ? "Request Rental" : "Locked"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

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
                  🏛️ Imperial Banquets (Host)
                </button>
                <button type="button" className="demo-quick-btn" onClick={() => onDemoLogin(1)}>
                  👨‍🍳 Metro Catering (Logistics)
                </button>
                <button type="button" className="demo-quick-btn" onClick={() => onDemoLogin(2)}>
                  🎪 Grand Event Supplies (Seeker)
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
            <div className="modal-title">Enterprise Profile &amp; Trust Space</div>
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
            <span className="coordinates-tag">Rating: ★ {user.rating || 4.9}</span>
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

// --- 3. RENTAL BOOKING MODAL (Step 1: Configure Dates & 3PL Logistics) ---
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
  const [timeSlot, setTimeSlot] = useState(asset.timeSlots?.[0] || "Full Day (24 Hrs)");
  const [quantity, setQuantity] = useState(1);
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
  const subtotal = days * dailyRate * quantity;
  const distance = asset._distanceKm || 6.5;
  const logisticsFee = isDelivery ? calculateLogisticsFare(distance, isRoundTrip) : 0;
  const escrowDeposit = asset.securityDeposit || Math.round(dailyRate * 0.5);
  const tokenAmount = Math.round(subtotal * 0.20);
  const grandTotal = subtotal + logisticsFee + escrowDeposit;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      assetId: asset.id,
      asset: asset,
      bookingMode: mode,
      startDate,
      endDate,
      days,
      timeSlot,
      quantity,
      isDelivery,
      isRoundTrip,
      deliveryMode: isDelivery ? (isRoundTrip ? 'Site Delivery (Round-Trip -20%)' : 'Site Delivery') : 'In-Store Pickup',
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
            <div className="modal-title">Configure Rental &amp; Logistics</div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Direct B2B Asset Allocation &amp; Escrow Deposit</span>
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
              <span>📅 Planned Advance Booking</span>
            </button>
            <button
              type="button"
              className={`rental-mode-btn emergency-mode-btn ${mode === 'emergency' ? 'active' : ''}`}
              onClick={() => { setMode('emergency'); setStartDate(todayStr); }}
            >
              <i data-lucide="zap" style={{ width: '0.9rem', height: '0.9rem' }}></i>
              <span>⚡ Emergency (30–60 Min Dispatch)</span>
            </button>
          </div>

          {/* Asset Summary */}
          <div className="rental-asset-summary-box">
            <img src={getSafeImageUrl(asset.photos?.[0] || asset.image, asset.category)} alt={asset.title} style={{ width: '72px', height: '54px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
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

          {/* Dates & Time Slots */}
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

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Time Slot Duration</label>
              <select className="form-select" value={timeSlot} onChange={(e) => setTimeSlot(e.target.value)}>
                {(asset.timeSlots || ["Full Day (24 Hrs)", "Morning (8 AM – 2 PM)", "Evening (5 PM – 12 AM)"]).map(slot => (
                  <option key={slot} value={slot}>{slot}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Quantity Needed</label>
              <input
                type="number"
                className="form-input"
                min="1"
                max={asset.quantityAvailable || 10}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
              />
            </div>
          </div>

          {/* 3PL Logistics Simulator */}
          <div className="logistics-fare-box">
            <div className="logistics-hdr-row">
              <strong style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.84rem' }}>
                <i data-lucide="truck" style={{ width: '1rem', height: '1rem', color: 'var(--accent-primary)' }}></i>
                <span>Logistics &amp; Transport Mode</span>
              </strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>📍 {distance} km from BKC Depot</span>
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
              <strong>100% Refundable Security Deposit (₹{escrowDeposit.toLocaleString('en-IN')}):</strong>
              <div style={{ marginTop: '2px' }}>Held securely in platform escrow. Automatically refunded upon 2-step digital condition audit sign-off post-return.</div>
            </div>
          </div>

          {/* Cost Summary Breakdown */}
          <div className="calc-summary-card">
            <div className="calc-row">
              <span>Rental Duration &amp; Units:</span>
              <strong>{days} Day{days > 1 ? 's' : ''} × {quantity} Unit{quantity > 1 ? 's' : ''}</strong>
            </div>
            <div className="calc-row">
              <span>Agreed Rental Subtotal:</span>
              <strong>₹{subtotal.toLocaleString('en-IN')}</strong>
            </div>
            <div className="calc-row">
              <span>Logistics / Delivery Fee:</span>
              <span>{isDelivery ? `₹${logisticsFee.toLocaleString('en-IN')} (${isRoundTrip ? 'Round-Trip -20%' : 'One-Way'})` : '₹0 (In-Store Pickup)'}</span>
            </div>
            <div className="calc-row">
              <span>Refundable Security Deposit:</span>
              <span className="security-deposit-badge">₹{escrowDeposit.toLocaleString('en-IN')}</span>
            </div>
            <div className="calc-row" style={{ color: 'var(--accent-primary)', fontWeight: '700' }}>
              <span>20% Token Amount to Lock Date:</span>
              <strong>₹{tokenAmount.toLocaleString('en-IN')}</strong>
            </div>
            <div className="calc-row grand-total">
              <span>Total Contract Value:</span>
              <span style={{ color: 'var(--accent-primary)' }}>₹{grandTotal.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div className="modal-footer" style={{ padding: 0, background: 'transparent', border: 'none', marginTop: '0.5rem' }}>
            <button type="button" className="reset-filters-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary-action">
              <i data-lucide="credit-card" style={{ width: '1rem', height: '1rem' }}></i>
              <span>Proceed to Payment &amp; Checkout (₹{tokenAmount.toLocaleString('en-IN')})</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- 4. DEDICATED SEEKER NEGOTIATION MODAL ---
function SeekerNegotiateModal({ asset, currentUser, onClose, onSubmit }) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  const after3Days = new Date();
  after3Days.setDate(after3Days.getDate() + 3);
  const after3DaysStr = after3Days.toISOString().split('T')[0];

  const [proposedRate, setProposedRate] = useState(Math.round((asset.pricePerDay || 15000) * 0.85));
  const [startDate, setStartDate] = useState(tomorrowStr);
  const [endDate, setEndDate] = useState(after3DaysStr);
  const [timeSlot, setTimeSlot] = useState(asset.timeSlots?.[0] || "Full Day (24 Hrs)");
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("We need this resource for a high-profile corporate gala and are proposing this bulk package rate.");
  const [isDelivery, setIsDelivery] = useState(asset.fulfillmentType === 'Site Delivery');

  const days = useMemo(() => {
    const s = new Date(startDate);
    const e = new Date(endDate);
    const diff = Math.round((e - s) / (1000 * 60 * 60 * 24));
    return Math.max(1, diff || 1);
  }, [startDate, endDate]);

  const proposedTotal = days * proposedRate * quantity;
  const listedTotal = days * (asset.pricePerDay || 15000) * quantity;
  const savings = listedTotal - proposedTotal;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      assetId: asset.id,
      proposedDailyRate: proposedRate,
      startDate,
      endDate,
      days,
      timeSlot,
      quantity,
      proposedTotal,
      message,
      isDelivery,
      deliveryFee: isDelivery ? 650 : 0
    });
  };

  return (
    <div className="modal-backdrop active" style={{ display: 'flex' }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-dialog">
        <div className="modal-header">
          <div>
            <div className="modal-title">💬 Negotiate Rental Rate &amp; Terms</div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Propose a custom offer directly to {asset.shopName}</span>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <i data-lucide="x"></i>
          </button>
        </div>

        <form className="modal-body" onSubmit={handleSubmit}>
          {/* Asset Summary */}
          <div className="rental-asset-summary-box">
            <img src={getSafeImageUrl(asset.photos?.[0] || asset.image, asset.category)} alt={asset.title} style={{ width: '72px', height: '54px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-primary)' }}>{asset.title}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Listed by <strong>{asset.shopName}</strong> (★ {asset.rating || 4.8})
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: '600' }}>
                Standard Listed Rate: ₹{(asset.pricePerDay || 15000).toLocaleString('en-IN')} / day
              </div>
            </div>
          </div>

          {/* Price Comparison Block */}
          <div className="negotiation-comparison-grid">
            <div className="neg-rate-box">
              <div className="neg-rate-label">Listed Standard Rate</div>
              <div className="neg-rate-val">₹{(asset.pricePerDay || 15000).toLocaleString('en-IN')}<span style={{ fontSize: '0.75rem', fontWeight: '400' }}>/day</span></div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>₹{listedTotal.toLocaleString('en-IN')} total for {days}d</div>
            </div>

            <div className="neg-rate-box highlight">
              <div className="neg-rate-label" style={{ color: 'var(--accent-purple)' }}>Your Proposed Rate</div>
              <div className="neg-rate-val" style={{ color: 'var(--accent-purple)' }}>₹{proposedRate.toLocaleString('en-IN')}<span style={{ fontSize: '0.75rem', fontWeight: '400' }}>/day</span></div>
              <div style={{ fontSize: '0.72rem', color: 'var(--accent-emerald)', fontWeight: '600' }}>
                ₹{proposedTotal.toLocaleString('en-IN')} ({savings >= 0 ? `Save ₹${savings.toLocaleString('en-IN')}` : `+₹${Math.abs(savings).toLocaleString('en-IN')}`})
              </div>
            </div>
          </div>

          {/* Form Controls */}
          <div className="form-group">
            <label className="form-label">Your Proposed Daily Rate (₹ / day)</label>
            <input
              type="number"
              className="form-input"
              min="500"
              max={(asset.pricePerDay || 15000) * 2}
              value={proposedRate}
              onChange={(e) => setProposedRate(parseInt(e.target.value, 10) || 500)}
              required
            />
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Rental Start Date</label>
              <input type="date" className="form-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Rental End Date</label>
              <input type="date" className="form-input" min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Required Time Slot</label>
              <select className="form-select" value={timeSlot} onChange={(e) => setTimeSlot(e.target.value)}>
                {(asset.timeSlots || ["Full Day (24 Hrs)", "Morning (8 AM – 2 PM)", "Evening (5 PM – 12 AM)"]).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Quantity</label>
              <input type="number" className="form-input" min="1" value={quantity} onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Message / Requirement Notes for Provider</label>
            <textarea
              className="form-textarea"
              rows="3"
              placeholder="Explain your event requirement, timing, setup needs..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
            ></textarea>
          </div>

          <div className="modal-footer" style={{ padding: 0, background: 'transparent', border: 'none' }}>
            <button type="button" className="reset-filters-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary-action" style={{ backgroundColor: 'var(--accent-purple)' }}>
              <i data-lucide="send" style={{ width: '1rem', height: '1rem' }}></i>
              <span>Send Offer to Provider (₹{proposedTotal.toLocaleString('en-IN')})</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- 5. DEDICATED PROVIDER COUNTER-OFFER MODAL ---
function ProviderCounterModal({ request, onClose, onSubmit }) {
  const [counterRate, setCounterRate] = useState(
    request.seekerOffer ? Math.round(request.seekerOffer * 1.1) : Math.round((request.dailyRate || 15000) * 0.95)
  );
  const [counterMessage, setCounterMessage] = useState("We can accept this counter rate with early site access included.");

  const days = request.days || 1;
  const quantity = request.quantity || 1;
  const counterTotal = counterRate * days * quantity;

  return (
    <div className="modal-backdrop active" style={{ display: 'flex' }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-dialog">
        <div className="modal-header">
          <div>
            <div className="modal-title">💬 Provider Counter-Offer</div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Propose Counter Terms for Booking {request.id}</span>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <i data-lucide="x"></i>
          </button>
        </div>

        <form className="modal-body" onSubmit={(e) => { e.preventDefault(); onSubmit(request.id, counterRate, counterMessage); }}>
          {/* Seeker Info Card */}
          <div style={{ padding: '0.85rem', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{request.assetTitle}</div>
                <div>Seeker: <strong>{request.seekerBusiness}</strong> (★ {request.seekerRating || 4.8})</div>
                <div>Dates: <strong>{request.startDate} to {request.endDate}</strong> ({days} days)</div>
              </div>
              <span className="badge bg-warning text-dark">{request.status}</span>
            </div>
            {request.notes && (
              <div style={{ marginTop: '0.5rem', padding: '0.4rem 0.6rem', background: 'var(--card-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontStyle: 'italic', fontSize: '0.78rem' }}>
                "{request.notes}"
              </div>
            )}
          </div>

          {/* Comparison Grid */}
          <div className="negotiation-comparison-grid">
            <div className="neg-rate-box seeker">
              <div className="neg-rate-label">Seeker Offer</div>
              <div className="neg-rate-val">₹{(request.seekerOffer || request.dailyRate || 12000).toLocaleString('en-IN')}<span style={{ fontSize: '0.75rem', fontWeight: '400' }}>/d</span></div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>₹{(request.totalAmount || 0).toLocaleString('en-IN')} total</div>
            </div>

            <div className="neg-rate-box highlight">
              <div className="neg-rate-label" style={{ color: 'var(--accent-purple)' }}>Your Counter Rate</div>
              <div className="neg-rate-val" style={{ color: 'var(--accent-purple)' }}>₹{counterRate.toLocaleString('en-IN')}<span style={{ fontSize: '0.75rem', fontWeight: '400' }}>/d</span></div>
              <div style={{ fontSize: '0.72rem', color: 'var(--accent-purple)', fontWeight: '600' }}>₹{counterTotal.toLocaleString('en-IN')} total</div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Counter-Offer Daily Rate (₹ / day)</label>
            <input
              type="number"
              className="form-input"
              min="500"
              value={counterRate}
              onChange={(e) => setCounterRate(parseInt(e.target.value, 10) || 500)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Counter-Offer Note / Terms</label>
            <textarea
              className="form-textarea"
              rows="3"
              value={counterMessage}
              onChange={(e) => setCounterMessage(e.target.value)}
              required
            ></textarea>
          </div>

          <div className="modal-footer" style={{ padding: 0, background: 'transparent', border: 'none' }}>
            <button type="button" className="reset-filters-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary-action" style={{ backgroundColor: 'var(--accent-purple)' }}>
              <i data-lucide="send" style={{ width: '1rem', height: '1rem' }}></i>
              <span>Send Counter-Offer to Seeker</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- 6. CHECKOUT & PAYMENT SIMULATION MODAL (HIGH PRIORITY) ---
function PaymentCheckoutModal({ checkoutData, currentUser, onClose, onSuccess, onNavigateToBookings }) {
  const [paymentMethod, setPaymentMethod] = useState('upi'); // 'upi' | 'card' | 'netbanking'
  const [upiId, setUpiId] = useState('enterprise@oksbi');
  const [cardNumber, setCardNumber] = useState('4532 •••• •••• 8921');
  const [cardExpiry, setCardExpiry] = useState('11/28');
  const [cardCvv, setCardCvv] = useState('842');
  const [cardName, setCardName] = useState(currentUser?.businessName || 'Imperial Banquets Ltd');
  const [selectedBank, setSelectedBank] = useState('HDFC Bank');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [completedReqId, setCompletedReqId] = useState(checkoutData.requestId || `REQ-${Math.floor(1000 + Math.random() * 9000)}`);

  const asset = checkoutData.asset;
  const tokenAmount = checkoutData.tokenAmount || Math.round((checkoutData.grandTotal || 20000) * 0.20);
  const grandTotal = checkoutData.grandTotal || 20000;
  const escrowDeposit = checkoutData.escrowDeposit || 5000;

  const handlePayNow = (e) => {
    e.preventDefault();
    setIsProcessing(true);

    setTimeout(() => {
      setIsProcessing(false);
      setIsCompleted(true);
      onSuccess({
        checkoutData: { ...checkoutData, requestId: completedReqId },
        paymentMethod: paymentMethod === 'upi' ? `UPI (${upiId})` : (paymentMethod === 'card' ? `Card (ending ${cardNumber.slice(-4)})` : `Net Banking (${selectedBank})`),
        paymentDetails: { tokenAmount, grandTotal, escrowDeposit }
      });
    }, 1400);
  };

  return (
    <div className="modal-backdrop active" style={{ display: 'flex' }} onClick={(e) => { if (e.target === e.currentTarget && !isProcessing) onClose(); }}>
      <div className="modal-dialog payment-modal-dialog">
        <div className="modal-header">
          <div>
            <div className="modal-title">B2B Checkout &amp; Calendar Lock</div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Instant Token Authorization with Escrow Protection</span>
          </div>
          {!isProcessing && (
            <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
              <i data-lucide="x"></i>
            </button>
          )}
        </div>

        {isCompleted ? (
          /* SUCCESS SCREEN */
          <div className="modal-body payment-receipt-success">
            <div className="payment-success-icon-wrap">
              <i data-lucide="check" style={{ width: '2rem', height: '2rem' }}></i>
            </div>
            <h3 className="payment-success-title">✓ Payment Successful</h3>
            <p className="payment-success-sub">
              Booking Contract <strong>{completedReqId}</strong> Confirmed &amp; Token Verified.
            </p>

            <div className="payment-lock-badge">
              <i data-lucide="lock" style={{ width: '0.9rem', height: '0.9rem' }}></i>
              <span>🔒 CALENDAR LOCKED FOR {checkoutData.startDate} → {checkoutData.endDate}</span>
            </div>

            <div className="calc-summary-card mb-3 text-start">
              <div className="calc-row">
                <span>Resource:</span>
                <strong>{asset.title}</strong>
              </div>
              <div className="calc-row">
                <span>Host Enterprise:</span>
                <strong>{asset.shopName}</strong>
              </div>
              <div className="calc-row">
                <span>Dates &amp; Time Slot:</span>
                <strong>{checkoutData.startDate} to {checkoutData.endDate} ({checkoutData.timeSlot})</strong>
              </div>
              <div className="calc-row">
                <span>Token Paid Today:</span>
                <span style={{ color: 'var(--accent-emerald)', fontWeight: '700' }}>₹{tokenAmount.toLocaleString('en-IN')}</span>
              </div>
              <div className="calc-row">
                <span>Refundable Escrow:</span>
                <span className="security-deposit-badge">₹{escrowDeposit.toLocaleString('en-IN')} (Safe Hold)</span>
              </div>
              <div className="calc-row grand-total">
                <span>Total Contract Value:</span>
                <span style={{ color: 'var(--accent-primary)' }}>₹{grandTotal.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="d-flex gap-2 justify-content-center">
              <button className="btn btn-outline-secondary" onClick={onClose}>
                Back to Marketplace
              </button>
              <button className="btn-primary-action" onClick={onNavigateToBookings}>
                <i data-lucide="send" style={{ width: '0.9rem', height: '0.9rem' }}></i>
                <span>View in My Bookings</span>
              </button>
            </div>
          </div>
        ) : (
          /* PAYMENT FORM */
          <form className="modal-body" onSubmit={handlePayNow}>
            {/* Progress Bar */}
            <div className="payment-progress-bar">
              <div className="payment-progress-step completed">
                <i data-lucide="check-circle" style={{ width: '0.9rem', height: '0.9rem' }}></i>
                <span>1. Resource Details</span>
              </div>
              <div className="payment-progress-step active">
                <i data-lucide="credit-card" style={{ width: '0.9rem', height: '0.9rem' }}></i>
                <span>2. Token Payment</span>
              </div>
              <div className="payment-progress-step">
                <i data-lucide="lock" style={{ width: '0.9rem', height: '0.9rem' }}></i>
                <span>3. Calendar Lock</span>
              </div>
            </div>

            {/* Contract Summary Box */}
            <div className="rental-asset-summary-box mb-3">
              <img src={getSafeImageUrl(asset.photos?.[0] || asset.image, asset.category)} alt={asset.title} style={{ width: '80px', height: '60px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: '700', fontSize: '0.92rem', color: 'var(--text-primary)' }}>{asset.title}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Provider: <strong>{asset.shopName}</strong> • {asset.location}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: '600' }}>
                  📅 {checkoutData.startDate} → {checkoutData.endDate} ({checkoutData.days} Days) • {checkoutData.timeSlot}
                </div>
              </div>
            </div>

            {/* Payment Method Selector */}
            <label className="form-label" style={{ fontWeight: '700', marginBottom: '0.4rem' }}>Select Payment Method:</label>
            <div className="payment-method-nav">
              <div
                className={`payment-method-card ${paymentMethod === 'upi' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('upi')}
              >
                <i data-lucide="smartphone"></i>
                <span>UPI / QR</span>
              </div>
              <div
                className={`payment-method-card ${paymentMethod === 'card' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('card')}
              >
                <i data-lucide="credit-card"></i>
                <span>Credit / Debit Card</span>
              </div>
              <div
                className={`payment-method-card ${paymentMethod === 'netbanking' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('netbanking')}
              >
                <i data-lucide="building"></i>
                <span>Net Banking</span>
              </div>
            </div>

            {/* Dynamic Method Panel */}
            {paymentMethod === 'upi' && (
              <div className="payment-panel">
                <div className="form-group mb-2">
                  <label className="form-label">Virtual Payment Address (UPI ID)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. yourname@oksbi"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    required
                  />
                </div>
                <div className="payment-qr-wrap">
                  <div className="payment-qr-box">
                    <i data-lucide="qr-code" style={{ width: '4rem', height: '4rem', color: '#1e293b' }}></i>
                  </div>
                  <div style={{ fontSize: '0.78rem' }}>
                    <strong>Instant UPI QR Verification</strong>
                    <div style={{ color: 'var(--text-muted)', marginTop: '2px' }}>
                      Scan via GPay, PhonePe, Paytm, or BHIM to authorize the 20% token deposit.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {paymentMethod === 'card' && (
              <div className="payment-panel">
                <div className="form-group">
                  <label className="form-label">Cardholder Name</label>
                  <input type="text" className="form-input" value={cardName} onChange={(e) => setCardName(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">16-Digit Card Number</label>
                  <input type="text" className="form-input" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} required />
                </div>
                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Expiry Date</label>
                    <input type="text" className="form-input" value={cardExpiry} onChange={(e) => setCardExpiry(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">CVV / CVC</label>
                    <input type="password" maxLength="4" className="form-input" value={cardCvv} onChange={(e) => setCardCvv(e.target.value)} required />
                  </div>
                </div>
              </div>
            )}

            {paymentMethod === 'netbanking' && (
              <div className="payment-panel">
                <div className="form-group">
                  <label className="form-label">Select Corporate Banking Partner</label>
                  <select className="form-select" value={selectedBank} onChange={(e) => setSelectedBank(e.target.value)}>
                    <option value="HDFC Bank">HDFC Bank Corporate</option>
                    <option value="ICICI Bank">ICICI Bank Corporate Portal</option>
                    <option value="State Bank of India">State Bank of India (SBI)</option>
                    <option value="Axis Bank">Axis Bank Commercial</option>
                    <option value="Kotak Mahindra Bank">Kotak Mahindra Bank</option>
                    <option value="Bank of Baroda">Bank of Baroda</option>
                  </select>
                </div>
              </div>
            )}

            {/* Price Itemized Breakdown Table */}
            <div className="calc-summary-card mb-3">
              <div className="calc-row">
                <span>Agreed Daily Rental Rate:</span>
                <strong>₹{(checkoutData.dailyRate || 15000).toLocaleString('en-IN')} / day</strong>
              </div>
              <div className="calc-row">
                <span>Rental Subtotal ({checkoutData.days} Days × {checkoutData.quantity || 1} Unit):</span>
                <strong>₹{(checkoutData.rentalSubtotal || 15000).toLocaleString('en-IN')}</strong>
              </div>
              <div className="calc-row">
                <span>3PL Logistics / Delivery Mode:</span>
                <span>{checkoutData.deliveryMode || 'In-Store Pickup'} (₹{(checkoutData.logisticsFee || 0).toLocaleString('en-IN')})</span>
              </div>
              <div className="calc-row">
                <span>Refundable Escrow Deposit:</span>
                <span className="security-deposit-badge">₹{escrowDeposit.toLocaleString('en-IN')} (Safe Hold)</span>
              </div>
              <div className="calc-row" style={{ color: 'var(--accent-primary)', fontWeight: '700', fontSize: '0.95rem' }}>
                <span>20% Immediate Token to Pay:</span>
                <strong>₹{tokenAmount.toLocaleString('en-IN')}</strong>
              </div>
              <div className="calc-row grand-total">
                <span>Total Contract Value:</span>
                <span style={{ color: 'var(--accent-primary)' }}>₹{grandTotal.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="modal-footer" style={{ padding: 0, background: 'transparent', border: 'none' }}>
              <button type="button" className="reset-filters-btn" onClick={onClose} disabled={isProcessing}>Cancel</button>
              <button type="submit" className="btn-primary-action" disabled={isProcessing} style={{ minWidth: '220px', justifyContent: 'center' }}>
                {isProcessing ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                    <span>Authorizing Escrow...</span>
                  </>
                ) : (
                  <>
                    <i data-lucide="lock" style={{ width: '1rem', height: '1rem' }}></i>
                    <span>Pay ₹{tokenAmount.toLocaleString('en-IN')} &amp; Lock Date</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// --- 7. LIST / EDIT ASSET MODAL ---
function ListAssetModal({ asset, currentUser, onClose, onSave }) {
  const isEdit = asset && asset.id;
  const [title, setTitle] = useState(asset?.title || '');
  const [category, setCategory] = useState(asset?.category || 'Venue');
  const [fulfillment, setFulfillment] = useState(asset?.fulfillmentType || 'In-Store Pickup');
  const [shopName, setShopName] = useState(asset?.shopName || (currentUser?.businessName || 'Hospitality Fleet Depot'));
  const [vendorType, setVendorType] = useState(asset?.vendorType || 'Commercial Partner');
  const [location, setLocation] = useState(asset?.location || 'Lower Parel, Mumbai');
  const [rate, setRate] = useState(asset?.pricePerDay || 15000);
  const [deposit, setDeposit] = useState(asset?.securityDeposit || 5000);
  const [status, setStatus] = useState(asset?.availabilityStatus || 'Available');
  const [instantDispatch, setInstantDispatch] = useState(Boolean(asset?.instantDispatchAvailable));
  const [desc, setDesc] = useState(asset?.description || 'Commercial grade equipment inspected and ready for exchange.');
  const [specsInput, setSpecsInput] = useState((asset?.specifications || ["Heavy Duty", "AC / Climate Control", "Sanitized"]).join(', '));
  const [photos, setPhotos] = useState(asset?.photos || [asset?.image || 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1200&q=80']);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setPhotos(prev => [event.target.result, ...prev]);
    };
    reader.readAsDataURL(file);
  };

  const handleAddPreset = (url) => {
    setPhotos(prev => [...prev, url]);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const specsArray = specsInput.split(',').map(s => s.trim()).filter(Boolean);
    onSave({
      title,
      category,
      fulfillmentType: fulfillment,
      shopName,
      vendorType,
      location,
      pricePerDay: parseInt(rate, 10),
      securityDeposit: parseInt(deposit, 10),
      availabilityStatus: status,
      instantDispatchAvailable: instantDispatch,
      description: desc,
      specifications: specsArray,
      photos: photos,
      image: photos[0] || getSafeImageUrl('', category)
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
            <input type="text" id="asset-name" className="form-input" placeholder="e.g. 7-Seater Luxury Van / 500-Seater Banquet" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label" htmlFor="asset-cat">Category</label>
              <select id="asset-cat" className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="Venue">Venue (Venues &amp; Banquets)</option>
                <option value="Kitchen">Commercial Kitchen</option>
                <option value="Vehicle">Logistics &amp; Vehicles (7-Seater / Reefer)</option>
                <option value="Equipment">Event Equipment &amp; Sound</option>
                <option value="Furniture">Hospitality Furniture</option>
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
              <label className="form-label">Facility / Shop Name</label>
              <input type="text" className="form-input" value={shopName} onChange={(e) => setShopName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">MMR Location</label>
              <select className="form-select" value={location} onChange={(e) => setLocation(e.target.value)}>
                {Object.keys(MMR_COORDS_MAP).map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Daily Rental Rate (₹)</label>
              <input type="number" className="form-input" min="500" value={rate} onChange={(e) => setRate(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Refundable Security Deposit (₹)</label>
              <input type="number" className="form-input" min="500" value={deposit} onChange={(e) => setDeposit(e.target.value)} required />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Specifications (Comma-separated)</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. 7 Seats, AC, Commercial Permit, Chauffeur Included"
              value={specsInput}
              onChange={(e) => setSpecsInput(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description &amp; Condition</label>
            <textarea className="form-textarea" rows="2" value={desc} onChange={(e) => setDesc(e.target.value)}></textarea>
          </div>

          {/* Multi-Photo Upload & Preset Gallery */}
          <div className="form-group">
            <label className="form-label">Multiple Resource Photos ({photos.length} attached)</label>
            <input type="file" className="form-control form-control-sm mb-2" accept="image/*" onChange={handleFileUpload} />

            <div className="d-flex gap-1 flex-wrap mb-2">
              <button type="button" className="btn btn-xs btn-outline-secondary" onClick={() => handleAddPreset('https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1200&q=80')}>
                + 🚐 Executive MPV
              </button>
              <button type="button" className="btn btn-xs btn-outline-secondary" onClick={() => handleAddPreset('https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1200&q=80')}>
                + 🏰 Banquet Hall
              </button>
              <button type="button" className="btn btn-xs btn-outline-secondary" onClick={() => handleAddPreset('https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=1200&q=80')}>
                + 🍳 Commercial Kitchen
              </button>
              <button type="button" className="btn btn-xs btn-outline-secondary" onClick={() => handleAddPreset('https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80')}>
                + 🔊 Sound Rig
              </button>
            </div>

            <div className="d-flex gap-2 flex-wrap">
              {photos.map((p, idx) => (
                <div key={idx} style={{ position: 'relative', width: '64px', height: '48px', borderRadius: '4px', overflow: 'hidden' }}>
                  <img src={p} alt="thumb" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  {photos.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setPhotos(photos.filter((_, i) => i !== idx))}
                      style={{ position: 'absolute', top: 0, right: 0, background: 'rgba(239, 68, 68, 0.8)', color: '#fff', border: 'none', fontSize: '10px', padding: '0 3px', cursor: 'pointer' }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
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

// --- 8. 2-STEP CONDITION AUDIT MODAL ---
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
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>After return inspection</div>
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
                  <span>Physical exterior sanitized and free of structural damage</span>
                </label>
                <label className="audit-check-item">
                  <input type="checkbox" defaultChecked />
                  <span>Operational testing completed &amp; factory power cables attached</span>
                </label>
                <label className="audit-check-item">
                  <input type="checkbox" defaultChecked />
                  <span>FSSAI sanitation seal &amp; transport latch verified</span>
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
                  <span>Authorize 100% Escrow Deposit release back to Seeker</span>
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
                    <strong>Escrow Deposit Release: ₹{(request.escrowDeposit || 5000).toLocaleString('en-IN')}</strong>
                    <div style={{ fontSize: '0.75rem' }}>Upon provider sign-off, the refundable deposit is credited back immediately.</div>
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
            <span>{step === 1 ? 'Sign Off Pre-Dispatch' : `Release Escrow Deposit (₹${(request.escrowDeposit || 5000).toLocaleString('en-IN')})`}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// --- 9. ENRICHED QUICK VIEW & RESOURCE DETAILS MODAL ---
function QuickViewModal({ asset, onClose, onRequest, onNegotiate }) {
  const isAvail = asset.availabilityStatus === 'Available';
  const photos = asset.photos && asset.photos.length > 0 ? asset.photos : [getSafeImageUrl(asset.image, asset.category)];

  return (
    <div className="modal-backdrop active" style={{ display: 'flex' }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-dialog" style={{ maxWidth: '680px' }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{asset.title}</div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Verified Asset Profile • ID: {asset.id.toUpperCase()}</span>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <i data-lucide="x"></i>
          </button>
        </div>

        <div className="modal-body">
          {/* Interactive Multi-Photo Gallery */}
          <PhotoGallery photos={photos} title={asset.title} />

          {/* Pricing & Badges Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <div className="d-flex align-items-center gap-2 mb-1">
                <span className="category-badge-chip">{asset.category}</span>
                <span className="smart-match-pill">🎯 {asset._matchScore || 94}% Match</span>
                <span className={`status-badge ${isAvail ? 'approved' : 'pending'}`}>
                  {isAvail ? '🟢 AVAILABLE' : '🔒 BOOKED'}
                </span>
              </div>
              <div className="trust-badge-row">
                <span className="trust-rating-chip">★ {asset.rating || 4.8} ({asset.reviewsCount || 24} Reviews)</span>
                <span className="trust-verified-chip">✓ Verified Business</span>
                <span className="proximity-tag">📍 {asset._distanceKm || 6.5} km from BKC</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                ₹{(asset.pricePerDay || 0).toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>per calendar day</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--accent-emerald)', fontWeight: '600' }}>
                Dep: ₹{(asset.securityDeposit || 5000).toLocaleString('en-IN')} (Refundable)
              </div>
            </div>
          </div>

          {/* Description */}
          <div style={{ marginBottom: '1rem' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.35rem', color: 'var(--text-primary)' }}>Overview &amp; Condition</h4>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              {asset.description || "Commercial grade hospitality resource inspected and tested for B2B cross-utilization across Mumbai and Thane metropolitan hubs."}
            </p>
          </div>

          {/* Full Specifications */}
          <div style={{ marginBottom: '1rem' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.35rem', color: 'var(--text-primary)' }}>Technical Specifications &amp; Features</h4>
            <div className="spec-tags-grid">
              {(asset.specifications || ["High Capacity", "Commercial Grade", "FSSAI Safety Checked"]).map((spec, i) => (
                <span key={i} className="spec-tag" style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}>
                  ✓ {spec}
                </span>
              ))}
            </div>
          </div>

          {/* Provider Trust Card */}
          <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', border: '1px solid var(--border-subtle)' }}>
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', fontWeight: '700' }}>
                  MMR Host Partner
                </span>
                <div style={{ fontSize: '0.92rem', fontWeight: '700', color: 'var(--text-primary)' }}>{asset.shopName}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {asset.location} • {asset.vendorType}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className="badge bg-success">✓ 100% On-Time Dispatch</span>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {asset.completedRentals || 35} Completed Rentals
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer d-flex justify-content-between">
          <button type="button" className="reset-filters-btn" onClick={onClose}>Close</button>
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-outline-secondary" onClick={onNegotiate}>
              <i data-lucide="message-square" style={{ width: '0.9rem', height: '0.9rem' }}></i>
              <span>Negotiate Price</span>
            </button>
            <button type="button" className="btn-primary-action" onClick={onRequest} disabled={!isAvail}>
              <i data-lucide={isAvail ? "calendar" : "lock"} style={{ width: '0.9rem', height: '0.9rem' }}></i>
              <span>{isAvail ? "Request Rental" : "Currently Booked"}</span>
            </button>
          </div>
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
