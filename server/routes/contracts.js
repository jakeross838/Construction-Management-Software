/**
 * Contracts Routes
 * Manage contracts, proposals, subcontracts, and amendments
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { asyncHandler, AppError } = require('../core/errors');

// ============================================================
// STATS
// ============================================================

router.get('/stats', asyncHandler(async (req, res) => {
  const { job_id } = req.query;

  let query = supabase
    .from('v2_contracts')
    .select('id, contract_type, status, signature_status, expiration_date')
    .is('deleted_at', null);

  if (job_id) query = query.eq('job_id', job_id);

  const { data: contracts } = await query;

  const today = new Date().toISOString().split('T')[0];
  const thirtyDays = new Date();
  thirtyDays.setDate(thirtyDays.getDate() + 30);
  const thirtyDaysStr = thirtyDays.toISOString().split('T')[0];

  const stats = {
    total: contracts?.length || 0,
    by_type: {},
    by_status: {},
    by_signature: {},
    pending_signature: 0,
    expiring_soon: 0
  };

  for (const contract of (contracts || [])) {
    stats.by_type[contract.contract_type] = (stats.by_type[contract.contract_type] || 0) + 1;
    stats.by_status[contract.status] = (stats.by_status[contract.status] || 0) + 1;
    stats.by_signature[contract.signature_status] = (stats.by_signature[contract.signature_status] || 0) + 1;

    if (['pending_internal', 'sent', 'pending_signature', 'partially_signed'].includes(contract.signature_status)) {
      stats.pending_signature++;
    }

    if (contract.expiration_date && contract.expiration_date <= thirtyDaysStr && contract.expiration_date >= today && contract.status === 'active') {
      stats.expiring_soon++;
    }
  }

  res.json(stats);
}));

// ============================================================
// CRUD OPERATIONS
// ============================================================

// Get all contracts with filters
router.get('/', asyncHandler(async (req, res) => {
  const { job_id, company_id, vendor_id, type, status, signature_status, search, expiring_soon } = req.query;

  let query = supabase
    .from('v2_contracts')
    .select(`
      *,
      job:v2_jobs!job_id(id, name),
      company:v2_companies!company_id(id, name),
      vendor:v2_vendors!vendor_id(id, name),
      contact:v2_contacts!contact_id(id, first_name, last_name)
    `)
    .is('deleted_at', null);

  if (job_id) query = query.eq('job_id', job_id);
  if (company_id) query = query.eq('company_id', company_id);
  if (vendor_id) query = query.eq('vendor_id', vendor_id);
  if (type) query = query.eq('contract_type', type);
  if (status) query = query.eq('status', status);
  if (signature_status) query = query.eq('signature_status', signature_status);

  if (search) {
    query = query.or(`name.ilike.%${search}%,contract_number.ilike.%${search}%,description.ilike.%${search}%`);
  }

  if (expiring_soon === 'true') {
    const thirtyDays = new Date();
    thirtyDays.setDate(thirtyDays.getDate() + 30);
    query = query.eq('status', 'active').lte('expiration_date', thirtyDays.toISOString().split('T')[0]);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json({ contracts: data });
}));

// Get single contract with details
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data: contract, error } = await supabase
    .from('v2_contracts')
    .select(`
      *,
      job:v2_jobs!job_id(id, name),
      company:v2_companies!company_id(id, name),
      vendor:v2_vendors!vendor_id(id, name),
      contact:v2_contacts!contact_id(id, first_name, last_name, email, phone),
      parent:v2_contracts!parent_contract_id(id, contract_number, name)
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error || !contract) {
    throw new AppError('NOT_FOUND', 'Contract not found');
  }

  // Get signers
  const { data: signers } = await supabase
    .from('v2_contract_signers')
    .select('*')
    .eq('contract_id', id)
    .order('sign_order');

  // Get activity
  const { data: activity } = await supabase
    .from('v2_contract_activity')
    .select('*')
    .eq('contract_id', id)
    .order('created_at', { ascending: false })
    .limit(20);

  // Get amendments/children
  const { data: amendments } = await supabase
    .from('v2_contracts')
    .select('id, contract_number, name, contract_type, contract_amount, status')
    .eq('parent_contract_id', id)
    .is('deleted_at', null)
    .order('created_at');

  res.json({
    contract: {
      ...contract,
      signers: signers || [],
      activity: activity || [],
      amendments: amendments || []
    }
  });
}));

// Create contract
router.post('/', asyncHandler(async (req, res) => {
  const {
    name,
    description,
    contract_type,
    category,
    job_id,
    company_id,
    vendor_id,
    contact_id,
    parent_contract_id,
    contract_amount,
    retainage_percent,
    payment_terms,
    start_date,
    end_date,
    expiration_date,
    scope_of_work,
    insurance_requirements,
    bond_requirements,
    warranty_terms,
    notice_period_days,
    notes,
    created_by
  } = req.body;

  if (!name || !contract_type) {
    throw new AppError('VALIDATION_FAILED', 'Name and contract type are required');
  }

  const { data, error } = await supabase
    .from('v2_contracts')
    .insert({
      name,
      description,
      contract_type,
      category,
      job_id: job_id || null,
      company_id: company_id || null,
      vendor_id: vendor_id || null,
      contact_id: contact_id || null,
      parent_contract_id: parent_contract_id || null,
      contract_amount,
      original_amount: contract_amount,
      retainage_percent,
      payment_terms,
      start_date,
      end_date,
      expiration_date,
      scope_of_work,
      insurance_requirements,
      bond_requirements,
      warranty_terms,
      notice_period_days,
      notes,
      created_by: created_by || 'User'
    })
    .select(`
      *,
      job:v2_jobs!job_id(id, name),
      company:v2_companies!company_id(id, name),
      vendor:v2_vendors!vendor_id(id, name)
    `)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activity
  await supabase.from('v2_contract_activity').insert({
    contract_id: data.id,
    action: 'created',
    performed_by: created_by || req.headers['x-user-name'] || 'System',
    notes: `Contract "${name}" created`
  });

  res.status(201).json({ contract: data });
}));

// Update contract
router.patch('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = { ...req.body };
  const updatedBy = updates.updated_by || 'User';

  delete updates.id;
  delete updates.contract_number;
  delete updates.created_at;
  delete updates.deleted_at;
  delete updates.updated_by;

  // Get current for activity log
  const { data: current } = await supabase
    .from('v2_contracts')
    .select('*')
    .eq('id', id)
    .single();

  if (!current) throw new AppError('NOT_FOUND', 'Contract not found');

  // Track changes
  const changes = {};
  for (const [key, newValue] of Object.entries(updates)) {
    if (current[key] !== newValue) {
      changes[key] = { old: current[key], new: newValue };
    }
  }

  const { data, error } = await supabase
    .from('v2_contracts')
    .update(updates)
    .eq('id', id)
    .is('deleted_at', null)
    .select(`
      *,
      job:v2_jobs!job_id(id, name),
      company:v2_companies!company_id(id, name),
      vendor:v2_vendors!vendor_id(id, name)
    `)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activity if changes
  if (Object.keys(changes).length > 0) {
    await supabase.from('v2_contract_activity').insert({
      contract_id: id,
      action: 'updated',
      performed_by: updatedBy,
      field_changes: changes
    });
  }

  res.json({ contract: data });
}));

// Delete contract (soft)
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_contracts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!data) throw new AppError('NOT_FOUND', 'Contract not found');

  res.json({ success: true });
}));

// ============================================================
// SIGNATURE WORKFLOW
// ============================================================

// Send for internal signature
router.post('/:id/send-internal', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { sent_by } = req.body;

  const { data, error } = await supabase
    .from('v2_contracts')
    .update({
      signature_status: 'pending_internal',
      sent_for_signature_at: new Date().toISOString()
    })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!data) throw new AppError('NOT_FOUND', 'Contract not found');

  await supabase.from('v2_contract_activity').insert({
    contract_id: id,
    action: 'sent_for_internal_signature',
    performed_by: sent_by || req.headers['x-user-name'] || 'System'
  });

  res.json({ contract: data });
}));

// Sign internally
router.post('/:id/sign-internal', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { signed_by } = req.body;

  const { data, error } = await supabase
    .from('v2_contracts')
    .update({
      signature_status: 'sent',
      internal_signed_at: new Date().toISOString(),
      internal_signed_by: signed_by || 'User'
    })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!data) throw new AppError('NOT_FOUND', 'Contract not found');

  await supabase.from('v2_contract_activity').insert({
    contract_id: id,
    action: 'signed_internal',
    performed_by: signed_by || req.headers['x-user-name'] || 'System'
  });

  res.json({ contract: data });
}));

// Send to external party
router.post('/:id/send-external', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { sent_by, recipient_email } = req.body;

  const { data, error } = await supabase
    .from('v2_contracts')
    .update({
      signature_status: 'pending_signature'
    })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!data) throw new AppError('NOT_FOUND', 'Contract not found');

  await supabase.from('v2_contract_activity').insert({
    contract_id: id,
    action: 'sent_to_external',
    performed_by: sent_by || req.headers['x-user-name'] || 'System',
    notes: recipient_email ? `Sent to ${recipient_email}` : null
  });

  res.json({ contract: data });
}));

// Mark as externally signed
router.post('/:id/sign-external', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { signed_by, signed_file_url } = req.body;

  const { data, error } = await supabase
    .from('v2_contracts')
    .update({
      signature_status: 'fully_executed',
      status: 'active',
      external_signed_at: new Date().toISOString(),
      external_signed_by: signed_by,
      execution_date: new Date().toISOString().split('T')[0],
      signed_file_url: signed_file_url || null
    })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!data) throw new AppError('NOT_FOUND', 'Contract not found');

  await supabase.from('v2_contract_activity').insert({
    contract_id: id,
    action: 'fully_executed',
    performed_by: 'System',
    notes: `Signed by ${signed_by}`
  });

  res.json({ contract: data });
}));

// ============================================================
// SIGNERS
// ============================================================

// Add signer
router.post('/:id/signers', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { signer_name, signer_email, signer_title, signer_company, signer_type, sign_order } = req.body;

  if (!signer_name || !signer_type) {
    throw new AppError('VALIDATION_FAILED', 'Signer name and type are required');
  }

  const { data, error } = await supabase
    .from('v2_contract_signers')
    .insert({
      contract_id: id,
      signer_name,
      signer_email,
      signer_title,
      signer_company,
      signer_type,
      sign_order: sign_order || 1
    })
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.status(201).json({ signer: data });
}));

// Update signer status
router.patch('/:contractId/signers/:signerId', asyncHandler(async (req, res) => {
  const { signerId } = req.params;
  const updates = { ...req.body };

  delete updates.id;
  delete updates.contract_id;
  delete updates.created_at;

  // Set signed_at if signing
  if (updates.status === 'signed' && !updates.signed_at) {
    updates.signed_at = new Date().toISOString();
  }
  if (updates.status === 'declined' && !updates.declined_at) {
    updates.declined_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('v2_contract_signers')
    .update(updates)
    .eq('id', signerId)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json({ signer: data });
}));

// ============================================================
// CONTRACT TYPES
// ============================================================

router.get('/types/list', asyncHandler(async (req, res) => {
  res.json({
    types: [
      { value: 'prime', label: 'Prime Contract' },
      { value: 'subcontract', label: 'Subcontract' },
      { value: 'proposal', label: 'Proposal' },
      { value: 'change_order', label: 'Change Order' },
      { value: 'amendment', label: 'Amendment' },
      { value: 'nda', label: 'NDA' },
      { value: 'purchase_agreement', label: 'Purchase Agreement' },
      { value: 'other', label: 'Other' }
    ]
  });
}));

module.exports = router;
