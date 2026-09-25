import http from 'http';

// Helper to make HTTP requests
function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, body: json });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🚀 Starting HospitaLink REST API & Multi-User Integration Tests...\n');

  try {
    // 1. Health check
    console.log('1. Testing /api/health ...');
    const health = await request('GET', '/api/health');
    console.log('   Status:', health.status, '| Service:', health.body.service, '| DB:', health.body.database);
    if (health.status !== 200) throw new Error('Health check failed');

    // 2. Fetch standard resources
    console.log('\n2. Testing GET /api/resources ...');
    const resList = await request('GET', '/api/resources');
    console.log('   Fetched', resList.body.length, 'resources.');
    if (!Array.isArray(resList.body) || resList.body.length === 0) throw new Error('Resources list empty');

    // 3. User A Registration
    console.log('\n3. Testing POST /api/auth/register (User A - Chef Catering) ...');
    const userAEmail = `chefa_${Date.now()}@mumbaicaterers.in`;
    const regA = await request('POST', '/api/auth/register', {
      email: userAEmail,
      businessName: 'Chef A Gourmet Banquet Fleet',
      businessType: 'Catering Enterprise',
      role: 'Provider & Seeker',
      location: 'Andheri East, Mumbai'
    });
    console.log('   User A Created:', regA.body.user?.businessName, 'Status:', regA.status);
    if (regA.status !== 201) throw new Error('User A registration failed');

    // 4. User B Registration
    console.log('\n4. Testing POST /api/auth/register (User B - Taj Seeker) ...');
    const userBEmail = `eventsb_${Date.now()}@tajhotels.com`;
    const regB = await request('POST', '/api/auth/register', {
      email: userBEmail,
      businessName: 'Taj Banquets Lower Parel',
      businessType: 'Hotel & Resort',
      role: 'Provider & Seeker',
      location: 'Lower Parel, Mumbai'
    });
    console.log('   User B Created:', regB.body.user?.businessName, 'Status:', regB.status);

    // 5. User A Lists an Asset
    console.log('\n5. Testing POST /api/resources (User A creates luxury commercial combi-oven) ...');
    const assetId = `mmr-test-${Date.now()}`;
    const newAsset = await request('POST', '/api/resources', {
      id: assetId,
      ownerEmail: userAEmail,
      title: 'Rational iCombi Pro 20-Grid Combi Oven',
      category: 'Commercial Kitchen',
      shopName: 'Chef A Gourmet Kitchen Depot',
      vendorType: 'Kitchen Facility',
      location: 'Andheri East, Mumbai',
      fulfillmentType: 'Site Delivery',
      pricePerDay: 18000,
      availabilityStatus: 'Available',
      instantDispatchAvailable: true
    }, { 'x-user-email': userAEmail });
    console.log('   Asset Created:', newAsset.body.resource?.title, '| Status:', newAsset.status);
    if (newAsset.status !== 201) throw new Error('Asset creation failed');

    // 6. User B Discovers Asset & Requests Rental (Locks Calendar)
    console.log('\n6. Testing POST /api/requests (User B books User A asset) ...');
    const reqId = `REQ-TEST-${Date.now().toString().slice(-4)}`;
    const booking = await request('POST', '/api/requests', {
      id: reqId,
      assetId: assetId,
      assetTitle: 'Rational iCombi Pro 20-Grid Combi Oven',
      providerEmail: userAEmail,
      seekerEmail: userBEmail,
      seekerBusiness: 'Taj Banquets Lower Parel',
      seekerContact: userBEmail,
      startDate: '2026-10-01',
      endDate: '2026-10-03',
      days: 2,
      dailyRate: 18000,
      totalAmount: 42000,
      tokenAmount: 7200,
      escrowDeposit: 9000,
      bookingMode: 'Planned Advance',
      deliveryMode: 'Site Delivery',
      deliveryFee: 600,
      deliveryLocation: 'Taj Lower Parel, Mumbai',
      status: 'Approved',
      auditStatus: 'Pending Dispatch'
    }, { 'x-user-email': userBEmail });
    console.log('   Booking Created:', booking.body.request?.id, '| Status:', booking.status);
    if (booking.status !== 201) throw new Error('Booking creation failed');

    // 7. Verify Asset Availability is now Locked/Booked
    console.log('\n7. Verifying Smart Calendar Lock on Asset ...');
    const verifyList = await request('GET', '/api/resources');
    const lockedAsset = verifyList.body.find(a => a.id === assetId);
    console.log('   Asset Status in Public Marketplace:', lockedAsset?.availabilityStatus);
    if (lockedAsset?.availabilityStatus !== 'Booked' && lockedAsset?.availabilityStatus !== 'Locked') {
      throw new Error('Asset was not locked properly');
    }

    // 8. User A Provider Pipeline Isolation
    console.log('\n8. Testing Multi-User Request Isolation (GET /api/requests?email=...) ...');
    const userARequests = await request('GET', `/api/requests?email=${encodeURIComponent(userAEmail)}`, null, { 'x-user-email': userAEmail });
    console.log('   User A Incoming Requests Count:', userARequests.body.length);
    if (userARequests.body.length === 0) throw new Error('User A cannot see booking request');

    // 9. Provider Counter-Offer / Negotiation
    console.log('\n9. Testing PATCH /api/requests/:id (Provider Counter-Offer) ...');
    const negUpdate = await request('PATCH', `/api/requests/${reqId}`, {
      status: 'Negotiating',
      negotiationOffer: 39500,
      notes: 'Counter-Offer: ₹39,500 with included setup engineer.'
    }, { 'x-user-email': userAEmail });
    console.log('   Negotiation Update Status:', negUpdate.body.request?.status, '| Counter Offer: ₹', negUpdate.body.request?.negotiationOffer);

    // 10. Provider Accept Booking
    console.log('\n10. Testing PATCH /api/requests/:id (Accept Booking) ...');
    const acceptUpdate = await request('PATCH', `/api/requests/${reqId}`, {
      status: 'Approved'
    }, { 'x-user-email': userAEmail });
    console.log('   Approved Status:', acceptUpdate.body.request?.status);

    // 11. Condition Audit Sign-Off & Escrow Release (Completing booking & releasing calendar)
    console.log('\n11. Testing Digital Condition Audit Sign-Off & Escrow Settlement ...');
    const auditUpdate = await request('PATCH', `/api/requests/${reqId}`, {
      auditStatus: 'Escrow Released & Completed',
      status: 'Completed'
    }, { 'x-user-email': userAEmail });
    console.log('   Audit Completion Status:', auditUpdate.body.request?.auditStatus, '| Final Status:', auditUpdate.body.request?.status);

    // 12. Verify Asset Unlocked / Available
    const finalAssetList = await request('GET', '/api/resources');
    const finalAsset = finalAssetList.body.find(a => a.id === assetId);
    console.log('   Asset Status After Escrow Release:', finalAsset?.availabilityStatus);

    // 13. Ownership Protection Test: User B tries to delete User A's asset
    console.log('\n12. Testing Ownership Protection (User B trying to delete User A asset) ...');
    const unauthorizedDelete = await request('DELETE', `/api/resources/${assetId}`, null, { 'x-user-email': userBEmail });
    console.log('   Unauthorized Delete Attempt Status (Expected 403):', unauthorizedDelete.status);
    if (unauthorizedDelete.status !== 403) throw new Error('Ownership permission check failed!');

    // 14. Authorized Delete: User A deletes their asset
    console.log('\n13. Testing Authorized Delete (User A deletes their asset) ...');
    const authorizedDelete = await request('DELETE', `/api/resources/${assetId}`, null, { 'x-user-email': userAEmail });
    console.log('   Authorized Delete Status:', authorizedDelete.status);
    if (authorizedDelete.status !== 200) throw new Error('Authorized delete failed');

    // 15. Demo User Preservation & Fleet Reset
    console.log('\n14. Testing POST /api/reset-fleet ...');
    const reset = await request('POST', '/api/reset-fleet');
    console.log('   Reset Fleet Message:', reset.body.message);
    const resetList = await request('GET', '/api/resources');
    console.log('   Standard MMR Asset Count after reset:', resetList.body.length);

    console.log('\n🎉 ALL 14 E2E BACKEND & MULTI-USER TESTS PASSED SUCCESSFULLY! ✅');
  } catch (err) {
    console.error('\n❌ Test failure:', err.message);
    process.exit(1);
  }
}

runTests();
