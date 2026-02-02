/**
 * Onboarding Routes
 * Handles builder setup wizard and initial configuration
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { asyncHandler, AppError, validationError } = require('../core/errors');
const { getBuilderId } = require('../core/multi-tenant');

// Sample cost codes for new builders
const SAMPLE_COST_CODES = [
  { code: '01000', name: 'General Conditions', category: 'General' },
  { code: '02000', name: 'Site Work', category: 'Site' },
  { code: '03000', name: 'Concrete', category: 'Structure' },
  { code: '04000', name: 'Masonry', category: 'Structure' },
  { code: '05000', name: 'Metals', category: 'Structure' },
  { code: '06000', name: 'Wood & Plastics', category: 'Structure' },
  { code: '06100', name: 'Rough Carpentry', category: 'Structure' },
  { code: '06200', name: 'Finish Carpentry', category: 'Finishes' },
  { code: '07000', name: 'Thermal & Moisture Protection', category: 'Envelope' },
  { code: '08000', name: 'Doors & Windows', category: 'Openings' },
  { code: '09000', name: 'Finishes', category: 'Finishes' },
  { code: '09250', name: 'Drywall', category: 'Finishes' },
  { code: '09300', name: 'Tile', category: 'Finishes' },
  { code: '09650', name: 'Flooring', category: 'Finishes' },
  { code: '09900', name: 'Painting', category: 'Finishes' },
  { code: '10000', name: 'Specialties', category: 'Specialties' },
  { code: '11000', name: 'Equipment', category: 'Equipment' },
  { code: '12000', name: 'Furnishings', category: 'Furnishings' },
  { code: '15000', name: 'Mechanical', category: 'MEP' },
  { code: '15300', name: 'Plumbing', category: 'MEP' },
  { code: '15500', name: 'HVAC', category: 'MEP' },
  { code: '16000', name: 'Electrical', category: 'MEP' },
  { code: '16700', name: 'Low Voltage', category: 'MEP' },
  { code: '31000', name: 'Earthwork', category: 'Site' },
  { code: '32000', name: 'Exterior Improvements', category: 'Site' },
];

/**
 * GET /api/onboarding/status
 * Get the onboarding status for the current builder
 */
router.get('/status', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);

  if (!builderId) {
    return res.json({
      complete: false,
      steps: { company: false, cost_codes: false, team: false },
      message: 'Not authenticated'
    });
  }

  // Get builder info
  const { data: builder, error: builderError } = await supabase
    .from('v2_builders')
    .select('*')
    .eq('id', builderId)
    .single();

  if (builderError || !builder) {
    throw new AppError(404, 'BUILDER_NOT_FOUND', 'Builder not found');
  }

  // Check if company profile is complete
  const companyComplete = !!(builder.name && builder.email);

  // Check if cost codes exist
  const { count: costCodeCount } = await supabase
    .from('v2_cost_codes')
    .select('*', { count: 'exact', head: true })
    .eq('builder_id', builderId);

  const costCodesComplete = (costCodeCount || 0) > 0;

  // Check if team members exist (besides owner)
  const { count: userCount } = await supabase
    .from('v2_users')
    .select('*', { count: 'exact', head: true })
    .eq('builder_id', builderId)
    .is('deleted_at', null);

  const teamComplete = (userCount || 0) > 1;

  // Check settings for completed onboarding
  const onboardingComplete = builder.settings?.onboarding_complete === true;

  res.json({
    complete: onboardingComplete,
    steps: {
      company: companyComplete,
      cost_codes: costCodesComplete,
      team: teamComplete,
    },
    builder: {
      id: builder.id,
      name: builder.name,
      logo_url: builder.logo_url,
      plan: builder.plan,
    }
  });
}));

/**
 * PATCH /api/onboarding/company
 * Update company profile during onboarding
 */
router.patch('/company', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);

  if (!builderId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  const { name, logo_url, address, city, state, zip, phone, email, website, license_number } = req.body;

  const updates = {};
  if (name !== undefined) updates.name = name;
  if (logo_url !== undefined) updates.logo_url = logo_url;
  if (address !== undefined) updates.address = address;
  if (city !== undefined) updates.city = city;
  if (state !== undefined) updates.state = state;
  if (zip !== undefined) updates.zip = zip;
  if (phone !== undefined) updates.phone = phone;
  if (email !== undefined) updates.email = email;
  if (website !== undefined) updates.website = website;
  if (license_number !== undefined) updates.license_number = license_number;

  if (Object.keys(updates).length === 0) {
    throw validationError('No valid fields to update');
  }

  updates.updated_at = new Date().toISOString();

  const { data: builder, error } = await supabase
    .from('v2_builders')
    .update(updates)
    .eq('id', builderId)
    .select()
    .single();

  if (error) {
    throw new AppError(500, 'UPDATE_FAILED', 'Failed to update company profile');
  }

  res.json({ builder });
}));

/**
 * POST /api/onboarding/cost-codes/sample
 * Add sample cost codes for the builder
 */
router.post('/cost-codes/sample', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);

  if (!builderId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  // Check if cost codes already exist
  const { count: existingCount } = await supabase
    .from('v2_cost_codes')
    .select('*', { count: 'exact', head: true })
    .eq('builder_id', builderId);

  if ((existingCount || 0) > 0) {
    return res.json({
      message: 'Cost codes already exist',
      count: existingCount
    });
  }

  // Add sample cost codes
  const costCodes = SAMPLE_COST_CODES.map(cc => ({
    ...cc,
    builder_id: builderId,
  }));

  const { data, error } = await supabase
    .from('v2_cost_codes')
    .insert(costCodes)
    .select();

  if (error) {
    throw new AppError(500, 'INSERT_FAILED', 'Failed to create cost codes');
  }

  res.json({
    message: 'Sample cost codes created',
    count: data.length,
    cost_codes: data,
  });
}));

/**
 * POST /api/onboarding/complete
 * Mark onboarding as complete
 */
router.post('/complete', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);

  if (!builderId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  // Update builder settings to mark onboarding complete
  const { data: builder, error } = await supabase
    .from('v2_builders')
    .update({
      settings: { onboarding_complete: true },
      updated_at: new Date().toISOString(),
    })
    .eq('id', builderId)
    .select()
    .single();

  if (error) {
    throw new AppError(500, 'UPDATE_FAILED', 'Failed to complete onboarding');
  }

  res.json({
    success: true,
    message: 'Onboarding completed',
    builder: {
      id: builder.id,
      name: builder.name,
      settings: builder.settings,
    }
  });
}));

/**
 * POST /api/onboarding/sample-data
 * Create sample data for demo purposes
 */
router.post('/sample-data', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);

  if (!builderId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  const results = {
    jobs: 0,
    vendors: 0,
    cost_codes: 0,
  };

  // Create sample job
  const { data: job } = await supabase
    .from('v2_jobs')
    .insert({
      builder_id: builderId,
      name: 'Sample Project - 123 Demo St',
      address: '123 Demo Street',
      city: 'Sample City',
      state: 'FL',
      zip: '33000',
      client_name: 'John & Jane Demo',
      contract_amount: 500000,
      status: 'active',
    })
    .select()
    .single();

  if (job) results.jobs++;

  // Create sample vendors
  const sampleVendors = [
    { name: 'ABC Plumbing', trade: 'Plumbing', phone: '555-0001', email: 'info@abcplumbing.com' },
    { name: 'Elite Electric', trade: 'Electrical', phone: '555-0002', email: 'info@eliteelectric.com' },
    { name: 'Premier HVAC', trade: 'HVAC', phone: '555-0003', email: 'info@premierhvac.com' },
    { name: 'Quality Carpentry', trade: 'Carpentry', phone: '555-0004', email: 'info@qualitycarpentry.com' },
    { name: 'Pro Painting', trade: 'Painting', phone: '555-0005', email: 'info@propainting.com' },
  ];

  for (const vendor of sampleVendors) {
    const { error } = await supabase
      .from('v2_vendors')
      .insert({
        builder_id: builderId,
        ...vendor,
      });
    if (!error) results.vendors++;
  }

  // Check if cost codes exist, add samples if not
  const { count: existingCodes } = await supabase
    .from('v2_cost_codes')
    .select('*', { count: 'exact', head: true })
    .eq('builder_id', builderId);

  if ((existingCodes || 0) === 0) {
    const costCodes = SAMPLE_COST_CODES.map(cc => ({
      ...cc,
      builder_id: builderId,
    }));

    const { data: createdCodes } = await supabase
      .from('v2_cost_codes')
      .insert(costCodes)
      .select();

    if (createdCodes) results.cost_codes = createdCodes.length;
  }

  res.json({
    success: true,
    message: 'Sample data created',
    results,
  });
}));

module.exports = router;
