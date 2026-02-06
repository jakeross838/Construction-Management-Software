async function test() {
  const BASE = 'http://localhost:3001';
  const results = [];
  
  // Test 1: Get vendors list
  try {
    const res = await fetch(BASE + '/api/vendors');
    const data = await res.json();
    results.push({ test: 'GET /api/vendors', status: res.status, count: data.length, pass: res.ok });
  } catch (e) {
    results.push({ test: 'GET /api/vendors', error: e.message, pass: false });
  }
  
  // Test 2: Get duplicates
  try {
    const res = await fetch(BASE + '/api/vendors/duplicates');
    const data = await res.json();
    results.push({ test: 'GET /api/vendors/duplicates', status: res.status, count: data.length, pass: res.ok });
  } catch (e) {
    results.push({ test: 'GET /api/vendors/duplicates', error: e.message, pass: false });
  }
  
  // Test 3: Get expiring
  try {
    const res = await fetch(BASE + '/api/vendors/expiring');
    const data = await res.json();
    results.push({ test: 'GET /api/vendors/expiring', status: res.status, count: data.length, pass: res.ok });
  } catch (e) {
    results.push({ test: 'GET /api/vendors/expiring', error: e.message, pass: false });
  }
  
  // Test 4: Get first vendor details
  try {
    const listRes = await fetch(BASE + '/api/vendors');
    const vendors = await listRes.json();
    if (vendors.length > 0) {
      const res = await fetch(BASE + '/api/vendors/' + vendors[0].id + '/details');
      const data = await res.json();
      results.push({ 
        test: 'GET /api/vendors/:id/details', 
        status: res.status, 
        vendor: data.name,
        hasStats: data.stats ? true : false,
        pass: res.ok 
      });
    }
  } catch (e) {
    results.push({ test: 'GET /api/vendors/:id/details', error: e.message, pass: false });
  }
  
  console.log(JSON.stringify(results, null, 2));
}

test();
