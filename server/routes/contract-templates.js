/**
 * Contract Templates Routes
 * Manage contract templates, clauses, and variable sources
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { asyncHandler, AppError } = require('../core/errors');
const { generateContractPDF, embedSignature } = require('../services/contract-pdf-generator');
const { getBuilderId } = require('../core/multi-tenant');

// ============================================================
// CONTRACT TEMPLATES
// ============================================================

// Get all templates
router.get('/templates', asyncHandler(async (req, res) => {
  const { type, search, active_only } = req.query;
  const builderId = getBuilderId(req);

  let query = supabase
    .from('v2_contract_templates')
    .select('*')
    .is('deleted_at', null);

  if (builderId) {
    // Include both builder-specific and system templates (builder_id is null)
    query = query.or(`builder_id.eq.${builderId},builder_id.is.null`);
  }

  if (type) query = query.eq('template_type', type);
  if (active_only === 'true') query = query.eq('is_active', true);
  if (search) {
    query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
  }

  const { data, error } = await query.order('is_default', { ascending: false }).order('name');

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json({ templates: data });
}));

// Get single template
router.get('/templates/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const builderId = getBuilderId(req);

  let query = supabase
    .from('v2_contract_templates')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null);

  if (builderId) {
    query = query.or(`builder_id.eq.${builderId},builder_id.is.null`);
  }

  const { data, error } = await query.single();

  if (error || !data) {
    throw new AppError('NOT_FOUND', 'Template not found');
  }

  // Get associated clauses if clause_ids are specified
  let clauses = [];
  if (data.clause_ids && data.clause_ids.length > 0) {
    const { data: clauseData } = await supabase
      .from('v2_contract_clauses')
      .select('*')
      .in('id', data.clause_ids)
      .eq('is_active', true);
    clauses = clauseData || [];
  }

  res.json({ template: { ...data, clauses } });
}));

// Create template
router.post('/templates', asyncHandler(async (req, res) => {
  const {
    name,
    description,
    template_type,
    content,
    variables,
    clause_ids,
    default_signers,
    default_expiration_days,
    requires_florida_lien_disclosure,
    is_default,
    created_by
  } = req.body;
  const builderId = getBuilderId(req);

  if (!name || !template_type || !content) {
    throw new AppError('VALIDATION_FAILED', 'Name, type, and content are required');
  }

  // Extract variables from content if not provided
  const extractedVars = variables || extractVariables(content);

  const templateData = {
    name,
    description,
    template_type,
    content,
    variables: extractedVars,
    clause_ids: clause_ids || [],
    default_signers: default_signers || [],
    default_expiration_days: default_expiration_days || 30,
    requires_florida_lien_disclosure: requires_florida_lien_disclosure !== false,
    is_default: is_default || false,
    created_by: created_by || 'User'
  };

  if (builderId) templateData.builder_id = builderId;

  // If setting as default, unset other defaults of same type
  if (is_default) {
    await supabase
      .from('v2_contract_templates')
      .update({ is_default: false })
      .eq('template_type', template_type)
      .eq('is_default', true);
  }

  const { data, error } = await supabase
    .from('v2_contract_templates')
    .insert(templateData)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.status(201).json({ template: data });
}));

// Update template
router.patch('/templates/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = { ...req.body };
  const builderId = getBuilderId(req);

  delete updates.id;
  delete updates.created_at;
  delete updates.deleted_at;

  // Re-extract variables if content is updated
  if (updates.content && !updates.variables) {
    updates.variables = extractVariables(updates.content);
  }

  updates.updated_at = new Date().toISOString();

  // Handle default setting
  if (updates.is_default) {
    const { data: current } = await supabase
      .from('v2_contract_templates')
      .select('template_type')
      .eq('id', id)
      .single();

    if (current) {
      await supabase
        .from('v2_contract_templates')
        .update({ is_default: false })
        .eq('template_type', current.template_type)
        .eq('is_default', true)
        .neq('id', id);
    }
  }

  let query = supabase
    .from('v2_contract_templates')
    .update(updates)
    .eq('id', id)
    .is('deleted_at', null);

  if (builderId) query = query.eq('builder_id', builderId);

  const { data, error } = await query.select().single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!data) throw new AppError('NOT_FOUND', 'Template not found or not editable');

  res.json({ template: data });
}));

// Delete template (soft)
router.delete('/templates/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const builderId = getBuilderId(req);

  let query = supabase
    .from('v2_contract_templates')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', id)
    .is('deleted_at', null);

  if (builderId) query = query.eq('builder_id', builderId);

  const { data, error } = await query.select().single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!data) throw new AppError('NOT_FOUND', 'Template not found or not deletable');

  res.json({ success: true });
}));

// ============================================================
// CONTRACT CLAUSES
// ============================================================

// Get all clauses
router.get('/clauses', asyncHandler(async (req, res) => {
  const { category, search, active_only } = req.query;
  const builderId = getBuilderId(req);

  let query = supabase
    .from('v2_contract_clauses')
    .select('*')
    .is('deleted_at', null);

  if (builderId) {
    query = query.or(`builder_id.eq.${builderId},builder_id.is.null`);
  }

  if (category) query = query.eq('category', category);
  if (active_only === 'true') query = query.eq('is_active', true);
  if (search) {
    query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,content.ilike.%${search}%`);
  }

  const { data, error } = await query.order('category').order('sort_order').order('name');

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json({ clauses: data });
}));

// Get clause categories
router.get('/clauses/categories', asyncHandler(async (req, res) => {
  res.json({
    categories: [
      { value: 'legal', label: 'Legal & Compliance' },
      { value: 'payment', label: 'Payment Terms' },
      { value: 'scope', label: 'Scope & Work' },
      { value: 'timeline', label: 'Timeline & Schedule' },
      { value: 'warranty', label: 'Warranty & Guarantees' },
      { value: 'insurance', label: 'Insurance & Bonds' },
      { value: 'termination', label: 'Termination & Default' },
      { value: 'dispute', label: 'Dispute Resolution' },
      { value: 'florida', label: 'Florida-Specific' },
      { value: 'other', label: 'Other' }
    ]
  });
}));

// Get single clause
router.get('/clauses/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const builderId = getBuilderId(req);

  let query = supabase
    .from('v2_contract_clauses')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null);

  if (builderId) {
    query = query.or(`builder_id.eq.${builderId},builder_id.is.null`);
  }

  const { data, error } = await query.single();

  if (error || !data) {
    throw new AppError('NOT_FOUND', 'Clause not found');
  }

  res.json({ clause: data });
}));

// Create clause
router.post('/clauses', asyncHandler(async (req, res) => {
  const {
    name,
    description,
    category,
    content,
    variables,
    is_required,
    sort_order,
    created_by
  } = req.body;
  const builderId = getBuilderId(req);

  if (!name || !category || !content) {
    throw new AppError('VALIDATION_FAILED', 'Name, category, and content are required');
  }

  const clauseData = {
    name,
    description,
    category,
    content,
    variables: variables || extractVariables(content),
    is_required: is_required || false,
    sort_order: sort_order || 0,
    created_by: created_by || 'User'
  };

  if (builderId) clauseData.builder_id = builderId;

  const { data, error } = await supabase
    .from('v2_contract_clauses')
    .insert(clauseData)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.status(201).json({ clause: data });
}));

// Update clause
router.patch('/clauses/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = { ...req.body };
  const builderId = getBuilderId(req);

  delete updates.id;
  delete updates.created_at;
  delete updates.deleted_at;

  if (updates.content && !updates.variables) {
    updates.variables = extractVariables(updates.content);
  }

  updates.updated_at = new Date().toISOString();

  let query = supabase
    .from('v2_contract_clauses')
    .update(updates)
    .eq('id', id)
    .is('deleted_at', null);

  if (builderId) query = query.eq('builder_id', builderId);

  const { data, error } = await query.select().single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!data) throw new AppError('NOT_FOUND', 'Clause not found or not editable');

  res.json({ clause: data });
}));

// Delete clause (soft)
router.delete('/clauses/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const builderId = getBuilderId(req);

  let query = supabase
    .from('v2_contract_clauses')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', id)
    .is('deleted_at', null);

  if (builderId) query = query.eq('builder_id', builderId);

  const { data, error } = await query.select().single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!data) throw new AppError('NOT_FOUND', 'Clause not found or not deletable');

  res.json({ success: true });
}));

// ============================================================
// VARIABLE SOURCES
// ============================================================

// Get all variable sources
router.get('/variables', asyncHandler(async (req, res) => {
  const { source_type, required_only } = req.query;

  let query = supabase
    .from('v2_contract_variable_sources')
    .select('*');

  if (source_type) query = query.eq('source_type', source_type);
  if (required_only === 'true') query = query.eq('is_required', true);

  const { data, error } = await query.order('display_label');

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json({ variables: data });
}));

// Resolve variables for a contract
router.post('/variables/resolve', asyncHandler(async (req, res) => {
  const { contract_id, job_id, lead_id, company_id, contact_id, custom_values } = req.body;

  // Get all variable sources
  const { data: sources } = await supabase
    .from('v2_contract_variable_sources')
    .select('*');

  const resolved = {};

  // Fetch related data
  let job, lead, company, contact, contract;

  if (job_id) {
    const { data } = await supabase.from('v2_jobs').select('*').eq('id', job_id).single();
    job = data;
  }
  if (lead_id) {
    const { data } = await supabase.from('v2_leads').select('*').eq('id', lead_id).single();
    lead = data;
  }
  if (company_id) {
    const { data } = await supabase.from('v2_companies').select('*').eq('id', company_id).single();
    company = data;
  }
  if (contact_id) {
    const { data } = await supabase.from('v2_contacts').select('*').eq('id', contact_id).single();
    contact = data;
  }
  if (contract_id) {
    const { data } = await supabase.from('v2_contracts').select('*').eq('id', contract_id).single();
    contract = data;
  }

  // Resolve each variable
  for (const source of (sources || [])) {
    let value = custom_values?.[source.variable_name];

    if (!value) {
      // Try to resolve from source
      switch (source.source_type) {
        case 'job':
          value = job?.[source.source_field];
          // Fallback to lead for job fields
          if (!value && lead && source.source_field) {
            const leadField = source.source_field === 'name' ? 'project_address' : source.source_field;
            value = lead?.[leadField];
          }
          break;
        case 'lead':
          value = lead?.[source.source_field];
          break;
        case 'company':
          value = company?.[source.source_field];
          break;
        case 'contact':
          value = contact?.[source.source_field];
          // Fallback to lead data for contact fields when no contact provided
          if (!value && lead) {
            const leadFieldMap = {
              'full_name': `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
              'first_name': lead.first_name,
              'last_name': lead.last_name,
              'email': lead.email,
              'phone': lead.phone,
              'address': lead.project_address
            };
            value = leadFieldMap[source.source_field];
          }
          break;
        case 'contract':
          value = contract?.[source.source_field];
          break;
        case 'system':
          value = getSystemValue(source.variable_name);
          break;
        case 'manual':
        default:
          value = source.default_value;
      }
    }

    // Format value
    if (value && source.format_type) {
      value = formatValue(value, source.format_type, source.format_options);
    }

    resolved[source.variable_name] = value || source.default_value || '';
  }

  // Add custom values that aren't in sources
  if (custom_values) {
    for (const [key, value] of Object.entries(custom_values)) {
      if (!resolved.hasOwnProperty(key)) {
        resolved[key] = value;
      }
    }
  }

  res.json({ variables: resolved });
}));

// ============================================================
// CONTRACT DOCUMENTS
// ============================================================

// Generate document from template
router.post('/documents/generate', asyncHandler(async (req, res) => {
  const {
    contract_id,
    template_id,
    variables,
    created_by
  } = req.body;

  if (!contract_id || !template_id) {
    throw new AppError('VALIDATION_FAILED', 'Contract ID and Template ID are required');
  }

  // Get template
  const { data: template, error: templateError } = await supabase
    .from('v2_contract_templates')
    .select('*')
    .eq('id', template_id)
    .single();

  if (templateError || !template) {
    throw new AppError('NOT_FOUND', 'Template not found');
  }

  // Substitute variables in content
  let content = template.content;
  for (const [key, value] of Object.entries(variables || {})) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    content = content.replace(regex, value || '');
  }

  // Get max version for this contract
  const { data: existing } = await supabase
    .from('v2_contract_documents')
    .select('version')
    .eq('contract_id', contract_id)
    .order('version', { ascending: false })
    .limit(1);

  const version = (existing?.[0]?.version || 0) + 1;

  // Create document
  const { data: document, error } = await supabase
    .from('v2_contract_documents')
    .insert({
      contract_id,
      template_id,
      version,
      content,
      variables_snapshot: variables,
      florida_lien_disclosure_acknowledged: false,
      created_by: created_by || 'User'
    })
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.status(201).json({ document });
}));

// Get documents for a contract
router.get('/documents/:contractId', asyncHandler(async (req, res) => {
  const { contractId } = req.params;

  const { data, error } = await supabase
    .from('v2_contract_documents')
    .select(`
      *,
      template:v2_contract_templates!template_id(id, name, template_type)
    `)
    .eq('contract_id', contractId)
    .order('version', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json({ documents: data });
}));

// Acknowledge Florida Lien Disclosure
router.post('/documents/:id/acknowledge-disclosure', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { acknowledged_by } = req.body;

  const { data, error } = await supabase
    .from('v2_contract_documents')
    .update({
      florida_lien_disclosure_acknowledged: true,
      florida_lien_disclosure_acknowledged_at: new Date().toISOString(),
      florida_lien_disclosure_acknowledged_by: acknowledged_by || 'User'
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!data) throw new AppError('NOT_FOUND', 'Document not found');

  res.json({ document: data });
}));

// ============================================================
// TEMPLATE TYPES
// ============================================================

router.get('/template-types', asyncHandler(async (req, res) => {
  res.json({
    types: [
      { value: 'prime_contract', label: 'Prime Contract' },
      { value: 'subcontract', label: 'Subcontract' },
      { value: 'proposal', label: 'Proposal' },
      { value: 'change_order', label: 'Change Order' },
      { value: 'amendment', label: 'Amendment' },
      { value: 'nda', label: 'Non-Disclosure Agreement' },
      { value: 'letter_of_intent', label: 'Letter of Intent' },
      { value: 'warranty', label: 'Warranty Document' },
      { value: 'release', label: 'Lien Release / Waiver' },
      { value: 'other', label: 'Other' }
    ]
  });
}));

// ============================================================
// HELPERS
// ============================================================

function extractVariables(content) {
  const regex = /{{([A-Z_]+)}}/g;
  const variables = [];
  let match;

  while ((match = regex.exec(content)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }

  return variables;
}

function getSystemValue(variableName) {
  const now = new Date();

  switch (variableName) {
    case 'CURRENT_DATE':
      return now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    case 'CURRENT_YEAR':
      return now.getFullYear().toString();
    case 'FLORIDA_LIEN_DISCLOSURE':
      return `NOTICE TO OWNER

YOU ARE BEING ASKED TO SIGN A PROPOSAL OR CONTRACT FOR RESIDENTIAL CONSTRUCTION OR IMPROVEMENTS. FLORIDA LAW (CHAPTER 713, FLORIDA STATUTES) REQUIRES THAT THE OWNER OF RESIDENTIAL PROPERTY BE GIVEN WRITTEN NOTICE OF CERTAIN RIGHTS AND RESPONSIBILITIES REGARDING CONSTRUCTION LIENS.

FLORIDA'S CONSTRUCTION LIEN LAW ALLOWS CONTRACTORS, SUBCONTRACTORS, AND MATERIAL SUPPLIERS TO RECORD LIENS AGAINST YOUR PROPERTY IF THEY ARE NOT PAID FOR WORK THEY PERFORM OR MATERIALS THEY PROVIDE FOR YOUR PROJECT - EVEN IF YOU HAVE ALREADY PAID YOUR GENERAL CONTRACTOR.

TO PROTECT YOURSELF:
1. REQUIRE YOUR CONTRACTOR TO GIVE YOU A LIST OF ALL SUBCONTRACTORS AND MATERIAL SUPPLIERS WORKING ON YOUR PROJECT.
2. REQUIRE YOUR CONTRACTOR TO OBTAIN LIEN RELEASES FROM ALL SUBCONTRACTORS AND MATERIAL SUPPLIERS BEFORE YOU MAKE FINAL PAYMENT.
3. CONSIDER REQUIRING THAT ALL PAYMENTS BE MADE BY JOINT CHECK PAYABLE TO BOTH YOUR CONTRACTOR AND THE SUBCONTRACTOR OR MATERIAL SUPPLIER.

PROPERTY OWNER ACKNOWLEDGMENT: I have received a copy of this notice and have had the opportunity to read and understand it.`;
    default:
      return '';
  }
}

function formatValue(value, formatType, options) {
  switch (formatType) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2
      }).format(value);
    case 'date':
      return new Date(value).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    case 'percentage':
      return `${value}%`;
    case 'phone':
      return value.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
    case 'uppercase':
      return String(value).toUpperCase();
    default:
      return value;
  }
}

// ============================================================
// CONTRACT PRICING ENGINE
// ============================================================

// Get pricing types
router.get('/pricing-types', asyncHandler(async (req, res) => {
  res.json({
    types: [
      {
        value: 'fixed_price',
        label: 'Fixed Price / Lump Sum',
        description: 'Single fixed price for the entire project',
        fields: ['contract_amount', 'overhead_percent', 'profit_percent', 'contingency_percent']
      },
      {
        value: 'cost_plus',
        label: 'Cost Plus Fee',
        description: 'Actual costs plus a builder fee percentage',
        fields: ['base_cost', 'builder_fee_percent', 'allowances_total']
      },
      {
        value: 'gmp',
        label: 'Guaranteed Maximum Price (GMP)',
        description: 'Cost plus with a price cap. Savings split between owner and builder.',
        fields: ['base_cost', 'builder_fee_percent', 'gmp_amount', 'savings_split_owner_percent']
      },
      {
        value: 'time_materials',
        label: 'Time & Materials',
        description: 'Hourly rates plus materials at cost',
        fields: ['hourly_rate', 'materials_markup_percent']
      },
      {
        value: 'unit_price',
        label: 'Unit Price',
        description: 'Fixed price per unit of work (e.g., per SF, per LF)',
        fields: ['unit_prices']
      }
    ]
  });
}));

// Calculate contract pricing
router.post('/pricing/calculate', asyncHandler(async (req, res) => {
  const {
    pricing_type,
    base_cost = 0,
    builder_fee_percent = 15,
    overhead_percent = 0,
    profit_percent = 0,
    contingency_percent = 0,
    gmp_amount,
    savings_split_owner_percent = 50,
    allowances_total = 0
  } = req.body;

  let result = {
    pricing_type,
    base_cost: parseFloat(base_cost),
    allowances_total: parseFloat(allowances_total),
    breakdown: []
  };

  switch (pricing_type) {
    case 'cost_plus':
      const costPlusFee = result.base_cost * (builder_fee_percent / 100);
      result.builder_fee_percent = builder_fee_percent;
      result.builder_fee_amount = costPlusFee;
      result.contract_amount = result.base_cost + costPlusFee + result.allowances_total;
      result.breakdown = [
        { label: 'Base Cost', amount: result.base_cost },
        { label: `Builder Fee (${builder_fee_percent}%)`, amount: costPlusFee },
        { label: 'Allowances', amount: result.allowances_total },
        { label: 'Total Contract', amount: result.contract_amount, isTotal: true }
      ];
      break;

    case 'gmp':
      const gmpFee = result.base_cost * (builder_fee_percent / 100);
      const calculatedTotal = result.base_cost + gmpFee + result.allowances_total;
      const cappedAmount = gmp_amount ? Math.min(parseFloat(gmp_amount), calculatedTotal) : calculatedTotal;
      const potentialSavings = gmp_amount ? Math.max(0, parseFloat(gmp_amount) - calculatedTotal) : 0;
      const ownerSavings = potentialSavings * (savings_split_owner_percent / 100);
      const builderSavings = potentialSavings - ownerSavings;

      result.builder_fee_percent = builder_fee_percent;
      result.builder_fee_amount = gmpFee;
      result.gmp_amount = parseFloat(gmp_amount) || calculatedTotal;
      result.savings_split_owner_percent = savings_split_owner_percent;
      result.potential_savings = potentialSavings;
      result.owner_savings = ownerSavings;
      result.builder_savings = builderSavings;
      result.contract_amount = cappedAmount;
      result.breakdown = [
        { label: 'Base Cost', amount: result.base_cost },
        { label: `Builder Fee (${builder_fee_percent}%)`, amount: gmpFee },
        { label: 'Allowances', amount: result.allowances_total },
        { label: 'Calculated Total', amount: calculatedTotal },
        { label: 'GMP Cap', amount: result.gmp_amount, isGmp: true },
        { label: 'Contract Amount', amount: result.contract_amount, isTotal: true }
      ];
      if (potentialSavings > 0) {
        result.breakdown.push(
          { label: `Potential Savings`, amount: potentialSavings, isSavings: true },
          { label: `Owner Share (${savings_split_owner_percent}%)`, amount: ownerSavings },
          { label: `Builder Share (${100 - savings_split_owner_percent}%)`, amount: builderSavings }
        );
      }
      break;

    case 'fixed_price':
    default:
      const overheadAmt = result.base_cost * (overhead_percent / 100);
      const afterOverhead = result.base_cost + overheadAmt;
      const profitAmt = afterOverhead * (profit_percent / 100);
      const contingencyAmt = result.base_cost * (contingency_percent / 100);
      const fixedTotal = afterOverhead + profitAmt + contingencyAmt + result.allowances_total;

      result.overhead_percent = overhead_percent;
      result.overhead_amount = overheadAmt;
      result.profit_percent = profit_percent;
      result.profit_amount = profitAmt;
      result.contingency_percent = contingency_percent;
      result.contingency_amount = contingencyAmt;
      result.contract_amount = fixedTotal;
      result.breakdown = [
        { label: 'Base Cost', amount: result.base_cost },
        { label: `Overhead (${overhead_percent}%)`, amount: overheadAmt },
        { label: `Profit (${profit_percent}%)`, amount: profitAmt },
        { label: `Contingency (${contingency_percent}%)`, amount: contingencyAmt },
        { label: 'Allowances', amount: result.allowances_total },
        { label: 'Total Contract', amount: result.contract_amount, isTotal: true }
      ];
      break;
  }

  res.json(result);
}));

// Get estimate data for a job (to import into contract)
router.get('/estimates/job/:jobId', asyncHandler(async (req, res) => {
  const { jobId } = req.params;

  // Get approved or most recent estimate for the job
  const { data: estimates, error } = await supabase
    .from('v2_estimates')
    .select(`
      id,
      title,
      total_amount,
      status,
      created_at,
      updated_at
    `)
    .eq('job_id', jobId)
    .is('deleted_at', null)
    .order('status', { ascending: false })  // approved first
    .order('updated_at', { ascending: false })
    .limit(5);

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // If we have an approved estimate, get its line items
  let lineItems = [];
  const approvedEstimate = estimates?.find(e => e.status === 'approved') || estimates?.[0];

  if (approvedEstimate) {
    const { data: lines } = await supabase
      .from('v2_estimate_lines')
      .select(`
        id,
        description,
        cost_type,
        quantity,
        unit,
        unit_cost,
        amount,
        markup_percent,
        markup_amount,
        is_allowance,
        cost_code:v2_cost_codes(code, name)
      `)
      .eq('estimate_id', approvedEstimate.id)
      .order('sort_order');

    lineItems = lines || [];
  }

  // Calculate totals by category
  const categorySummary = lineItems.reduce((acc, line) => {
    const cat = line.cost_type || 'other';
    if (!acc[cat]) acc[cat] = 0;
    acc[cat] += parseFloat(line.amount || 0);
    return acc;
  }, {});

  const allowancesTotal = lineItems
    .filter(l => l.is_allowance)
    .reduce((sum, l) => sum + parseFloat(l.amount || 0), 0);

  const baseTotal = lineItems
    .filter(l => !l.is_allowance)
    .reduce((sum, l) => sum + parseFloat(l.amount || 0), 0);

  res.json({
    estimates: estimates || [],
    selectedEstimate: approvedEstimate,
    lineItems,
    summary: {
      base_cost: baseTotal,
      allowances_total: allowancesTotal,
      total: approvedEstimate?.total_amount || (baseTotal + allowancesTotal),
      by_category: categorySummary
    }
  });
}));

// ============================================================
// PDF GENERATION
// ============================================================

// Generate contract PDF
router.post('/documents/:id/pdf', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { include_florida_disclosure = false } = req.body;

  // Get the contract document with resolved content
  const { data: doc, error: docError } = await supabase
    .from('v2_contract_documents')
    .select(`
      *,
      template:v2_contract_templates(name, contract_type)
    `)
    .eq('id', id)
    .single();

  if (docError || !doc) {
    throw new AppError('NOT_FOUND', 'Contract document not found');
  }

  // Get company settings for branding
  const { data: company } = await supabase
    .from('v2_company_settings')
    .select('*')
    .limit(1)
    .single();

  // Generate PDF
  const pdfBuffer = await generateContractPDF({
    company: company || {},
    contract: {
      name: doc.name || doc.template?.name || 'Construction Contract',
      contract_number: doc.document_number,
      type: doc.template?.contract_type
    },
    content: doc.rendered_content || doc.content || '',
    signers: [
      { name: '', role: 'Builder/Contractor' },
      { name: '', role: 'Property Owner' }
    ],
    includeSignatureLines: true,
    includeFlorida713Disclosure: include_florida_disclosure ||
      doc.florida_lien_disclosure_required
  });

  // Return as downloadable PDF
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${doc.name || 'contract'}.pdf"`);
  res.send(pdfBuffer);
}));

// Preview contract PDF (returns base64)
router.post('/documents/:id/pdf/preview', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { include_florida_disclosure = false } = req.body;

  const { data: doc, error: docError } = await supabase
    .from('v2_contract_documents')
    .select(`
      *,
      template:v2_contract_templates(name, contract_type)
    `)
    .eq('id', id)
    .single();

  if (docError || !doc) {
    throw new AppError('NOT_FOUND', 'Contract document not found');
  }

  const { data: company } = await supabase
    .from('v2_company_settings')
    .select('*')
    .limit(1)
    .single();

  const pdfBuffer = await generateContractPDF({
    company: company || {},
    contract: {
      name: doc.name || doc.template?.name || 'Construction Contract',
      contract_number: doc.document_number,
      type: doc.template?.contract_type
    },
    content: doc.rendered_content || doc.content || '',
    signers: [
      { name: '', role: 'Builder/Contractor' },
      { name: '', role: 'Property Owner' }
    ],
    includeSignatureLines: true,
    includeFlorida713Disclosure: include_florida_disclosure ||
      doc.florida_lien_disclosure_required
  });

  res.json({
    pdf: pdfBuffer.toString('base64'),
    filename: `${doc.name || 'contract'}.pdf`
  });
}));

// Generate PDF from content directly (without saving document first)
router.post('/pdf/generate', asyncHandler(async (req, res) => {
  const {
    content,
    title = 'Contract',
    contract_number,
    signers = [],
    include_florida_disclosure = false
  } = req.body;

  if (!content) {
    throw new AppError('VALIDATION_FAILED', 'Content is required');
  }

  const { data: company } = await supabase
    .from('v2_company_settings')
    .select('*')
    .limit(1)
    .single();

  const pdfBuffer = await generateContractPDF({
    company: company || {},
    contract: {
      name: title,
      contract_number
    },
    content,
    signers: signers.length > 0 ? signers : [
      { name: '', role: 'Builder/Contractor' },
      { name: '', role: 'Property Owner' }
    ],
    includeSignatureLines: true,
    includeFlorida713Disclosure: include_florida_disclosure
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${title}.pdf"`);
  res.send(pdfBuffer);
}));

// Embed signature into existing PDF
router.post('/documents/:id/embed-signature', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { signature_data, signer_name, signer_role, x, y, page = 0, width = 150, height = 50 } = req.body;

  if (!signature_data) {
    throw new AppError('VALIDATION_FAILED', 'Signature data is required');
  }

  // Get the document's current PDF or generate one
  const { data: doc, error: docError } = await supabase
    .from('v2_contract_documents')
    .select('*')
    .eq('id', id)
    .single();

  if (docError || !doc) {
    throw new AppError('NOT_FOUND', 'Contract document not found');
  }

  // For now, we'll regenerate the PDF and embed the signature
  // In production, you'd store the PDF in storage and retrieve it
  const { data: company } = await supabase
    .from('v2_company_settings')
    .select('*')
    .limit(1)
    .single();

  let pdfBuffer = await generateContractPDF({
    company: company || {},
    contract: {
      name: doc.name || 'Contract',
      contract_number: doc.document_number
    },
    content: doc.rendered_content || doc.content || '',
    signers: [],
    includeSignatureLines: true,
    includeFlorida713Disclosure: doc.florida_lien_disclosure_required
  });

  // Embed the signature
  const signedPdfBuffer = await embedSignature(pdfBuffer, {
    data: signature_data,
    x: x || 50,
    y: y || 200,
    page,
    width,
    height
  });

  // Update document status
  await supabase
    .from('v2_contract_documents')
    .update({
      status: 'signed',
      signed_at: new Date().toISOString(),
      signed_by: signer_name
    })
    .eq('id', id);

  res.json({
    success: true,
    pdf: signedPdfBuffer.toString('base64'),
    filename: `${doc.name || 'contract'}-signed.pdf`
  });
}));

// Get estimate data for a lead (when no job exists yet)
router.get('/estimates/lead/:leadId', asyncHandler(async (req, res) => {
  const { leadId } = req.params;

  // Get lead data including estimated value
  const { data: lead, error } = await supabase
    .from('v2_leads')
    .select('*')
    .eq('id', leadId)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!lead) throw new AppError('NOT_FOUND', 'Lead not found');

  // Check if lead has a job_id with estimates
  let estimates = [];
  let lineItems = [];
  let summary = {
    base_cost: lead.estimated_value || 0,
    allowances_total: 0,
    total: lead.estimated_value || 0,
    by_category: {}
  };

  if (lead.job_id) {
    const { data: jobEstimates } = await supabase
      .from('v2_estimates')
      .select('id, title, total_amount, status, created_at')
      .eq('job_id', lead.job_id)
      .is('deleted_at', null)
      .order('status', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(5);

    estimates = jobEstimates || [];

    if (estimates.length > 0) {
      const selectedEstimate = estimates.find(e => e.status === 'approved') || estimates[0];
      const { data: lines } = await supabase
        .from('v2_estimate_lines')
        .select('*')
        .eq('estimate_id', selectedEstimate.id)
        .order('sort_order');

      lineItems = lines || [];

      const allowancesTotal = lineItems
        .filter(l => l.is_allowance)
        .reduce((sum, l) => sum + parseFloat(l.amount || 0), 0);

      const baseTotal = lineItems
        .filter(l => !l.is_allowance)
        .reduce((sum, l) => sum + parseFloat(l.amount || 0), 0);

      summary = {
        base_cost: baseTotal,
        allowances_total: allowancesTotal,
        total: selectedEstimate.total_amount || (baseTotal + allowancesTotal),
        by_category: lineItems.reduce((acc, line) => {
          const cat = line.cost_type || 'other';
          if (!acc[cat]) acc[cat] = 0;
          acc[cat] += parseFloat(line.amount || 0);
          return acc;
        }, {})
      };
    }
  }

  res.json({
    lead,
    estimates,
    lineItems,
    summary
  });
}));

module.exports = router;
