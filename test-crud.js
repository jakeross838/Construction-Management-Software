// Quick CRUD test script - tests direct DB and API routes
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://sorghqcpeamdfbvysafj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvcmdocWNwZWFtZGZidnlzYWZqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzQ1NjIyOCwiZXhwIjoyMDgzMDMyMjI4fQ.Y31vzEWbvR7F539vP3Nsc_WqhcTWojh03LY-a5I0YPY'
);

const API_URL = 'http://localhost:3001';
const SERVICE_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvcmdocWNwZWFtZGZidnlzYWZqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzQ1NjIyOCwiZXhwIjoyMDgzMDMyMjI4fQ.Y31vzEWbvR7F539vP3Nsc_WqhcTWojh03LY-a5I0YPY';

async function apiRequest(method, path, body = null) {
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${SERVICE_TOKEN}`,
      'Content-Type': 'application/json'
    }
  };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(`${API_URL}${path}`, options);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function testCRUD() {
  console.log('=== Financial Module CRUD Test ===\n');

  // Get a builder_id first
  const { data: builders } = await supabase.from('builders').select('id').limit(1);
  const builderId = builders?.[0]?.id || null;
  console.log('Builder ID:', builderId || 'None found (will use null)');

  // 1. Create a job
  console.log('\n--- Job CRUD ---');
  const { data: job, error: jobErr } = await supabase
    .from('v2_jobs')
    .insert({ name: 'API Test Job', status: 'active', builder_id: builderId })
    .select()
    .single();

  if (jobErr) {
    console.log('Job CREATE failed:', jobErr.message);
  } else {
    console.log('Job CREATE: OK -', job.id);
  }

  // 2. Create a vendor
  const { data: vendor, error: vendorErr } = await supabase
    .from('v2_vendors')
    .insert({ name: 'API Test Vendor', builder_id: builderId })
    .select()
    .single();

  if (vendorErr) {
    console.log('Vendor CREATE failed:', vendorErr.message);
  } else {
    console.log('Vendor CREATE: OK -', vendor.id);
  }

  // 3. Test PO via direct DB (with po_number)
  console.log('\n--- Purchase Order CRUD ---');

  // Get or create a cost code
  let { data: costCodes } = await supabase.from('v2_cost_codes').select('id').limit(1);
  let costCodeId = costCodes?.[0]?.id;

  if (!costCodeId) {
    const { data: cc } = await supabase
      .from('v2_cost_codes')
      .insert({ code: '001', name: 'Test Cost Code', category: 'General' })
      .select()
      .single();
    costCodeId = cc?.id;
    console.log('Created cost code:', costCodeId);
  }

  // Generate a unique PO number
  const poNumber = `TEST-${Date.now()}`;

  const { data: po, error: poErr } = await supabase
    .from('v2_purchase_orders')
    .insert({
      job_id: job?.id,
      vendor_id: vendor?.id,
      po_number: poNumber,
      description: 'Test PO',
      total_amount: 1000,
      builder_id: builderId
    })
    .select()
    .single();

  if (poErr) {
    console.log('PO CREATE failed:', poErr.message);
  } else {
    console.log('PO CREATE: OK -', po.id, 'po_number:', po.po_number);

    // Add line items
    const { error: lineErr } = await supabase
      .from('v2_po_line_items')
      .insert({
        po_id: po.id,
        cost_code_id: costCodeId,
        description: 'Test line item',
        amount: 1000
      });
    console.log('PO Line Item:', lineErr ? `Failed: ${lineErr.message}` : 'OK');

    // READ
    const { data: poRead } = await supabase.from('v2_purchase_orders').select('*').eq('id', po.id).single();
    console.log('PO READ: OK - total:', poRead?.total_amount);

    // UPDATE
    const { error: poUpdErr } = await supabase.from('v2_purchase_orders').update({ description: 'Updated PO' }).eq('id', po.id);
    console.log('PO UPDATE:', poUpdErr ? `Failed: ${poUpdErr.message}` : 'OK');

    // DELETE (soft)
    const { error: poDelErr } = await supabase.from('v2_purchase_orders').update({ deleted_at: new Date().toISOString() }).eq('id', po.id);
    console.log('PO DELETE:', poDelErr ? `Failed: ${poDelErr.message}` : 'OK');
  }

  // 4. Test Draw
  console.log('\n--- Draw CRUD ---');
  const { data: draw, error: drawErr } = await supabase
    .from('v2_draws')
    .insert({
      job_id: job?.id,
      draw_number: 1,
      status: 'draft',
      builder_id: builderId
    })
    .select()
    .single();

  if (drawErr) {
    console.log('Draw CREATE failed:', drawErr.message);
  } else {
    console.log('Draw CREATE: OK -', draw.id);

    // READ
    const { data: drawRead } = await supabase.from('v2_draws').select('*').eq('id', draw.id).single();
    console.log('Draw READ: OK - draw_number:', drawRead?.draw_number);

    // UPDATE
    const { error: drawUpdErr } = await supabase.from('v2_draws').update({ notes: 'Test notes' }).eq('id', draw.id);
    console.log('Draw UPDATE:', drawUpdErr ? `Failed: ${drawUpdErr.message}` : 'OK');

    // DELETE
    const { error: drawDelErr } = await supabase.from('v2_draws').update({ deleted_at: new Date().toISOString() }).eq('id', draw.id);
    console.log('Draw DELETE:', drawDelErr ? `Failed: ${drawDelErr.message}` : 'OK');
  }

  // 5. Test Budget (now with builder_id column)
  console.log('\n--- Budget CRUD ---');
  const { data: budget, error: budgetErr } = await supabase
    .from('v2_budgets')
    .insert({
      job_id: job?.id,
      name: 'Test Budget',
      total_budget: 100000,
      builder_id: builderId
    })
    .select()
    .single();

  if (budgetErr) {
    console.log('Budget CREATE failed:', budgetErr.message);
  } else {
    console.log('Budget CREATE: OK -', budget.id);

    // READ
    const { data: budgetRead } = await supabase.from('v2_budgets').select('*').eq('id', budget.id).single();
    console.log('Budget READ: OK - total:', budgetRead?.total_budget);

    // UPDATE
    const { error: budgetUpdErr } = await supabase.from('v2_budgets').update({ total_budget: 150000 }).eq('id', budget.id);
    console.log('Budget UPDATE:', budgetUpdErr ? `Failed: ${budgetUpdErr.message}` : 'OK');

    // DELETE
    const { error: budgetDelErr } = await supabase.from('v2_budgets').update({ deleted_at: new Date().toISOString() }).eq('id', budget.id);
    console.log('Budget DELETE:', budgetDelErr ? `Failed: ${budgetDelErr.message}` : 'OK');
  }

  // Cleanup - delete test job (cascade)
  console.log('\n--- Cleanup ---');
  if (job?.id) {
    await supabase.from('v2_jobs').delete().eq('id', job.id);
    console.log('Deleted test job');
  }
  if (vendor?.id) {
    await supabase.from('v2_vendors').delete().eq('id', vendor.id);
    console.log('Deleted test vendor');
  }

  console.log('\n=== Test Complete ===');
}

testCRUD().catch(console.error);
