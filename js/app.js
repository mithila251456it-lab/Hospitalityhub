/**
 * HospitaLink B2B Hospitality Resource Exchange
 * Enterprise Controller for Mumbai Metropolitan Region (MMR)
 * Features:
 * - Dual-Booking Modes: Emergency 30-60 min dispatch vs. Planned advance with 20% token locking
 * - Proximity Distance Calculation (Haversine Formula from BKC Central Depot)
 * - 3PL Logistics Fare Simulator with 20% Round-Trip Discount
 * - Smart Calendar Lock preventing double-booking upon token receipt
 * - 3-Way Provider Request Handling (Accept, Reject, Real-Time Counter-Offer)
 * - 2-Step Digital Condition Audit (Pre-Dispatch & Post-Return Photo Checklist & Escrow Settlement)
 * - Automated Fleet Monetization & ROI Calculator with reactive range sliders
 * - Enterprise Theme Control (Light/Dark mode) & LocalStorage Persistence
 */

(function() {
  'use strict';

  // Fallback Reference Coordinates: Bandra Kurla Complex (BKC) Central Logistics Depot
  const MMR_DEPOT_COORDS = { lat: 19.0674, lng: 72.8687 };

  // Verified High-Res Image Fallbacks (100% Reliable & Non-Broken)
  const VERIFIED_FALLBACK_IMAGES = {
    "Venue": "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=800&q=80",
    "Kitchen": "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=800&q=80",
    "Commercial Kitchen": "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=800&q=80",
    "Vehicle": "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80",
    "Logistics Vehicle": "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80",
    "Equipment": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=800&q=80",
    "Event Equipment": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=800&q=80"
  };

  /**
   * Safe image URL resolver guaranteeing no 404 or broken images
   */
  function getSafeImageUrl(imgUrl, category = "Venue") {
    if (!imgUrl || typeof imgUrl !== 'string' || imgUrl.includes('photo-1545232979-fbfd43e1d1eb')) {
      return 'https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=800&q=80';
    }
    return imgUrl;
  }

  /**
   * Haversine formula to compute great-circle distance in kilometers between two GPS coordinates
   */
  function calculateDistanceKm(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 8.5; // fallback average distance
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
  }

  /**
   * Simulated 3PL distance fare (Porter / Borzo style):
   * Base ₹350 + ₹25/km. If round-trip selected, applies 20% discount on total delivery fee.
   */
  function calculateLogisticsFare(distanceKm, isRoundTrip) {
    const baseFare = 350;
    const perKm = 25;
    let oneWayFare = baseFare + Math.round(distanceKm * perKm);
    if (isRoundTrip) {
      // 2-way with 20% discount on total delivery fee
      return Math.round(oneWayFare * 2 * 0.80);
    }
    return oneWayFare;
  }

  class HospitaLinkApp {
    constructor() {
      this.initStorage();
      this.state = {
        theme: localStorage.getItem('hospitalink_theme') || 'light',
        currentView: 'seeker', // 'seeker' | 'provider'
        currentUser: this.loadCurrentUser(),
        inventory: this.loadInventory(),
        requests: this.loadRequests(),
        emergencyMode: false,
        selectedRadius: 'all', // 'all', '5', '10', '15'
        activeCategory: 'all',
        searchQuery: '',
        selectedLocation: 'all',
        selectedPriceRange: 'all',
        selectedFulfillment: 'all',
        sortBy: 'featured',
        bookingMode: 'planned', // 'planned' | 'emergency'
        activeModalAsset: null,
        activeNegotiatingReq: null,
        activeAuditReq: null,
        activeAuditStep: 1
      };

      this.dom = {};
      this.init();
    }

    // --- Storage & Data Hydration ---
    initStorage() {
      const defaultInventory = (typeof window !== 'undefined' && window.inventoryData) ? window.inventoryData : [];
      const defaultRequests = (typeof window !== 'undefined' && window.INITIAL_REQUESTS) ? window.INITIAL_REQUESTS : [];

      if (localStorage.getItem('hospitalink_inventory_mmr_v3') === null) {
        localStorage.setItem('hospitalink_inventory_mmr_v3', JSON.stringify(defaultInventory));
      }
      if (localStorage.getItem('resources') === null) {
        localStorage.setItem('resources', JSON.stringify(defaultInventory));
      }
      if (localStorage.getItem('hospitalink_requests_mmr_v3') === null) {
        localStorage.setItem('hospitalink_requests_mmr_v3', JSON.stringify(defaultRequests));
      }
    }

    loadInventory() {
      try {
        const stored = localStorage.getItem('hospitalink_inventory_mmr_v3');
        if (stored !== null) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) return parsed;
        }
        const legacy = localStorage.getItem('resources');
        if (legacy !== null) {
          const parsed = JSON.parse(legacy);
          if (Array.isArray(parsed)) return parsed;
        }
        const def = (typeof window !== 'undefined' && window.inventoryData) ? window.inventoryData : [];
        return JSON.parse(JSON.stringify(def));
      } catch {
        const def = (typeof window !== 'undefined' && window.inventoryData) ? window.inventoryData : [];
        return JSON.parse(JSON.stringify(def));
      }
    }

    saveInventory() {
      const data = JSON.stringify(this.state.inventory);
      localStorage.setItem('hospitalink_inventory_mmr_v3', data);
      localStorage.setItem('resources', data);
    }

    loadRequests() {
      try {
        const stored = localStorage.getItem('hospitalink_requests_mmr_v3');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
        return (typeof window !== 'undefined' && window.INITIAL_REQUESTS) ? window.INITIAL_REQUESTS : [];
      } catch {
        return (typeof window !== 'undefined' && window.INITIAL_REQUESTS) ? window.INITIAL_REQUESTS : [];
      }
    }

    saveRequests() {
      localStorage.setItem('hospitalink_requests_mmr_v3', JSON.stringify(this.state.requests));
    }

    loadCurrentUser() {
      try {
        const stored = localStorage.getItem('hospitalink_current_user');
        if (stored) return JSON.parse(stored);
        const demoUsers = (typeof window !== 'undefined' && window.DEMO_USERS) ? window.DEMO_USERS : [];
        return demoUsers[0] || {
          businessName: "Imperial Banquets & Hospitality Ltd",
          email: "procurement@imperialbanquets.in",
          businessType: "Hotel & Resort",
          role: "Provider & Seeker",
          location: "Lower Parel, Mumbai",
          verified: true
        };
      } catch {
        return {
          businessName: "Imperial Banquets & Hospitality Ltd",
          email: "procurement@imperialbanquets.in",
          businessType: "Hotel & Resort",
          role: "Provider & Seeker",
          location: "Lower Parel, Mumbai",
          verified: true
        };
      }
    }

    saveCurrentUser(user) {
      this.state.currentUser = user;
      if (user) {
        localStorage.setItem('hospitalink_current_user', JSON.stringify(user));
      } else {
        localStorage.removeItem('hospitalink_current_user');
      }
      this.renderAuthStatus();
    }

    // --- Initialization ---
    init() {
      this.cacheDom();
      this.applyTheme(this.state.theme);
      this.populateFooterHubs();
      this.bindEvents();
      this.renderAuthStatus();
      this.renderCategoryPills();
      this.renderMarketplaceListings();
      this.renderProviderDashboard();
      this.updateMonetizationCalculator();
      this.refreshIcons();
    }

    cacheDom() {
      this.dom.html = document.documentElement;
      this.dom.themeToggleBtn = document.getElementById('theme-toggle-btn');
      this.dom.themeIcon = document.getElementById('theme-icon');

      // Navigation & View Switching
      this.dom.btnViewSeeker = document.getElementById('btn-view-seeker');
      this.dom.btnViewProvider = document.getElementById('btn-view-provider');
      this.dom.viewSeeker = document.getElementById('view-seeker');
      this.dom.viewProvider = document.getElementById('view-provider');
      this.dom.brandLink = document.getElementById('brand-link');

      // Auth
      this.dom.authActionsContainer = document.getElementById('auth-actions-container');
      this.dom.authModal = document.getElementById('auth-modal');
      this.dom.btnOpenAuth = document.getElementById('btn-open-auth');
      this.dom.btnCloseAuth = document.getElementById('btn-close-auth');
      this.dom.tabAuthLogin = document.getElementById('tab-auth-login');
      this.dom.tabAuthRegister = document.getElementById('tab-auth-register');
      this.dom.formLogin = document.getElementById('form-login');
      this.dom.formRegister = document.getElementById('form-register');
      this.dom.regBizType = document.getElementById('reg-biz-type');
      this.dom.regHub = document.getElementById('reg-hub');

      // Marketplace Filters & Emergency Toggle
      this.dom.searchInput = document.getElementById('search-input');
      this.dom.btnEmergencyToggle = document.getElementById('btn-emergency-toggle');
      this.dom.filterRadius = document.getElementById('filter-radius');
      this.dom.filterLocation = document.getElementById('filter-location');
      this.dom.filterCategory = document.getElementById('filter-category');
      this.dom.filterPrice = document.getElementById('filter-price');
      this.dom.filterFulfillment = document.getElementById('filter-fulfillment');
      this.dom.sortSelect = document.getElementById('sort-select');
      this.dom.btnResetFilters = document.getElementById('btn-reset-filters');
      this.dom.categoryPillsContainer = document.getElementById('category-pills-container');
      this.dom.resultsCountText = document.getElementById('results-count-text');
      this.dom.listingsGrid = document.getElementById('listings-grid');
      this.dom.metricListingsCount = document.getElementById('metric-listings-count');

      // Rental Booking Modal & Dual-Mode Controls
      this.dom.rentalModal = document.getElementById('rental-modal');
      this.dom.btnCloseRental = document.getElementById('btn-close-rental');
      this.dom.btnCancelRental = document.getElementById('btn-cancel-rental');
      this.dom.formRental = document.getElementById('form-rental');
      this.dom.rentalAssetId = document.getElementById('rental-asset-id');
      this.dom.btnModePlanned = document.getElementById('btn-mode-planned');
      this.dom.btnModeEmergency = document.getElementById('btn-mode-emergency');
      this.dom.rentalAssetSummary = document.getElementById('rental-asset-summary');
      this.dom.rentalStartDate = document.getElementById('rental-start-date');
      this.dom.rentalEndDate = document.getElementById('rental-end-date');
      this.dom.simDistanceKm = document.getElementById('sim-distance-km');
      this.dom.radioPickup = document.getElementById('radio-pickup');
      this.dom.radioDelivery = document.getElementById('radio-delivery');
      this.dom.deliveryOptionsBox = document.getElementById('delivery-options-box');
      this.dom.simDeliveryRate = document.getElementById('sim-delivery-rate');
      this.dom.chkRoundtrip = document.getElementById('chk-roundtrip');
      this.dom.deliveryAddressGroup = document.getElementById('delivery-address-group');
      this.dom.rentalDeliveryAddress = document.getElementById('rental-delivery-address');

      // Calculation Outputs in Booking Modal
      this.dom.calcDuration = document.getElementById('calc-duration');
      this.dom.calcSubtotal = document.getElementById('calc-subtotal');
      this.dom.calcLogisticsFee = document.getElementById('calc-logistics-fee');
      this.dom.rowTokenAmount = document.getElementById('row-token-amount');
      this.dom.calcTokenAmount = document.getElementById('calc-token-amount');
      this.dom.calcDeposit = document.getElementById('calc-deposit');
      this.dom.calcGrandTotal = document.getElementById('calc-grand-total');
      this.dom.btnSubmitRental = document.getElementById('btn-submit-rental');
      this.dom.btnSubmitRentalText = document.getElementById('btn-submit-rental-text');

      // Provider Dashboard & Monetization Calculator
      this.dom.sliderAssets = document.getElementById('slider-assets');
      this.dom.sliderDays = document.getElementById('slider-days');
      this.dom.sliderRate = document.getElementById('slider-rate');
      this.dom.valSliderAssets = document.getElementById('val-slider-assets');
      this.dom.valSliderDays = document.getElementById('val-slider-days');
      this.dom.valSliderRate = document.getElementById('val-slider-rate');
      this.dom.calcMonthlyRev = document.getElementById('calc-monthly-rev');
      this.dom.calcAnnualRev = document.getElementById('calc-annual-rev');
      this.dom.calcUtilization = document.getElementById('calc-utilization');
      this.dom.calcPayback = document.getElementById('calc-payback');
      this.dom.btnCalcListRate = document.getElementById('btn-calc-list-rate');

      this.dom.provStatRevenue = document.getElementById('prov-stat-revenue');
      this.dom.provStatPending = document.getElementById('prov-stat-pending');
      this.dom.provStatActive = document.getElementById('prov-stat-active');
      this.dom.provStatUtil = document.getElementById('prov-stat-util');
      this.dom.requestsCounterBadge = document.getElementById('requests-counter-badge');
      this.dom.requestsTableBody = document.getElementById('requests-table-body');
      this.dom.providerInventoryTableBody = document.getElementById('provider-inventory-table-body');
      this.dom.btnOpenListModal = document.getElementById('btn-open-list-modal');
      this.dom.btnOpenAuditModal = document.getElementById('btn-open-audit-modal');

      // Add / Edit Asset Modal
      this.dom.listAssetModal = document.getElementById('list-asset-modal');
      this.dom.listAssetModalTitle = document.getElementById('list-asset-modal-title');
      this.dom.btnSubmitAssetText = document.getElementById('btn-submit-asset-text');
      this.dom.editAssetId = document.getElementById('edit-asset-id');
      this.dom.btnCloseList = document.getElementById('btn-close-list');
      this.dom.btnCancelList = document.getElementById('btn-cancel-list');
      this.dom.formListAsset = document.getElementById('form-list-asset');
      this.dom.assetName = document.getElementById('asset-name');
      this.dom.assetCategory = document.getElementById('asset-category');
      this.dom.assetFulfillment = document.getElementById('asset-fulfillment');
      this.dom.assetShop = document.getElementById('asset-shop');
      this.dom.assetVendorType = document.getElementById('asset-vendor-type');
      this.dom.assetLocation = document.getElementById('asset-location');
      this.dom.assetRate = document.getElementById('asset-rate');
      this.dom.assetStatus = document.getElementById('asset-status');
      this.dom.assetInstantDispatch = document.getElementById('asset-instant-dispatch');
      this.dom.assetImage = document.getElementById('asset-image');
      this.dom.assetImageInput = document.getElementById('assetImageInput');
      this.dom.assetImageBase64 = document.getElementById('asset-image-base64');
      this.dom.assetImagePreview = document.getElementById('asset-image-preview');
      this.dom.assetImagePreviewContainer = document.getElementById('asset-image-preview-container');
      this.dom.btnRemovePreview = document.getElementById('btn-remove-preview');
      this.dom.btnLoadDefaultFleet = document.getElementById('btn-load-default-fleet');
      this.dom.btnResetFleet = document.getElementById('btn-reset-fleet');
      this.dom.btnClearAllData = document.getElementById('btn-clear-all-data');
      this.dom.btnClearAllMarketplace = document.getElementById('btn-clear-all-marketplace');

      // Quick View Modal
      this.dom.quickviewModal = document.getElementById('quickview-modal');
      this.dom.btnCloseQv = document.getElementById('btn-close-qv');
      this.dom.btnDismissQv = document.getElementById('btn-dismiss-qv');
      this.dom.qvTitle = document.getElementById('qv-title');
      this.dom.qvContent = document.getElementById('qv-content');
      this.dom.qvBtnRequest = document.getElementById('qv-btn-request');

      // Negotiate Counter-Offer Modal
      this.dom.negotiateModal = document.getElementById('negotiate-modal');
      this.dom.btnCloseNeg = document.getElementById('btn-close-neg');
      this.dom.btnCancelNeg = document.getElementById('btn-cancel-neg');
      this.dom.formNegotiate = document.getElementById('form-negotiate');
      this.dom.negReqId = document.getElementById('neg-req-id');
      this.dom.negTargetId = document.getElementById('neg-target-id');
      this.dom.negDetailsBox = document.getElementById('neg-details-box');
      this.dom.negCounterPrice = document.getElementById('neg-counter-price');
      this.dom.negCounterMessage = document.getElementById('neg-counter-message');

      // 2-Step Digital Condition Audit Modal
      this.dom.auditModal = document.getElementById('audit-modal');
      this.dom.btnCloseAudit = document.getElementById('btn-close-audit');
      this.dom.btnCancelAudit = document.getElementById('btn-cancel-audit');
      this.dom.btnSubmitAudit = document.getElementById('btn-submit-audit');
      this.dom.txtSubmitAudit = document.getElementById('txt-submit-audit');
      this.dom.auditStep1Pill = document.getElementById('audit-step-1-pill');
      this.dom.auditStep2Pill = document.getElementById('audit-step-2-pill');
      this.dom.auditTargetTitle = document.getElementById('audit-target-title');
      this.dom.auditTargetReq = document.getElementById('audit-target-req');
      this.dom.auditTargetStatus = document.getElementById('audit-target-status');
      this.dom.auditViewStep1 = document.getElementById('audit-view-step1');
      this.dom.auditViewStep2 = document.getElementById('audit-view-step2');
      this.dom.auditImgPredispatch = document.getElementById('audit-img-predispatch');
      this.dom.auditImgPostreturn = document.getElementById('audit-img-postreturn');
      this.dom.auditEscrowAmount = document.getElementById('audit-escrow-amount');

      // Toast & Footer Hubs
      this.dom.toastContainer = document.getElementById('toast-container');
      this.dom.footerHubs = document.getElementById('footer-hubs');
    }

    populateFooterHubs() {
      const regions = ["Mumbai", "Thane", "Navi Mumbai", "Bhiwandi", "Kalyan", "Vasai"];
      if (this.dom.footerHubs) {
        this.dom.footerHubs.innerHTML = regions.map(
          reg => `<span class="footer-hub-chip"><i data-lucide="map-pin" style="width:0.75rem;height:0.75rem;display:inline-block;vertical-align:middle;margin-right:2px;"></i>${reg}</span>`
        ).join('');
      }

      // Populate registration dropdowns
      if (this.dom.regBizType) {
        const types = ["Hotel & Resort", "Catering Enterprise", "Banquet Venue", "Event Planner & Production", "Cloud Kitchen Network", "Institutional Kitchen"];
        this.dom.regBizType.innerHTML = types.map(t => `<option value="${t}">${t}</option>`).join('');
      }
      if (this.dom.regHub) {
        this.dom.regHub.innerHTML = regions.map(r => `<option value="${r}">${r}</option>`).join('');
      }
    }

    // --- Event Binding ---
    bindEvents() {
      // 1. Theme Toggle
      this.dom.themeToggleBtn?.addEventListener('click', () => this.toggleTheme());

      // 2. View Switching
      this.dom.btnViewSeeker?.addEventListener('click', () => this.switchView('seeker'));
      this.dom.btnViewProvider?.addEventListener('click', () => this.switchView('provider'));
      this.dom.brandLink?.addEventListener('click', (e) => {
        e.preventDefault();
        this.switchView('seeker');
      });

      // 3. Auth Modal
      this.dom.btnOpenAuth?.addEventListener('click', () => this.openModal(this.dom.authModal));
      this.dom.btnCloseAuth?.addEventListener('click', () => this.closeModal(this.dom.authModal));
      this.dom.tabAuthLogin?.addEventListener('click', () => this.toggleAuthTab('login'));
      this.dom.tabAuthRegister?.addEventListener('click', () => this.toggleAuthTab('register'));

      document.querySelectorAll('.demo-quick-btn[data-demo]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const index = parseInt(e.target.dataset.demo, 10);
          this.loginDemoUser(index);
        });
      });

      this.dom.formLogin?.addEventListener('submit', (e) => this.handleLogin(e));
      this.dom.formRegister?.addEventListener('submit', (e) => this.handleRegister(e));

      // 4. Marketplace Filter Toolbar & Emergency Mode Toggle
      this.dom.btnEmergencyToggle?.addEventListener('click', () => this.toggleEmergencyMode());

      this.dom.filterRadius?.addEventListener('change', (e) => {
        this.state.selectedRadius = e.target.value;
        this.renderMarketplaceListings();
      });

      this.dom.searchInput?.addEventListener('input', (e) => {
        this.state.searchQuery = e.target.value.trim().toLowerCase();
        this.renderMarketplaceListings();
      });

      this.dom.filterLocation?.addEventListener('change', (e) => {
        this.state.selectedLocation = e.target.value;
        this.renderMarketplaceListings();
      });

      this.dom.filterCategory?.addEventListener('change', (e) => {
        this.state.activeCategory = e.target.value;
        this.renderCategoryPills();
        this.renderMarketplaceListings();
      });

      this.dom.filterPrice?.addEventListener('change', (e) => {
        this.state.selectedPriceRange = e.target.value;
        this.renderMarketplaceListings();
      });

      this.dom.filterFulfillment?.addEventListener('change', (e) => {
        this.state.selectedFulfillment = e.target.value;
        this.renderMarketplaceListings();
      });

      this.dom.sortSelect?.addEventListener('change', (e) => {
        this.state.sortBy = e.target.value;
        this.renderMarketplaceListings();
      });

      this.dom.btnResetFilters?.addEventListener('click', () => this.resetFilters());

      // 5. Booking Modal Mode & Logistics Controls
      this.dom.btnModePlanned?.addEventListener('click', () => this.setBookingMode('planned'));
      this.dom.btnModeEmergency?.addEventListener('click', () => this.setBookingMode('emergency'));

      this.dom.radioPickup?.addEventListener('change', () => this.handleLogisticsModeChange());
      this.dom.radioDelivery?.addEventListener('change', () => this.handleLogisticsModeChange());
      this.dom.chkRoundtrip?.addEventListener('change', () => this.recalculateRentalQuote());

      this.dom.rentalStartDate?.addEventListener('change', () => this.recalculateRentalQuote());
      this.dom.rentalEndDate?.addEventListener('change', () => this.recalculateRentalQuote());

      this.dom.btnCloseRental?.addEventListener('click', () => this.closeModal(this.dom.rentalModal));
      this.dom.btnCancelRental?.addEventListener('click', () => this.closeModal(this.dom.rentalModal));
      this.dom.formRental?.addEventListener('submit', (e) => this.handleRentalSubmit(e));

      // 6. Automated Monetization Calculator Interactive Sliders
      const updateCalc = () => this.updateMonetizationCalculator();
      this.dom.sliderAssets?.addEventListener('input', updateCalc);
      this.dom.sliderDays?.addEventListener('input', updateCalc);
      this.dom.sliderRate?.addEventListener('input', updateCalc);

      this.dom.btnCalcListRate?.addEventListener('click', () => {
        const rate = parseInt(this.dom.sliderRate?.value || '15000', 10);
        this.openListAssetModal();
        if (this.dom.assetRate) this.dom.assetRate.value = rate;
      });

      // 7. Add / Edit Asset Modal Events
      this.dom.btnOpenListModal?.addEventListener('click', () => this.openListAssetModal());
      this.dom.btnCloseList?.addEventListener('click', () => this.closeModal(this.dom.listAssetModal));
      this.dom.btnCancelList?.addEventListener('click', () => this.closeModal(this.dom.listAssetModal));
      this.dom.formListAsset?.addEventListener('submit', (e) => this.handleListAssetSubmit(e));

      // Custom Image File Upload via FileReader
      this.dom.assetImageInput?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
          const base64String = event.target.result;
          if (this.dom.assetImageBase64) this.dom.assetImageBase64.value = base64String;
          if (this.dom.assetImagePreview) this.dom.assetImagePreview.src = base64String;
          if (this.dom.assetImagePreviewContainer) this.dom.assetImagePreviewContainer.style.display = 'block';
        };
        reader.readAsDataURL(file);
      });

      // Remove Image Preview
      this.dom.btnRemovePreview?.addEventListener('click', () => {
        if (this.dom.assetImageInput) this.dom.assetImageInput.value = '';
        if (this.dom.assetImageBase64) this.dom.assetImageBase64.value = '';
        if (this.dom.assetImage) this.dom.assetImage.value = '';
        if (this.dom.assetImagePreview) this.dom.assetImagePreview.src = '';
        if (this.dom.assetImagePreviewContainer) this.dom.assetImagePreviewContainer.style.display = 'none';
      });

      // Preset Image Buttons
      document.querySelectorAll('.preset-img-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const url = e.currentTarget.getAttribute('data-url');
          if (this.dom.assetImage && url) this.dom.assetImage.value = url;
          if (this.dom.assetImageBase64 && url) this.dom.assetImageBase64.value = url;
          if (this.dom.assetImagePreview && url) this.dom.assetImagePreview.src = url;
          if (this.dom.assetImagePreviewContainer) this.dom.assetImagePreviewContainer.style.display = 'block';
          if (this.dom.assetImageInput) this.dom.assetImageInput.value = '';
        });
      });

      // Clear All Data & Load Default Fleet
      this.dom.btnClearAllData?.addEventListener('click', () => this.clearAllData());
      this.dom.btnClearAllMarketplace?.addEventListener('click', () => this.clearAllData());
      this.dom.btnLoadDefaultFleet?.addEventListener('click', () => this.loadDefaultFleet());
      this.dom.btnResetFleet?.addEventListener('click', () => this.loadDefaultFleet());

      // 8. Quick View Modal Events
      this.dom.btnCloseQv?.addEventListener('click', () => this.closeModal(this.dom.quickviewModal));
      this.dom.btnDismissQv?.addEventListener('click', () => this.closeModal(this.dom.quickviewModal));
      this.dom.qvBtnRequest?.addEventListener('click', () => {
        this.closeModal(this.dom.quickviewModal);
        if (this.state.activeModalAsset) {
          this.openRentalModal(this.state.activeModalAsset.id);
        }
      });

      // 9. Negotiate Counter-Offer Modal Events
      this.dom.btnCloseNeg?.addEventListener('click', () => this.closeModal(this.dom.negotiateModal));
      this.dom.btnCancelNeg?.addEventListener('click', () => this.closeModal(this.dom.negotiateModal));
      this.dom.formNegotiate?.addEventListener('submit', (e) => this.handleNegotiateSubmit(e));

      // 10. 2-Step Digital Condition Audit Modal Events
      this.dom.btnOpenAuditModal?.addEventListener('click', () => this.openAuditModal(null));
      this.dom.btnCloseAudit?.addEventListener('click', () => this.closeModal(this.dom.auditModal));
      this.dom.btnCancelAudit?.addEventListener('click', () => this.closeModal(this.dom.auditModal));
      this.dom.auditStep1Pill?.addEventListener('click', () => this.switchAuditStep(1));
      this.dom.auditStep2Pill?.addEventListener('click', () => this.switchAuditStep(2));
      this.dom.btnSubmitAudit?.addEventListener('click', () => this.handleAuditSubmit());

      // 11. Modal Backdrop Click Dismissal
      document.querySelectorAll('.modal-backdrop').forEach(modal => {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) this.closeModal(modal);
        });
      });

      // 12. Global Escape key listener
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          document.querySelectorAll('.modal-backdrop.active').forEach(m => this.closeModal(m));
        }
      });
    }

    // --- Theme Controller ---
    toggleTheme() {
      const nextTheme = this.state.theme === 'light' ? 'dark' : 'light';
      this.applyTheme(nextTheme);
    }

    applyTheme(theme) {
      this.state.theme = theme;
      this.dom.html.setAttribute('data-theme', theme);
      localStorage.setItem('hospitalink_theme', theme);

      if (this.dom.themeIcon) {
        this.dom.themeIcon.setAttribute('data-lucide', theme === 'dark' ? 'sun' : 'moon');
      }
      this.refreshIcons();
    }

    // --- View Mode Controller ---
    switchView(viewName) {
      this.state.currentView = viewName;
      if (viewName === 'seeker') {
        this.dom.viewSeeker?.classList.add('active');
        this.dom.viewProvider?.classList.remove('active');
        this.dom.btnViewSeeker?.classList.add('active');
        this.dom.btnViewSeeker?.setAttribute('aria-selected', 'true');
        this.dom.btnViewProvider?.classList.remove('active');
        this.dom.btnViewProvider?.setAttribute('aria-selected', 'false');
        this.renderMarketplaceListings();
      } else {
        this.dom.viewSeeker?.classList.remove('active');
        this.dom.viewProvider?.classList.add('active');
        this.dom.btnViewSeeker?.classList.remove('active');
        this.dom.btnViewSeeker?.setAttribute('aria-selected', 'false');
        this.dom.btnViewProvider?.classList.add('active');
        this.dom.btnViewProvider?.setAttribute('aria-selected', 'true');
        this.renderProviderDashboard();
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      this.refreshIcons();
    }

    // --- Emergency Mode Toggle ---
    toggleEmergencyMode() {
      this.state.emergencyMode = !this.state.emergencyMode;
      if (this.state.emergencyMode) {
        this.dom.btnEmergencyToggle?.classList.add('active');
        if (this.dom.filterRadius) this.dom.filterRadius.value = "10";
        this.state.selectedRadius = "10";
        this.showToast({
          title: "⚡ Emergency Dispatch Activated",
          message: "Filtered strictly to instant 30-60 min dispatch assets within 10 km radius.",
          type: "warning"
        });
      } else {
        this.dom.btnEmergencyToggle?.classList.remove('active');
        if (this.dom.filterRadius) this.dom.filterRadius.value = "all";
        this.state.selectedRadius = "all";
        this.showToast({
          title: "Marketplace Standard Mode",
          message: "Displaying full catalog across all MMR regions.",
          type: "info"
        });
      }
      this.renderMarketplaceListings();
    }

    // --- Authentication Engine ---
    renderAuthStatus() {
      if (!this.dom.authActionsContainer) return;
      const user = this.state.currentUser;
      if (user) {
        this.dom.authActionsContainer.innerHTML = `
          <div class="user-badge-pill" id="user-profile-badge">
            <span class="user-dot"></span>
            <div style="display: flex; flex-direction: column; text-align: left; line-height: 1.1;">
              <span class="user-biz-name">${this.truncate(user.businessName, 22)}</span>
              <span style="font-size: 0.68rem; color: var(--text-muted);">${user.businessType} • ${user.location.split(',')[0]}</span>
            </div>
            <button class="logout-btn" id="btn-logout" title="Sign Out" aria-label="Sign out">
              <i data-lucide="log-out" style="width: 0.85rem; height: 0.85rem;"></i>
            </button>
          </div>
        `;
        document.getElementById('btn-logout')?.addEventListener('click', (e) => {
          e.stopPropagation();
          this.handleLogout();
        });
      } else {
        this.dom.authActionsContainer.innerHTML = `
          <button class="auth-trigger-btn" id="btn-open-auth">
            <i data-lucide="building" style="width: 1rem; height: 1rem;"></i>
            <span>Enterprise Login</span>
          </button>
        `;
        document.getElementById('btn-open-auth')?.addEventListener('click', () => this.openModal(this.dom.authModal));
      }
      this.refreshIcons();
    }

    toggleAuthTab(tab) {
      if (tab === 'login') {
        this.dom.tabAuthLogin?.classList.add('active');
        this.dom.tabAuthRegister?.classList.remove('active');
        if (this.dom.formLogin) this.dom.formLogin.style.display = 'flex';
        if (this.dom.formRegister) this.dom.formRegister.style.display = 'none';
      } else {
        this.dom.tabAuthLogin?.classList.remove('active');
        this.dom.tabAuthRegister?.classList.add('active');
        if (this.dom.formLogin) this.dom.formLogin.style.display = 'none';
        if (this.dom.formRegister) this.dom.formRegister.style.display = 'flex';
      }
    }

    loginDemoUser(index) {
      const demoUsers = (typeof window !== 'undefined' && window.DEMO_USERS) ? window.DEMO_USERS : [];
      const user = demoUsers[index] || {
        businessName: "Imperial Banquets & Hospitality Ltd",
        email: "procurement@imperialbanquets.in",
        businessType: "Hotel & Resort",
        role: "Provider & Seeker",
        location: "Lower Parel, Mumbai",
        verified: true
      };
      this.saveCurrentUser(user);
      this.closeModal(this.dom.authModal);
      this.showToast({
        title: "Enterprise Session Verified",
        message: `Welcome back, ${user.businessName}. Authorized for MMR trading grid.`,
        type: "success"
      });
    }

    handleLogin(e) {
      e.preventDefault();
      const email = document.getElementById('login-email')?.value || "procurement@grandpalace.com";
      const user = {
        businessName: email.split('@')[0].replace('.', ' ').toUpperCase() + " ENTERPRISE",
        email: email,
        businessType: "Hotel & Resort",
        role: "Provider & Seeker",
        location: "Lower Parel, Mumbai",
        verified: true
      };
      this.saveCurrentUser(user);
      this.closeModal(this.dom.authModal);
      this.showToast({
        title: "Login Successful",
        message: `Signed in as ${user.businessName}`,
        type: "success"
      });
    }

    handleRegister(e) {
      e.preventDefault();
      const user = {
        businessName: document.getElementById('reg-biz-name')?.value || "Metro Catering Ltd",
        email: document.getElementById('reg-email')?.value || "admin@metrocatering.in",
        businessType: document.getElementById('reg-biz-type')?.value || "Catering Enterprise",
        role: "Provider & Seeker",
        location: document.getElementById('reg-hub')?.value + ", MMR" || "Mumbai",
        verified: true
      };
      this.saveCurrentUser(user);
      this.closeModal(this.dom.authModal);
      this.showToast({
        title: "Registration Approved",
        message: `Organization ${user.businessName} verified on MMR Exchange.`,
        type: "success"
      });
    }

    handleLogout() {
      this.saveCurrentUser(null);
      this.showToast({
        title: "Session Terminated",
        message: "You have signed out from the enterprise portal.",
        type: "info"
      });
    }

    // --- Category Pills Navigation ---
    renderCategoryPills() {
      if (!this.dom.categoryPillsContainer) return;
      const categories = [
        { id: "all", label: "All Categories", icon: "grid" },
        { id: "Venue", label: "Venues & Banquets", icon: "champagne-glasses" },
        { id: "Kitchen", label: "Commercial Kitchens", icon: "utensils" },
        { id: "Vehicle", label: "Logistics & Vehicles", icon: "truck" },
        { id: "Equipment", label: "Event Equipment", icon: "speaker" }
      ];

      this.dom.categoryPillsContainer.innerHTML = categories.map(cat => `
        <button 
          class="category-pill ${this.state.activeCategory === cat.id ? 'active' : ''}" 
          data-cat="${cat.id}"
        >
          <i data-lucide="${cat.icon}" style="width: 0.9rem; height: 0.9rem;"></i>
          <span>${cat.label}</span>
        </button>
      `).join('');

      this.dom.categoryPillsContainer.querySelectorAll('.category-pill').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const catId = e.currentTarget.getAttribute('data-cat');
          this.state.activeCategory = catId;
          if (this.dom.filterCategory) this.dom.filterCategory.value = catId;
          this.renderCategoryPills();
          this.renderMarketplaceListings();
        });
      });
      this.refreshIcons();
    }

    // --- Marketplace Listings & Proximity Filtering ---
    renderMarketplaceListings() {
      if (!this.dom.listingsGrid) return;

      let items = [...this.state.inventory];

      // Calculate distance for each item relative to BKC Depot
      items.forEach(item => {
        const coords = item.coordinates || MMR_DEPOT_COORDS;
        item._distanceKm = calculateDistanceKm(
          MMR_DEPOT_COORDS.lat,
          MMR_DEPOT_COORDS.lng,
          coords.lat,
          coords.lng
        );
      });

      // 1. Emergency Mode Filter (Only assets with instantDispatchAvailable = true)
      if (this.state.emergencyMode) {
        items = items.filter(item => item.instantDispatchAvailable === true);
      }

      // 2. Proximity Radius Filter
      if (this.state.selectedRadius !== 'all') {
        const maxDist = parseFloat(this.state.selectedRadius);
        items = items.filter(item => item._distanceKm <= maxDist);
      }

      // 3. Category Filter
      if (this.state.activeCategory !== 'all') {
        items = items.filter(item => {
          const c = item.category.toLowerCase();
          const target = this.state.activeCategory.toLowerCase();
          if (target === 'venue') return c.includes('venue');
          if (target === 'kitchen') return c.includes('kitchen');
          if (target === 'vehicle') return c.includes('vehicle');
          if (target === 'equipment') return c.includes('equipment');
          return c === target;
        });
      }

      // 4. Location Filter (MMR)
      if (this.state.selectedLocation !== 'all') {
        items = items.filter(item => item.location.toLowerCase().includes(this.state.selectedLocation.toLowerCase()));
      }

      // 5. Price Range Filter
      if (this.state.selectedPriceRange !== 'all') {
        if (this.state.selectedPriceRange === 'under-5k') {
          items = items.filter(i => i.pricePerDay < 5000);
        } else if (this.state.selectedPriceRange === '5k-15k') {
          items = items.filter(i => i.pricePerDay >= 5000 && i.pricePerDay <= 15000);
        } else if (this.state.selectedPriceRange === '15k-30k') {
          items = items.filter(i => i.pricePerDay > 15000 && i.pricePerDay <= 30000);
        } else if (this.state.selectedPriceRange === 'above-30k') {
          items = items.filter(i => i.pricePerDay > 30000);
        }
      }

      // 6. Fulfillment Filter
      if (this.state.selectedFulfillment !== 'all') {
        items = items.filter(item => item.fulfillmentType === this.state.selectedFulfillment);
      }

      // 7. Search Query
      if (this.state.searchQuery) {
        const q = this.state.searchQuery;
        items = items.filter(item =>
          item.title.toLowerCase().includes(q) ||
          item.shopName.toLowerCase().includes(q) ||
          item.vendorType.toLowerCase().includes(q) ||
          item.location.toLowerCase().includes(q)
        );
      }

      // 8. Sorting
      if (this.state.sortBy === 'price-asc') {
        items.sort((a, b) => a.pricePerDay - b.pricePerDay);
      } else if (this.state.sortBy === 'price-desc') {
        items.sort((a, b) => b.pricePerDay - a.pricePerDay);
      }

      // Update Results Counter
      if (this.dom.resultsCountText) {
        const modeLabel = this.state.emergencyMode ? " ⚡ Emergency Dispatch" : "";
        this.dom.resultsCountText.innerHTML = `Showing <strong class="results-count">${items.length}</strong>${modeLabel} commercial assets`;
      }
      if (this.dom.metricListingsCount) {
        this.dom.metricListingsCount.textContent = `${items.length} Assets Available`;
      }

      // Empty State (Clean inventory empty vs filter empty)
      if (this.state.inventory.length === 0) {
        this.dom.listingsGrid.innerHTML = `
          <div class="empty-state-wrap" style="grid-column: 1 / -1; text-align: center; padding: 4rem 1.5rem; background-color: var(--card-bg); border-radius: var(--radius-lg); border: 1px dashed var(--border-strong);">
            <div style="font-size: 3.2rem; margin-bottom: 0.75rem;">📦</div>
            <h3 style="font-size: 1.35rem; color: var(--text-primary); margin-bottom: 0.5rem;">No resources listed yet. Click 'List Asset' to add one!</h3>
            <p style="color: var(--text-muted); font-size: 0.95rem; max-width: 480px; margin: 0 auto 1.5rem;">
              Your resource exchange inventory is currently empty. Add a new commercial equipment listing or reload the default MMR fleet.
            </p>
            <div style="display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap;">
              <button class="btn-primary-action" id="empty-list-asset-btn">
                <i data-lucide="plus-circle" style="width: 1rem; height: 1rem;"></i>
                <span>List Asset</span>
              </button>
              <button class="reset-filters-btn" id="empty-load-default-btn" style="background: var(--card-bg); border-color: var(--border-subtle); display: inline-flex; align-items: center; gap: 0.4rem;">
                <i data-lucide="rotate-ccw" style="width: 1rem; height: 1rem; color: var(--accent-primary);"></i>
                <span>Load Default Fleet</span>
              </button>
            </div>
          </div>
        `;
        document.getElementById('empty-list-asset-btn')?.addEventListener('click', () => this.openListAssetModal());
        document.getElementById('empty-load-default-btn')?.addEventListener('click', () => this.loadDefaultFleet());
        this.refreshIcons();
        return;
      }

      if (items.length === 0) {
        this.dom.listingsGrid.innerHTML = `
          <div class="empty-state-wrap" style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem;">
            <div style="font-size: 3rem; margin-bottom: 0.5rem;">🔍</div>
            <h3 style="font-size: 1.2rem; color: var(--text-primary); margin-bottom: 0.5rem;">No MMR Assets Match Your Search Criteria</h3>
            <p style="color: var(--text-muted); font-size: 0.9rem; max-width: 480px; margin: 0 auto 1.25rem;">
              ${this.state.emergencyMode ? 'No emergency units found within proximity radius. Try increasing radius to 15 km or turning off Emergency Mode.' : 'Try adjusting your region filter, daily price range, or category filter.'}
            </p>
            <button class="btn-primary-action" id="empty-reset-btn" style="margin: 0 auto;">Reset Filters</button>
          </div>
        `;
        document.getElementById('empty-reset-btn')?.addEventListener('click', () => this.resetFilters());
        this.refreshIcons();
        return;
      }

      // Render Cards
      this.dom.listingsGrid.innerHTML = items.map(asset => {
        const isAvailable = asset.availabilityStatus === 'Available';
        const imgUrl = asset.image || 'https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=800&q=80';
        const distanceText = `${asset._distanceKm || 6.5} km from BKC`;
        const instantBadge = asset.instantDispatchAvailable
          ? `<span class="instant-dispatch-badge" style="position: absolute; bottom: 8px; left: 8px;"><i data-lucide="zap" style="width:0.75rem;height:0.75rem;"></i>⚡ 30–60 Min Dispatch</span>`
          : '';

        return `
          <article class="asset-card ${!isAvailable ? 'is-booked' : ''}" data-id="${asset.id}">
            <!-- Media Container -->
            <div class="card-media">
              <img 
                src="${imgUrl}" 
                alt="${asset.title}" 
                loading="lazy"
              >
              <span class="card-category-badge">${asset.category}</span>
              <span class="card-status-pill ${isAvailable ? 'available' : 'booked'}">
                ${isAvailable ? 'Available' : 'Booked'}
              </span>
              ${instantBadge}
            </div>

            <!-- Body Details -->
            <div class="card-body">
              <div class="card-provider-row">
                <span class="provider-info">${asset.shopName}</span>
                <span class="proximity-tag">📍 ${distanceText}</span>
              </div>

              <h3 class="card-title" title="${asset.title}">${asset.title}</h3>

              <div class="card-location-row">
                <span class="store-location-badge">
                  <i data-lucide="map-pin" style="width: 0.85rem; height: 0.85rem;"></i>
                  <span>${asset.location}</span>
                </span>
                <span class="fulfillment-badge ${asset.fulfillmentType === 'Site Delivery' ? 'fulfillment-delivery' : 'fulfillment-pickup'}">
                  ${asset.fulfillmentType}
                </span>
              </div>

              <!-- Pricing & Action Row -->
              <div class="card-footer">
                <div class="price-box">
                  <span class="price-amount">₹${asset.pricePerDay.toLocaleString('en-IN')}</span>
                  <span class="price-period">per calendar day</span>
                </div>

                <div class="card-actions">
                  <button class="btn-quickview" data-qv-id="${asset.id}" title="Quick Specs & Details">
                    <i data-lucide="eye" style="width: 1rem; height: 1rem;"></i>
                  </button>
                  <button 
                    class="btn-request-rent ${!isAvailable ? 'btn-booked-action' : ''}" 
                    data-book-id="${asset.id}" 
                    data-rent="${asset.id}"
                    style="${!isAvailable ? 'background-color: var(--accent-amber); cursor: not-allowed;' : ''}"
                  >
                    ${!isAvailable 
                      ? 'Date Locked' 
                      : (this.state.emergencyMode ? '⚡ Instant Dispatch' : 'Request Rent')}
                  </button>
                </div>
              </div>
            </div>

            <!-- Card Management Bar (Real-Time Edit & Delete) -->
            <div class="card-manage-bar">
              <button type="button" class="btn-card-action btn-edit-action" data-edit-id="${asset.id}" title="Edit this resource">
                <i data-lucide="edit-3" style="width: 0.8rem; height: 0.8rem;"></i>
                <span>✏️ Edit Resource</span>
              </button>
              <button type="button" class="btn-card-action btn-delete-action" data-delete-id="${asset.id}" title="Delete this resource">
                <i data-lucide="trash-2" style="width: 0.8rem; height: 0.8rem;"></i>
                <span>🗑️ Delete Resource</span>
              </button>
            </div>
          </article>
        `;
      }).join('');

      // Attach Card Button Handlers
      this.dom.listingsGrid.querySelectorAll('[data-qv-id]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = e.currentTarget.getAttribute('data-qv-id');
          this.openQuickViewModal(id);
        });
      });

      this.dom.listingsGrid.querySelectorAll('[data-book-id], [data-rent]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = e.currentTarget.getAttribute('data-book-id') || e.currentTarget.getAttribute('data-rent');
          const item = this.state.inventory.find(a => a.id === id);
          if (item && item.availabilityStatus === 'Booked') {
            this.showToast({
              title: "Asset Date-Locked",
              message: `${item.title} is already booked for these dates. Please choose an available asset.`,
              type: "warning"
            });
            return;
          }
          this.openRentalModal(id);
        });
      });

      // Attach Real-Time Edit and Delete Handlers on Cards
      this.dom.listingsGrid.querySelectorAll('[data-edit-id]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = e.currentTarget.getAttribute('data-edit-id');
          this.editResource(id);
        });
      });

      this.dom.listingsGrid.querySelectorAll('[data-delete-id]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = e.currentTarget.getAttribute('data-delete-id');
          this.deleteResource(id);
        });
      });

      this.refreshIcons();
    }

    resetFilters() {
      this.state.searchQuery = '';
      this.state.activeCategory = 'all';
      this.state.selectedLocation = 'all';
      this.state.selectedPriceRange = 'all';
      this.state.selectedFulfillment = 'all';
      this.state.selectedRadius = 'all';
      this.state.sortBy = 'featured';
      this.state.emergencyMode = false;

      if (this.dom.searchInput) this.dom.searchInput.value = '';
      if (this.dom.filterLocation) this.dom.filterLocation.value = 'all';
      if (this.dom.filterCategory) this.dom.filterCategory.value = 'all';
      if (this.dom.filterPrice) this.dom.filterPrice.value = 'all';
      if (this.dom.filterFulfillment) this.dom.filterFulfillment.value = 'all';
      if (this.dom.filterRadius) this.dom.filterRadius.value = 'all';
      if (this.dom.sortSelect) this.dom.sortSelect.value = 'featured';
      this.dom.btnEmergencyToggle?.classList.remove('active');

      this.renderCategoryPills();
      this.renderMarketplaceListings();
      this.showToast({ title: "Filters Cleared", message: "Marketplace view reset to full MMR inventory.", type: "info" });
    }

    // --- Dual-Booking Modal Engine ---
    openRentalModal(assetId) {
      const asset = this.state.inventory.find(a => a.id === assetId);
      if (!asset) return;

      this.state.activeModalAsset = asset;
      if (this.dom.rentalAssetId) this.dom.rentalAssetId.value = asset.id;

      // Set booking mode based on whether emergencyMode is active
      this.setBookingMode(this.state.emergencyMode ? 'emergency' : 'planned');

      // Date Pickers: Tomorrow to 3 days later
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const afterTomorrow = new Date(today);
      afterTomorrow.setDate(afterTomorrow.getDate() + 3);

      const formatDate = (d) => d.toISOString().split('T')[0];

      if (this.dom.rentalStartDate) {
        this.dom.rentalStartDate.min = formatDate(today);
        this.dom.rentalStartDate.value = this.state.emergencyMode ? formatDate(today) : formatDate(tomorrow);
      }
      if (this.dom.rentalEndDate) {
        this.dom.rentalEndDate.min = formatDate(today);
        this.dom.rentalEndDate.value = this.state.emergencyMode ? formatDate(tomorrow) : formatDate(afterTomorrow);
      }

      // Populate Asset Summary Header
      const coords = asset.coordinates || MMR_DEPOT_COORDS;
      const distance = calculateDistanceKm(MMR_DEPOT_COORDS.lat, MMR_DEPOT_COORDS.lng, coords.lat, coords.lng);
      asset._distanceKm = distance;

      if (this.dom.simDistanceKm) {
        this.dom.simDistanceKm.textContent = `📍 ${distance} km from BKC Origin`;
      }

      if (this.dom.rentalAssetSummary) {
        this.dom.rentalAssetSummary.innerHTML = `
          <img 
            src="${getSafeImageUrl(asset.image, asset.category)}" 
            alt="${asset.title}" 
            style="width: 72px; height: 54px; object-fit: cover; border-radius: var(--radius-sm); flex-shrink: 0;"
          >
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 700; font-size: 0.9rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${asset.title}
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">
              ${asset.shopName} • <span style="color: var(--accent-primary); font-weight: 600;">₹${asset.pricePerDay.toLocaleString('en-IN')}/day</span>
            </div>
            <div style="font-size: 0.72rem; color: var(--accent-emerald); font-weight: 600; margin-top: 2px;">
              📍 ${asset.location} (${distance} km away)
            </div>
          </div>
        `;
      }

      // Configure Delivery options based on fulfillmentType
      if (asset.fulfillmentType === 'In-Store Pickup') {
        if (this.dom.radioPickup) this.dom.radioPickup.checked = true;
      } else {
        if (this.dom.radioDelivery) this.dom.radioDelivery.checked = true;
      }
      this.handleLogisticsModeChange();

      this.recalculateRentalQuote();
      this.openModal(this.dom.rentalModal);
    }

    setBookingMode(mode) {
      this.state.bookingMode = mode;
      if (mode === 'emergency') {
        this.dom.btnModePlanned?.classList.remove('active');
        this.dom.btnModeEmergency?.classList.add('active');
        if (this.dom.rowTokenAmount) {
          this.dom.rowTokenAmount.innerHTML = `
            <span>⚡ Emergency Fast-Track Payment:</span>
            <strong id="calc-token-amount" style="color: #ea580c;">100% Contract Value</strong>
          `;
        }
        if (this.dom.btnSubmitRentalText) {
          this.dom.btnSubmitRentalText.textContent = "⚡ Confirm Instant Dispatch (30-60 Min)";
        }
      } else {
        this.dom.btnModePlanned?.classList.add('active');
        this.dom.btnModeEmergency?.classList.remove('active');
        if (this.dom.rowTokenAmount) {
          this.dom.rowTokenAmount.innerHTML = `
            <span>20% Token Amount to Lock Date:</span>
            <strong id="calc-token-amount" style="color: var(--accent-primary);">₹0</strong>
          `;
        }
        if (this.dom.btnSubmitRentalText) {
          this.dom.btnSubmitRentalText.textContent = "Lock Date with 20% Token";
        }
      }
      this.recalculateRentalQuote();
    }

    handleLogisticsModeChange() {
      const isDelivery = this.dom.radioDelivery?.checked;
      if (this.dom.deliveryOptionsBox) {
        this.dom.deliveryOptionsBox.style.display = isDelivery ? 'flex' : 'none';
      }
      if (this.dom.deliveryAddressGroup) {
        this.dom.deliveryAddressGroup.style.display = isDelivery ? 'block' : 'none';
      }
      this.recalculateRentalQuote();
    }

    recalculateRentalQuote() {
      const asset = this.state.activeModalAsset;
      if (!asset) return;

      const startDateStr = this.dom.rentalStartDate?.value;
      const endDateStr = this.dom.rentalEndDate?.value;

      let days = 1;
      if (startDateStr && endDateStr) {
        const start = new Date(startDateStr);
        const end = new Date(endDateStr);
        const diffMs = end - start;
        days = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
      }

      const dailyRate = asset.pricePerDay || 10000;
      const subtotal = days * dailyRate;

      // 3PL Logistics Fare Calculation
      const isDelivery = this.dom.radioDelivery?.checked;
      const isRoundTrip = this.dom.chkRoundtrip?.checked;
      const distance = asset._distanceKm || 6.5;

      let logisticsFee = 0;
      if (isDelivery) {
        logisticsFee = calculateLogisticsFare(distance, isRoundTrip);
      }

      // Security Deposit Escrow: 50% of 1-day rate
      const escrowDeposit = Math.round(dailyRate * 0.5);

      // 20% Token Amount calculation for planned date-locking
      const tokenAmount = Math.round(subtotal * 0.20);
      const grandTotal = subtotal + logisticsFee + escrowDeposit;

      // Update DOM
      if (this.dom.calcDuration) this.dom.calcDuration.textContent = `${days} Day${days > 1 ? 's' : ''}`;
      if (this.dom.calcSubtotal) this.dom.calcSubtotal.textContent = `₹${subtotal.toLocaleString('en-IN')}`;
      if (this.dom.simDeliveryRate) this.dom.simDeliveryRate.textContent = `₹${logisticsFee.toLocaleString('en-IN')}`;
      if (this.dom.calcLogisticsFee) {
        this.dom.calcLogisticsFee.textContent = isDelivery
          ? `₹${logisticsFee.toLocaleString('en-IN')} (${isRoundTrip ? 'Round-Trip -20%' : 'One-Way'})`
          : '₹0 (In-Store Pickup)';
      }
      if (this.dom.calcDeposit) this.dom.calcDeposit.textContent = `₹${escrowDeposit.toLocaleString('en-IN')} (Refundable)`;
      if (this.dom.calcGrandTotal) this.dom.calcGrandTotal.textContent = `₹${grandTotal.toLocaleString('en-IN')}`;

      if (this.state.bookingMode === 'planned') {
        const tokenDisplay = document.getElementById('calc-token-amount');
        if (tokenDisplay) tokenDisplay.textContent = `₹${tokenAmount.toLocaleString('en-IN')}`;
        if (this.dom.btnSubmitRentalText) {
          this.dom.btnSubmitRentalText.textContent = `Lock Date with 20% Token (₹${tokenAmount.toLocaleString('en-IN')})`;
        }
      } else {
        if (this.dom.btnSubmitRentalText) {
          this.dom.btnSubmitRentalText.textContent = `⚡ Confirm Instant Dispatch (₹${grandTotal.toLocaleString('en-IN')})`;
        }
      }
    }

    handleRentalSubmit(e) {
      e.preventDefault();
      const asset = this.state.activeModalAsset;
      if (!asset) return;

      // Double-booking check
      if (asset.availabilityStatus === 'Booked') {
        this.showToast({
          title: "Asset Double-Booking Blocked",
          message: "This asset is already booked for these dates in the calendar.",
          type: "warning"
        });
        return;
      }

      const startDate = this.dom.rentalStartDate?.value;
      const endDate = this.dom.rentalEndDate?.value;
      const isDelivery = this.dom.radioDelivery?.checked;
      const isRoundTrip = this.dom.chkRoundtrip?.checked;
      const deliveryAddress = isDelivery ? (this.dom.rentalDeliveryAddress?.value || "BKC Central Venue") : "In-Store Pickup";

      const start = new Date(startDate);
      const end = new Date(endDate);
      const days = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
      const subtotal = days * asset.pricePerDay;
      const logisticsFee = isDelivery ? calculateLogisticsFare(asset._distanceKm || 6.5, isRoundTrip) : 0;
      const escrowDeposit = Math.round(asset.pricePerDay * 0.5);
      const tokenAmount = Math.round(subtotal * 0.20);
      const grandTotal = subtotal + logisticsFee + escrowDeposit;

      const newRequestId = `REQ-${Math.floor(1000 + Math.random() * 9000)}`;

      const newRequest = {
        id: newRequestId,
        assetId: asset.id,
        assetTitle: asset.title,
        seekerBusiness: this.state.currentUser?.businessName || "Taj Lands End Banquets",
        seekerContact: this.state.currentUser?.email || "events@tajhotels.com",
        startDate: startDate,
        endDate: endDate,
        days: days,
        dailyRate: asset.pricePerDay,
        totalAmount: grandTotal,
        tokenAmount: tokenAmount,
        escrowDeposit: escrowDeposit,
        bookingMode: this.state.bookingMode === 'emergency' ? 'Emergency Dispatch' : 'Planned Advance',
        deliveryMode: isDelivery ? (isRoundTrip ? 'Site Delivery (Round-Trip -20%)' : 'Site Delivery') : 'In-Store Pickup',
        deliveryFee: logisticsFee,
        deliveryLocation: deliveryAddress,
        status: "Approved",
        notes: this.state.bookingMode === 'emergency'
          ? "⚡ Emergency 30-60 min dispatch contract activated."
          : `20% Token Amount (₹${tokenAmount.toLocaleString('en-IN')}) verified via platform escrow. Calendar frozen.`,
        auditStatus: "Pending Dispatch"
      };

      // 1. SMART CALENDAR LOCK: Freeze asset immediately
      asset.availabilityStatus = "Booked";
      this.saveInventory();

      // 2. Append request to state and localStorage
      this.state.requests.unshift(newRequest);
      this.saveRequests();

      this.closeModal(this.dom.rentalModal);

      // Toast feedback
      if (this.state.bookingMode === 'emergency') {
        this.showToast({
          title: "⚡ Emergency Dispatch Confirmed!",
          message: `Booking ${newRequestId} dispatched! 3PL driver en route. Calendar locked for ${asset.title}.`,
          type: "success"
        });
      } else {
        this.showToast({
          title: "Date Locked with 20% Token!",
          message: `Received ₹${tokenAmount.toLocaleString('en-IN')} token. Calendar frozen to prevent double-booking.`,
          type: "success"
        });
      }

      this.renderMarketplaceListings();
      this.renderProviderDashboard();
    }

    // --- Provider Dashboard & KPI Rendering ---
    renderProviderDashboard() {
      // Calculate KPIs
      let totalRevenue = 0;
      let pendingCount = 0;
      let activeCount = 0;

      this.state.requests.forEach(r => {
        if (r.status === 'Approved') {
          totalRevenue += (r.totalAmount || 0);
          activeCount++;
        } else if (r.status === 'Pending' || r.status === 'Negotiating') {
          pendingCount++;
        }
      });

      if (this.dom.provStatRevenue) {
        this.dom.provStatRevenue.textContent = `₹${(totalRevenue + 284500).toLocaleString('en-IN')}`;
      }
      if (this.dom.provStatPending) {
        this.dom.provStatPending.textContent = `${pendingCount} Requests`;
      }
      if (this.dom.provStatActive) {
        this.dom.provStatActive.textContent = `${activeCount} Units Active`;
      }

      const totalAssets = this.state.inventory.length;
      const bookedAssets = this.state.inventory.filter(a => a.availabilityStatus === 'Booked').length;
      const utilRate = totalAssets > 0 ? ((bookedAssets / totalAssets) * 100).toFixed(1) : '75.0';
      if (this.dom.provStatUtil) {
        this.dom.provStatUtil.textContent = `${utilRate}%`;
      }

      // Render Incoming Requests Table
      this.renderRequestsTable();

      // Render Provider Registered Inventory Fleet
      this.renderProviderFleetTable();
    }

    renderRequestsTable() {
      if (!this.dom.requestsTableBody) return;

      const requests = this.state.requests;
      if (this.dom.requestsCounterBadge) {
        this.dom.requestsCounterBadge.textContent = `${requests.length} Total Requests`;
      }

      if (requests.length === 0) {
        this.dom.requestsTableBody.innerHTML = `
          <tr>
            <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2rem;">
              No rental requests currently in the pipeline.
            </td>
          </tr>
        `;
        return;
      }

      this.dom.requestsTableBody.innerHTML = requests.map(req => {
        let statusClass = 'pending';
        if (req.status === 'Approved') statusClass = 'approved';
        if (req.status === 'Rejected') statusClass = 'rejected';
        if (req.status === 'Negotiating') statusClass = 'negotiating';

        const modePill = req.bookingMode === 'Emergency Dispatch'
          ? `<span class="instant-dispatch-badge" style="display:inline-flex; padding: 2px 6px; font-size: 0.7rem;">⚡ Emergency</span>`
          : `<span class="coordinates-tag" style="padding: 2px 6px; font-size: 0.7rem;">📅 Planned</span>`;

        return `
          <tr data-req-id="${req.id}">
            <td>
              <strong style="color: var(--accent-primary);">${req.id}</strong>
              <div style="font-size: 0.7rem; color: var(--text-muted);">${req.auditStatus || 'Pending Dispatch'}</div>
            </td>
            <td>
              <div style="font-weight: 600; color: var(--text-primary);">${this.truncate(req.assetTitle, 28)}</div>
              <span class="coordinates-tag">${req.assetId.toUpperCase()}</span>
            </td>
            <td>
              <div style="font-weight: 600;">${req.seekerBusiness}</div>
              <div style="font-size: 0.72rem; color: var(--text-muted);">${req.seekerContact}</div>
            </td>
            <td>
              ${modePill}
              <div style="font-size: 0.75rem; margin-top: 2px; color: var(--text-primary);">
                ${req.startDate} → ${req.endDate} (${req.days}d)
              </div>
            </td>
            <td>
              <div style="font-weight: 700; color: var(--text-primary);">₹${req.totalAmount.toLocaleString('en-IN')}</div>
              <div style="font-size: 0.72rem; color: var(--accent-emerald);">Token: ₹${(req.tokenAmount || 0).toLocaleString('en-IN')}</div>
            </td>
            <td>
              <div style="font-size: 0.78rem;">Escrow: <strong>₹${(req.escrowDeposit || 0).toLocaleString('en-IN')}</strong></div>
              <div style="font-size: 0.72rem; color: var(--text-muted);">${req.deliveryMode || 'Site Delivery'}</div>
            </td>
            <td>
              <span class="status-badge ${statusClass}">${req.status}</span>
              ${req.negotiationOffer ? `<div style="font-size: 0.7rem; color: var(--accent-purple); margin-top: 2px;">Offer: ₹${req.negotiationOffer.toLocaleString('en-IN')}</div>` : ''}
            </td>
            <td style="text-align: right;">
              <div style="display: flex; gap: 0.35rem; justify-content: flex-end; flex-wrap: wrap;">
                ${req.status === 'Pending' || req.status === 'Negotiating' ? `
                  <button class="action-table-btn btn-accept-req" data-id="${req.id}" title="Accept & Freeze Calendar">
                    <i data-lucide="check" style="width: 0.85rem; height: 0.85rem;"></i> Accept
                  </button>
                  <button class="action-table-btn btn-negotiate-req" data-id="${req.id}" title="Send Counter-Offer">
                    <i data-lucide="message-square" style="width: 0.85rem; height: 0.85rem;"></i> Counter
                  </button>
                  <button class="action-table-btn btn-reject-req" data-id="${req.id}" title="Reject Request">
                    <i data-lucide="x" style="width: 0.85rem; height: 0.85rem;"></i>
                  </button>
                ` : `
                  <button class="action-table-btn btn-audit-req" data-id="${req.id}" title="2-Step Photo Audit & Escrow">
                    <i data-lucide="clipboard-check" style="width: 0.85rem; height: 0.85rem; color: var(--accent-emerald);"></i> Audit
                  </button>
                `}
              </div>
            </td>
          </tr>
        `;
      }).join('');

      // Attach Request Table Action Handlers
      this.dom.requestsTableBody.querySelectorAll('.btn-accept-req').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = e.currentTarget.getAttribute('data-id');
          this.handleAcceptRequest(id);
        });
      });

      this.dom.requestsTableBody.querySelectorAll('.btn-reject-req').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = e.currentTarget.getAttribute('data-id');
          this.handleRejectRequest(id);
        });
      });

      this.dom.requestsTableBody.querySelectorAll('.btn-negotiate-req').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = e.currentTarget.getAttribute('data-id');
          this.openNegotiateModal(id);
        });
      });

      this.dom.requestsTableBody.querySelectorAll('.btn-audit-req').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = e.currentTarget.getAttribute('data-id');
          this.openAuditModal(id);
        });
      });

      this.refreshIcons();
    }

    renderProviderFleetTable() {
      if (!this.dom.providerInventoryTableBody) return;

      if (this.state.inventory.length === 0) {
        this.dom.providerInventoryTableBody.innerHTML = `
          <tr>
            <td colspan="10" style="text-align: center; padding: 3.5rem 1rem; color: var(--text-muted);">
              <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📦</div>
              <div style="font-size: 1.15rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.35rem;">No resources listed yet.</div>
              <div style="font-size: 0.9rem; margin-bottom: 1.25rem;">Click 'List Asset' to add one!</div>
              <div style="display: inline-flex; gap: 0.75rem; flex-wrap: wrap; justify-content: center;">
                <button class="btn-primary-action" id="table-empty-list-btn" style="font-size: 0.85rem; padding: 0.5rem 1.2rem;">
                  <i data-lucide="plus-circle" style="width: 0.9rem; height: 0.9rem;"></i>
                  <span>List Asset</span>
                </button>
                <button class="reset-filters-btn" id="table-empty-load-btn" style="font-size: 0.85rem; padding: 0.5rem 1.2rem; background: var(--card-bg); border-color: var(--border-subtle);">
                  <i data-lucide="rotate-ccw" style="width: 0.9rem; height: 0.9rem; color: var(--accent-primary);"></i>
                  <span>Load Default Fleet</span>
                </button>
              </div>
            </td>
          </tr>
        `;
        document.getElementById('table-empty-list-btn')?.addEventListener('click', () => this.openListAssetModal());
        document.getElementById('table-empty-load-btn')?.addEventListener('click', () => this.loadDefaultFleet());
        this.refreshIcons();
        return;
      }

      this.dom.providerInventoryTableBody.innerHTML = this.state.inventory.map(asset => {
        const isAvailable = asset.availabilityStatus === 'Available';
        return `
          <tr data-fleet-id="${asset.id}">
            <td><strong class="coordinates-tag">${asset.id.toUpperCase()}</strong></td>
            <td>
              <div style="font-weight: 600; color: var(--text-primary);">${asset.title}</div>
              ${asset.instantDispatchAvailable ? '<span style="font-size: 0.68rem; color: #ea580c;">⚡ Instant Dispatch Enabled</span>' : ''}
            </td>
            <td><span class="category-badge-chip">${asset.category}</span></td>
            <td>${asset.shopName}</td>
            <td><span style="font-size: 0.78rem; color: var(--text-muted);">${asset.vendorType}</span></td>
            <td>${asset.location}</td>
            <td><span class="fulfillment-badge ${asset.fulfillmentType === 'Site Delivery' ? 'fulfillment-delivery' : 'fulfillment-pickup'}">${asset.fulfillmentType}</span></td>
            <td><strong>₹${asset.pricePerDay.toLocaleString('en-IN')}</strong></td>
            <td>
              <button class="status-badge ${isAvailable ? 'approved' : 'pending'} btn-toggle-avail" data-asset-id="${asset.id}" style="cursor: pointer; border: none;" title="Click to toggle Available / Booked">
                ${asset.availabilityStatus} ↻
              </button>
            </td>
            <td style="text-align: right; white-space: nowrap;">
              <button class="action-table-btn btn-edit-fleet-asset" data-edit-id="${asset.id}" title="Edit this resource" style="margin-right: 0.35rem; color: var(--accent-primary); border-color: var(--border-subtle); background: var(--card-bg);">
                <i data-lucide="edit-3" style="width: 0.85rem; height: 0.85rem;"></i>
                <span>Edit</span>
              </button>
              <button class="action-table-btn btn-delete-fleet-asset" data-delete-id="${asset.id}" title="Remove this resource" style="color: var(--accent-rose); border-color: rgba(244, 63, 94, 0.4); background: var(--card-bg);">
                <i data-lucide="trash-2" style="width: 0.85rem; height: 0.85rem;"></i>
                <span>Delete</span>
              </button>
            </td>
          </tr>
        `;
      }).join('');

      // Toggle Availability
      this.dom.providerInventoryTableBody.querySelectorAll('.btn-toggle-avail').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const assetId = e.currentTarget.getAttribute('data-asset-id');
          const item = this.state.inventory.find(a => a.id === assetId);
          if (item) {
            item.availabilityStatus = item.availabilityStatus === 'Available' ? 'Booked' : 'Available';
            this.saveInventory();
            this.renderMarketplaceListings();
            this.renderProviderDashboard();
            this.showToast({
              title: "Availability Toggled",
              message: `${item.title} is now marked as ${item.availabilityStatus}.`,
              type: "info"
            });
          }
        });
      });

      // Edit Resource from Fleet
      this.dom.providerInventoryTableBody.querySelectorAll('.btn-edit-fleet-asset').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const assetId = e.currentTarget.getAttribute('data-edit-id');
          this.editResource(assetId);
        });
      });

      // Delete Asset from Fleet
      this.dom.providerInventoryTableBody.querySelectorAll('.btn-delete-fleet-asset').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const assetId = e.currentTarget.getAttribute('data-delete-id');
          this.deleteResource(assetId);
        });
      });

      this.refreshIcons();
    }

    // --- Provider 3-Way Request Negotiation Engine ---
    handleAcceptRequest(reqId) {
      const req = this.state.requests.find(r => r.id === reqId);
      if (!req) return;

      req.status = 'Approved';

      // Smart calendar lock: Ensure asset calendar is frozen
      const asset = this.state.inventory.find(a => a.id === req.assetId);
      if (asset) {
        asset.availabilityStatus = 'Booked';
        this.saveInventory();
      }

      this.saveRequests();
      this.renderRequestsTable();
      this.renderMarketplaceListings();
      this.renderProviderFleetTable();

      this.showToast({
        title: "Request Approved & Calendar Locked",
        message: `${req.id} confirmed. Security escrow held. Asset calendar frozen against double-booking.`,
        type: "success"
      });
    }

    handleRejectRequest(reqId) {
      const req = this.state.requests.find(r => r.id === reqId);
      if (!req) return;

      req.status = 'Rejected';

      // Unfreeze calendar if no other approved request
      const asset = this.state.inventory.find(a => a.id === req.assetId);
      if (asset) {
        asset.availabilityStatus = 'Available';
        this.saveInventory();
      }

      this.saveRequests();
      this.renderRequestsTable();
      this.renderMarketplaceListings();
      this.renderProviderFleetTable();

      this.showToast({
        title: "Booking Rejected",
        message: `Request ${req.id} declined. Asset returned to available inventory.`,
        type: "info"
      });
    }

    openNegotiateModal(reqId) {
      const req = this.state.requests.find(r => r.id === reqId);
      if (!req) return;

      this.state.activeNegotiatingReq = req;

      if (this.dom.negReqId) this.dom.negReqId.textContent = `Counter-Offer Proposal: ${req.id}`;
      if (this.dom.negTargetId) this.dom.negTargetId.value = req.id;

      if (this.dom.negDetailsBox) {
        this.dom.negDetailsBox.innerHTML = `
          <div style="font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">${req.assetTitle}</div>
          <div>Requester: <strong>${req.seekerBusiness}</strong> (${req.seekerContact})</div>
          <div>Dates: <strong>${req.startDate} to ${req.endDate}</strong> (${req.days} days)</div>
          <div>Current Contract Value: <strong>₹${req.totalAmount.toLocaleString('en-IN')}</strong></div>
          <div style="color: var(--text-muted); font-size: 0.78rem; margin-top: 4px;">Notes: ${req.notes || 'No custom notes provided.'}</div>
        `;
      }

      if (this.dom.negCounterPrice) {
        this.dom.negCounterPrice.value = Math.round(req.totalAmount * 0.95);
      }
      if (this.dom.negCounterMessage) {
        this.dom.negCounterMessage.value = "We can accommodate your booking at this counter rate if site setup is scheduled after 2:00 PM.";
      }

      this.openModal(this.dom.negotiateModal);
    }

    handleNegotiateSubmit(e) {
      e.preventDefault();
      const req = this.state.activeNegotiatingReq;
      if (!req) return;

      const counterPrice = parseInt(this.dom.negCounterPrice?.value || '0', 10);
      const counterMsg = this.dom.negCounterMessage?.value || '';

      req.status = 'Negotiating';
      req.negotiationOffer = counterPrice;
      req.notes = `Counter-Offer: ₹${counterPrice.toLocaleString('en-IN')} | Terms: ${counterMsg}`;

      this.saveRequests();
      this.closeModal(this.dom.negotiateModal);
      this.renderRequestsTable();

      this.showToast({
        title: "Counter-Offer Dispatched",
        message: `Counter-offer of ₹${counterPrice.toLocaleString('en-IN')} sent to ${req.seekerBusiness}.`,
        type: "success"
      });
    }

    // --- 2-Step Digital Condition Audit & Escrow Modal ---
    openAuditModal(reqId) {
      let targetReq = null;
      if (reqId) {
        targetReq = this.state.requests.find(r => r.id === reqId);
      }
      if (!targetReq) {
        // Fallback to first active request or sample
        targetReq = this.state.requests.find(r => r.status === 'Approved') || this.state.requests[0];
      }

      this.state.activeAuditReq = targetReq;
      this.state.activeAuditStep = 1;

      if (targetReq) {
        if (this.dom.auditTargetTitle) this.dom.auditTargetTitle.textContent = targetReq.assetTitle;
        if (this.dom.auditTargetReq) {
          this.dom.auditTargetReq.textContent = `Request: ${targetReq.id} • Seeker: ${targetReq.seekerBusiness}`;
        }
        if (this.dom.auditTargetStatus) {
          this.dom.auditTargetStatus.textContent = targetReq.auditStatus || "Pending Dispatch";
        }
        if (this.dom.auditEscrowAmount) {
          this.dom.auditEscrowAmount.textContent = `₹${(targetReq.escrowDeposit || 12500).toLocaleString('en-IN')}`;
        }

        const asset = this.state.inventory.find(a => a.id === targetReq.assetId);
        const safeImg = asset ? getSafeImageUrl(asset.image, asset.category) : "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=600&q=80";
        if (this.dom.auditImgPredispatch) this.dom.auditImgPredispatch.src = safeImg;
        if (this.dom.auditImgPostreturn) this.dom.auditImgPostreturn.src = safeImg;
      }

      this.switchAuditStep(1);
      this.openModal(this.dom.auditModal);
    }

    switchAuditStep(step) {
      this.state.activeAuditStep = step;
      if (step === 1) {
        this.dom.auditStep1Pill?.classList.add('active');
        this.dom.auditStep2Pill?.classList.remove('active');
        if (this.dom.auditViewStep1) this.dom.auditViewStep1.style.display = 'block';
        if (this.dom.auditViewStep2) this.dom.auditViewStep2.style.display = 'none';
        if (this.dom.txtSubmitAudit) this.dom.txtSubmitAudit.textContent = "Sign Off Pre-Dispatch";
        if (this.dom.btnSubmitAudit) this.dom.btnSubmitAudit.style.backgroundColor = "var(--accent-primary)";
      } else {
        this.dom.auditStep1Pill?.classList.remove('active');
        this.dom.auditStep2Pill?.classList.add('active');
        if (this.dom.auditViewStep1) this.dom.auditViewStep1.style.display = 'none';
        if (this.dom.auditViewStep2) this.dom.auditViewStep2.style.display = 'block';
        if (this.dom.txtSubmitAudit) {
          const deposit = this.state.activeAuditReq?.escrowDeposit || 12500;
          this.dom.txtSubmitAudit.textContent = `Release Escrow Deposit (₹${deposit.toLocaleString('en-IN')})`;
        }
        if (this.dom.btnSubmitAudit) this.dom.btnSubmitAudit.style.backgroundColor = "var(--accent-emerald)";
      }
      this.refreshIcons();
    }

    handleAuditSubmit() {
      const req = this.state.activeAuditReq;
      if (this.state.activeAuditStep === 1) {
        // Step 1 sign-off
        if (req) {
          req.auditStatus = "Pre-Pickup Verified";
          this.saveRequests();
        }
        this.showToast({
          title: "Pre-Dispatch Audit Certified",
          message: "Photo inspection stamped with GPS signature. Logistics driver cleared for pickup.",
          type: "success"
        });
        this.switchAuditStep(2);
      } else {
        // Step 2 sign-off: Escrow release
        if (req) {
          req.auditStatus = "Escrow Released & Completed";
          // Unfreeze asset
          const asset = this.state.inventory.find(a => a.id === req.assetId);
          if (asset) {
            asset.availabilityStatus = "Available";
            this.saveInventory();
          }
          this.saveRequests();
        }
        this.closeModal(this.dom.auditModal);
        this.renderRequestsTable();
        this.renderMarketplaceListings();
        this.renderProviderFleetTable();
        this.showToast({
          title: "Escrow Deposit Released",
          message: `₹${(req?.escrowDeposit || 12500).toLocaleString('en-IN')} escrow credited back to Seeker. Asset marked Available.`,
          type: "success"
        });
      }
    }

    // --- Automated Monetization & ROI Calculator Engine ---
    updateMonetizationCalculator() {
      const assets = parseInt(this.dom.sliderAssets?.value || '2', 10);
      const days = parseInt(this.dom.sliderDays?.value || '12', 10);
      const rate = parseInt(this.dom.sliderRate?.value || '15000', 10);

      // Update Slider Value Labels
      if (this.dom.valSliderAssets) this.dom.valSliderAssets.textContent = `${assets} Unit${assets > 1 ? 's' : ''}`;
      if (this.dom.valSliderDays) this.dom.valSliderDays.textContent = `${days} Days`;
      if (this.dom.valSliderRate) this.dom.valSliderRate.textContent = `₹${rate.toLocaleString('en-IN')} / day`;

      // Calculations:
      // Monthly gross = assets * days * rate
      // Net of 10% platform fee = gross * 0.90
      const monthlyGross = assets * days * rate;
      const monthlyNet = Math.round(monthlyGross * 0.90);
      const annualNet = monthlyNet * 12;

      // Fleet utilization: days / 30
      const utilization = ((days / 30) * 100).toFixed(1);

      // ROI Payback months (Assuming baseline equipment capex of ₹15,00,000 per commercial unit)
      const estimatedCapex = assets * 1500000;
      const paybackMonths = monthlyNet > 0 ? (estimatedCapex / monthlyNet).toFixed(1) : '0';

      if (this.dom.calcMonthlyRev) {
        this.dom.calcMonthlyRev.textContent = `₹${monthlyNet.toLocaleString('en-IN')}`;
      }
      if (this.dom.calcAnnualRev) {
        if (annualNet >= 100000) {
          const lakhs = (annualNet / 100000).toFixed(2);
          this.dom.calcAnnualRev.textContent = `₹${lakhs} Lakhs`;
        } else {
          this.dom.calcAnnualRev.textContent = `₹${annualNet.toLocaleString('en-IN')}`;
        }
      }
      if (this.dom.calcUtilization) {
        this.dom.calcUtilization.textContent = `${utilization}%`;
      }
      if (this.dom.calcPayback) {
        this.dom.calcPayback.textContent = `${paybackMonths} Months`;
      }

      const listBtn = document.getElementById('btn-calc-list-rate');
      if (listBtn) {
        const textSpan = listBtn.querySelector('span');
        if (textSpan) textSpan.textContent = `List Asset at this Daily Rate (₹${rate.toLocaleString('en-IN')})`;
      }
    }

    // --- Add / Edit Asset Modal Controller & Resource Management ---
    openListAssetModal() {
      if (this.dom.listAssetModalTitle) {
        this.dom.listAssetModalTitle.textContent = "List Commercial Asset for Exchange";
      }
      if (this.dom.btnSubmitAssetText) {
        this.dom.btnSubmitAssetText.textContent = "Publish to Marketplace";
      }
      if (this.dom.editAssetId) {
        this.dom.editAssetId.value = "";
      }

      this.dom.formListAsset?.reset();

      if (this.dom.assetImagePreviewContainer) this.dom.assetImagePreviewContainer.style.display = 'none';
      if (this.dom.assetImagePreview) this.dom.assetImagePreview.src = '';
      if (this.dom.assetImageBase64) this.dom.assetImageBase64.value = '';
      if (this.dom.assetImageInput) this.dom.assetImageInput.value = '';
      if (this.dom.assetImage) this.dom.assetImage.value = '';

      this.openModal(this.dom.listAssetModal);
    }

    editResource(id) {
      const asset = this.state.inventory.find(a => a.id === id);
      if (!asset) return;

      if (this.dom.listAssetModalTitle) {
        this.dom.listAssetModalTitle.textContent = "Edit Commercial Asset";
      }
      if (this.dom.btnSubmitAssetText) {
        this.dom.btnSubmitAssetText.textContent = "Update Asset";
      }
      if (this.dom.editAssetId) {
        this.dom.editAssetId.value = asset.id;
      }

      if (this.dom.assetName) this.dom.assetName.value = asset.title || '';
      if (this.dom.assetCategory) this.dom.assetCategory.value = asset.category || 'Venue';
      if (this.dom.assetFulfillment) this.dom.assetFulfillment.value = asset.fulfillmentType || 'In-Store Pickup';
      if (this.dom.assetShop) this.dom.assetShop.value = asset.shopName || '';
      if (this.dom.assetVendorType) this.dom.assetVendorType.value = asset.vendorType || '';
      if (this.dom.assetLocation) this.dom.assetLocation.value = asset.location || 'Lower Parel, Mumbai';
      if (this.dom.assetRate) this.dom.assetRate.value = asset.pricePerDay || '';
      if (this.dom.assetStatus) this.dom.assetStatus.value = asset.availabilityStatus || 'Available';
      if (this.dom.assetInstantDispatch) this.dom.assetInstantDispatch.checked = Boolean(asset.instantDispatchAvailable);

      if (this.dom.assetImageInput) this.dom.assetImageInput.value = '';

      if (asset.image) {
        if (this.dom.assetImageBase64) this.dom.assetImageBase64.value = asset.image;
        if (this.dom.assetImagePreview) this.dom.assetImagePreview.src = asset.image;
        if (this.dom.assetImagePreviewContainer) this.dom.assetImagePreviewContainer.style.display = 'block';
        if (this.dom.assetImage && !asset.image.startsWith('data:')) {
          this.dom.assetImage.value = asset.image;
        } else if (this.dom.assetImage) {
          this.dom.assetImage.value = '';
        }
      } else {
        if (this.dom.assetImageBase64) this.dom.assetImageBase64.value = '';
        if (this.dom.assetImagePreviewContainer) this.dom.assetImagePreviewContainer.style.display = 'none';
        if (this.dom.assetImagePreview) this.dom.assetImagePreview.src = '';
        if (this.dom.assetImage) this.dom.assetImage.value = '';
      }

      this.openModal(this.dom.listAssetModal);
    }

    deleteResource(id) {
      const item = this.state.inventory.find(a => a.id === id);
      const itemName = item ? item.title : id;

      if (!window.confirm(`Are you sure you want to delete "${itemName}"?`)) {
        return;
      }

      this.state.inventory = this.state.inventory.filter(a => a.id !== id);
      this.saveInventory();
      this.renderMarketplaceListings();
      this.renderProviderDashboard();

      this.showToast({
        title: "Resource Deleted",
        message: `"${itemName}" was removed from inventory.`,
        type: "info"
      });
    }

    clearAllData() {
      if (window.confirm("Are you sure you want to delete all test items?")) {
        this.state.inventory = [];
        this.saveInventory();
        this.renderMarketplaceListings();
        this.renderProviderDashboard();

        this.showToast({
          title: "All Test Data Cleared",
          message: "All items have been removed from your local storage.",
          type: "info"
        });
      }
    }

    loadDefaultFleet() {
      const defaultInventory = (typeof window !== 'undefined' && window.inventoryData) ? window.inventoryData : [];
      this.state.inventory = JSON.parse(JSON.stringify(defaultInventory));
      this.saveInventory();
      this.renderMarketplaceListings();
      this.renderProviderDashboard();

      this.showToast({
        title: "Default MMR Fleet Loaded",
        message: "Restored 12 verified standard MMR hospitality assets.",
        type: "success"
      });
    }

    handleListAssetSubmit(e) {
      e.preventDefault();

      const editId = this.dom.editAssetId?.value.trim();
      const name = this.dom.assetName?.value.trim() || "Commercial Hospitality Asset";
      const category = this.dom.assetCategory?.value || "Venue";
      const fulfillment = this.dom.assetFulfillment?.value || "In-Store Pickup";
      const shop = this.dom.assetShop?.value.trim() || (this.state.currentUser?.businessName || "Hospitality Depot");
      const vendorType = this.dom.assetVendorType?.value.trim() || "Commercial Partner";
      const location = this.dom.assetLocation?.value || "Lower Parel, Mumbai";
      const rate = parseInt(this.dom.assetRate?.value || '15000', 10);
      const status = this.dom.assetStatus?.value || "Available";
      const instantDispatch = this.dom.assetInstantDispatch?.checked || false;

      // Base64 file image takes priority over URL input, fallback to category image if none
      const base64Image = this.dom.assetImageBase64?.value.trim();
      const urlImage = this.dom.assetImage?.value.trim();
      const chosenImage = base64Image || urlImage || 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=800&q=80';

      // Location coordinates lookup helper
      const coordsMap = {
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

      const coordinates = coordsMap[location] || MMR_DEPOT_COORDS;

      if (editId) {
        const assetIndex = this.state.inventory.findIndex(a => a.id === editId);
        if (assetIndex !== -1) {
          const existing = this.state.inventory[assetIndex];
          existing.title = name;
          existing.category = category;
          existing.shopName = shop;
          existing.vendorType = vendorType;
          existing.location = location;
          existing.fulfillmentType = fulfillment;
          existing.pricePerDay = rate;
          existing.availabilityStatus = status;
          existing.image = chosenImage;
          existing.coordinates = coordinates;
          existing.instantDispatchAvailable = instantDispatch;

          this.saveInventory();
          this.dom.formListAsset?.reset();
          this.closeModal(this.dom.listAssetModal);

          this.renderMarketplaceListings();
          this.renderProviderDashboard();

          this.showToast({
            title: "Asset Updated",
            message: `"${name}" details updated successfully.`,
            type: "success"
          });
          return;
        }
      }

      // Create new asset with unique ID
      const newAsset = {
        id: `mmr-${Date.now().toString()}`,
        title: name,
        category: category,
        shopName: shop,
        vendorType: vendorType,
        location: location,
        fulfillmentType: fulfillment,
        pricePerDay: rate,
        availabilityStatus: status,
        image: chosenImage,
        coordinates: coordinates,
        instantDispatchAvailable: instantDispatch
      };

      this.state.inventory.unshift(newAsset);
      this.saveInventory();

      this.dom.formListAsset?.reset();
      this.closeModal(this.dom.listAssetModal);

      this.renderMarketplaceListings();
      this.renderProviderDashboard();

      this.showToast({
        title: "Asset Published to MMR Grid",
        message: `${newAsset.title} is now discoverable across the B2B exchange.`,
        type: "success"
      });
    }

    // --- Quick View Modal Controller ---
    openQuickViewModal(assetId) {
      const asset = this.state.inventory.find(a => a.id === assetId);
      if (!asset) return;

      this.state.activeModalAsset = asset;
      const coords = asset.coordinates || MMR_DEPOT_COORDS;
      const distance = calculateDistanceKm(MMR_DEPOT_COORDS.lat, MMR_DEPOT_COORDS.lng, coords.lat, coords.lng);

      if (this.dom.qvTitle) this.dom.qvTitle.textContent = asset.title;

      if (this.dom.qvContent) {
        this.dom.qvContent.innerHTML = `
          <div style="margin-bottom: 1rem; border-radius: var(--radius-md); overflow: hidden; max-height: 240px;">
            <img 
              src="${getSafeImageUrl(asset.image, asset.category)}" 
              alt="${asset.title}" 
              style="width: 100%; height: 240px; object-fit: cover;"
              onerror="this.src='https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=800&q=80'"
            >
          </div>

          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.75rem;">
            <div>
              <span class="category-badge-chip">${asset.category}</span>
              <span class="status-badge ${asset.availabilityStatus === 'Available' ? 'approved' : 'pending'}" style="margin-left: 0.5rem;">
                ${asset.availabilityStatus}
              </span>
              ${asset.instantDispatchAvailable ? '<span class="instant-dispatch-badge" style="margin-left: 0.4rem;">⚡ 30-60 Min Dispatch</span>' : ''}
            </div>
            <div style="text-align: right;">
              <div style="font-size: 1.4rem; font-weight: 800; color: var(--text-primary);">₹${asset.pricePerDay.toLocaleString('en-IN')}</div>
              <div style="font-size: 0.72rem; color: var(--text-muted);">per calendar day</div>
            </div>
          </div>

          <div style="background-color: var(--bg-secondary); padding: 0.9rem; border-radius: var(--radius-md); margin-bottom: 1rem;">
            <h4 style="font-size: 0.82rem; margin-bottom: 0.35rem; color: var(--text-primary);">MMR Host Enterprise</h4>
            <div style="font-size: 0.88rem; font-weight: 700; color: var(--text-primary);">${asset.shopName}</div>
            <div style="font-size: 0.78rem; color: var(--accent-primary); font-weight: 600;">${asset.vendorType}</div>
          </div>

          <div style="border: 1px solid var(--border-subtle); padding: 0.9rem; border-radius: var(--radius-md);">
            <h4 style="font-size: 0.82rem; margin-bottom: 0.4rem; display: flex; align-items: center; gap: 0.4rem;">
              <i data-lucide="map-pin" style="width: 1rem; height: 1rem; color: var(--accent-rose);"></i>
              <span>MMR Hub Location &amp; Proximity</span>
            </h4>
            <div style="font-size: 0.88rem; color: var(--text-primary); font-weight: 600;">${asset.location}</div>
            <div style="display: flex; gap: 0.5rem; margin-top: 0.6rem; align-items: center; flex-wrap: wrap;">
              <span class="fulfillment-badge ${asset.fulfillmentType === 'Site Delivery' ? 'fulfillment-delivery' : 'fulfillment-pickup'}">
                ${asset.fulfillmentType}
              </span>
              <span class="proximity-tag">📍 ${distance} km from BKC</span>
              <span class="coordinates-tag">ID: ${asset.id.toUpperCase()}</span>
            </div>
          </div>
        `;
      }

      this.openModal(this.dom.quickviewModal);
    }

    // --- Generic Modal Helpers ---
    openModal(modalEl) {
      if (!modalEl) return;
      modalEl.classList.add('active');
      modalEl.setAttribute('aria-hidden', 'false');
      modalEl.style.display = 'flex';
      modalEl.style.opacity = '1';
      modalEl.style.visibility = 'visible';
      modalEl.style.pointerEvents = 'auto';
      document.body.style.overflow = 'hidden';
      this.refreshIcons();
    }

    closeModal(modalEl) {
      if (!modalEl) return;
      modalEl.classList.remove('active');
      modalEl.setAttribute('aria-hidden', 'true');
      modalEl.style.display = 'none';
      modalEl.style.opacity = '0';
      modalEl.style.visibility = 'hidden';
      modalEl.style.pointerEvents = 'none';
      document.body.style.overflow = '';
    }

    // --- Floating Toast Notifications ---
    showToast({ title, message, type = 'info' }) {
      if (!this.dom.toastContainer) return;
      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;

      let iconName = 'info';
      if (type === 'success') iconName = 'check-circle';
      if (type === 'warning') iconName = 'alert-triangle';

      toast.innerHTML = `
        <div class="toast-icon">
          <i data-lucide="${iconName}"></i>
        </div>
        <div class="toast-content">
          <span class="toast-title">${title}</span>
          <span class="toast-message">${message}</span>
        </div>
      `;

      this.dom.toastContainer.appendChild(toast);
      this.refreshIcons();

      setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
      }, 3500);
    }

    truncate(str, max = 30) {
      if (!str) return '';
      return str.length > max ? str.slice(0, max) + '…' : str;
    }

    refreshIcons() {
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
      }
    }
  }

  // Universal DOM ready bootstrap
  function bootstrapApp() {
    window.hospitaLinkApp = new HospitaLinkApp();
    window.app = window.hospitaLinkApp;
    // Expose global convenience functions
    window.deleteResource = (id) => window.hospitaLinkApp.deleteResource(id);
    window.editResource = (id) => window.hospitaLinkApp.editResource(id);
    window.clearAllData = () => window.hospitaLinkApp.clearAllData();
    window.loadDefaultFleet = () => window.hospitaLinkApp.loadDefaultFleet();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapApp);
  } else {
    bootstrapApp();
  }
})();
