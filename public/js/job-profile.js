// ============================================================
// JOB PROFILE APP - Ross Built CMS
// ============================================================

let state = {
  currentJobId: null,
  job: null,
  plans: [],
  isEditing: false,
  originalValues: {},
  extractedData: null
};

// Spec field mappings (form id -> db field)
const specFields = {
  // Building specs
  specSqftConditioned: 'sqft_conditioned',
  specSqftTotal: 'sqft_total',
  specSqftGarage: 'sqft_garage',
  specSqftCovered: 'sqft_covered',
  specBedrooms: 'bedrooms',
  specBathrooms: 'bathrooms',
  specHalfBaths: 'half_baths',
  specStories: 'stories',
  specGarageSpaces: 'garage_spaces',
  specPoolType: 'pool_type',

  // Construction details
  specConstructionType: 'construction_type',
  specFoundationType: 'foundation_type',
  specRoofType: 'roof_type',
  specExteriorFinish: 'exterior_finish',
  specCeilingHeightMain: 'ceiling_height_main',
  specCountertopMaterial: 'countertop_material',

  // Structural
  specStructPierCount: 'struct_pier_count',
  specStructPierDepth: 'struct_pier_depth',
  specStructConcretePsi: 'struct_concrete_psi',
  specStructConcreteYards: 'struct_concrete_yards',
  specStructRebarTons: 'struct_rebar_tons',
  specStructWoodBeamCount: 'struct_wood_beam_count',
  specStructLvlBeamCount: 'struct_lvl_beam_count',
  specStructTrussCount: 'struct_truss_count',
  specStructTrussSpanMax: 'struct_truss_span_max',
  specStructWallFraming: 'struct_wall_framing',
  specStructSheathingType: 'struct_sheathing_type',
  specStructRoofPitch: 'struct_roof_pitch',
  specMatFramingBf: 'mat_framing_bf',
  specStructWindSpeed: 'struct_wind_speed',
  specStructExposureCategory: 'struct_exposure_category',
  specStructLiveLoadFloor: 'struct_live_load_floor',

  // Windows & Doors
  specWindowsTotalCount: 'windows_total_count',
  specWindowsImpactRated: 'windows_impact_rated',
  specDoorsExteriorCount: 'doors_exterior_count',
  specDoorsInteriorCount: 'doors_interior_count',
  specDoorsGarageCount: 'doors_garage_count',
  specDoorsImpactRated: 'doors_impact_rated',

  // Electrical
  specElecServiceAmps: 'elec_service_amps',
  specElecPanelCount: 'elec_panel_count',
  specElecOutletsCount: 'elec_outlets_count',
  specElecLightingFixtures: 'elec_lighting_fixtures',
  specElecRecessedLights: 'elec_recessed_lights',
  specElecCeilingFans: 'elec_ceiling_fans',
  specElecGeneratorReady: 'elec_generator_ready',
  specElecSolarReady: 'elec_solar_ready',

  // Plumbing
  specPlumbToilets: 'plumb_toilets',
  specPlumbSinks: 'plumb_sinks',
  specPlumbShowers: 'plumb_showers',
  specPlumbTubs: 'plumb_tubs',
  specPlumbWaterHeaterType: 'plumb_water_heater_type',
  specPlumbGasLine: 'plumb_gas_line',

  // HVAC
  specAcUnits: 'ac_units',
  specAcTonnage: 'ac_tonnage',
  specHvacSystemType: 'hvac_system_type',
  specHvacFuelType: 'hvac_fuel_type',
  specHvacZones: 'hvac_zones',
  specHvacSeerRating: 'hvac_seer_rating',

  // Roofing
  specRoofSqft: 'roof_sqft',
  specRoofSquares: 'roof_squares',
  specRoofMaterial: 'roof_material',
  specRoofSkylights: 'roof_skylights',

  // Code & Design
  specCodeBuildingCode: 'code_building_code',
  specCodeConstructionType: 'code_construction_type',
  specCodeFireSprinklers: 'code_fire_sprinklers',

  // Team
  specArchitect: 'architect',
  specTeamArchitectFirm: 'team_architect_firm',
  specEngineer: 'engineer',
  specTeamEngineerFirm: 'team_engineer_firm',

  // Property info
  specLotSizeSqft: 'lot_size_sqft',
  specLotSizeAcres: 'lot_size_acres',
  specZoning: 'zoning',
  specFloodZone: 'flood_zone',
  specParcelId: 'parcel_id',
  specLegalDescription: 'legal_description',

  // Timeline
  specPermitNumber: 'permit_number',
  specPermitDate: 'permit_date',
  specEstimatedStart: 'estimated_start',
  specEstimatedCompletion: 'estimated_completion',
  specActualStart: 'actual_start',
  specActualCompletion: 'actual_completion',

  // Notes
  specNotes: 'specs_notes'
};

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  // Sidebar integration
  if (window.JobSidebar) {
    window.JobSidebar.onJobChange((jobId) => {
      state.currentJobId = jobId;
      loadJobProfile();
    });

    state.currentJobId = window.JobSidebar.getSelectedJobId();
  }

  // Load profile if job selected
  if (state.currentJobId) {
    await loadJobProfile();
  } else {
    showNoJobSelected();
  }
});

// ============================================================
// DATA LOADING
// ============================================================

async function loadJobProfile() {
  if (!state.currentJobId) {
    showNoJobSelected();
    return;
  }

  try {
    // Load job details and plans in parallel
    const [jobRes, plansRes] = await Promise.all([
      fetch(`/api/jobs/${state.currentJobId}`),
      fetch(`/api/documents?job_id=${state.currentJobId}&category=plans`)
    ]);

    if (!jobRes.ok) throw new Error('Failed to load job');

    state.job = await jobRes.json();
    state.plans = await plansRes.json();

    renderProfile();
  } catch (err) {
    console.error('Failed to load job profile:', err);
    showToast('Failed to load job profile', 'error');
  }
}

// ============================================================
// RENDERING
// ============================================================

function showNoJobSelected() {
  document.getElementById('noJobSelected').style.display = 'flex';
  document.getElementById('profileContent').style.display = 'none';
  document.getElementById('editBtn').style.display = 'none';
  document.getElementById('extractBtn').style.display = 'none';
}

function renderProfile() {
  document.getElementById('noJobSelected').style.display = 'none';
  document.getElementById('profileContent').style.display = 'block';
  document.getElementById('editBtn').style.display = '';
  document.getElementById('extractBtn').style.display = '';

  const job = state.job;

  // Header
  document.getElementById('jobName').textContent = job.name || 'Unnamed Job';
  document.getElementById('jobAddress').textContent = job.address || 'No address';
  document.getElementById('jobStatus').textContent = formatStatus(job.status);
  document.getElementById('jobStatus').className = `status-badge status-${job.status || 'active'}`;

  // AI extraction badge
  if (job.specs_extracted_at) {
    document.getElementById('aiBadge').style.display = '';
    const confidence = job.specs_ai_confidence ? Math.round(job.specs_ai_confidence * 100) + '%' : '';
    document.getElementById('aiConfidence').textContent = confidence;
  } else {
    document.getElementById('aiBadge').style.display = 'none';
  }

  // Quick stats
  document.getElementById('statSqft').textContent = job.sqft_conditioned ? formatNumber(job.sqft_conditioned) : '--';
  document.getElementById('statBeds').textContent = job.bedrooms || '--';
  document.getElementById('statBaths').textContent = formatBaths(job.bathrooms, job.half_baths);
  document.getElementById('statStories').textContent = job.stories || '--';
  document.getElementById('statGarage').textContent = job.garage_spaces ? `${job.garage_spaces} car` : '--';
  document.getElementById('statAC').textContent = job.ac_tonnage || job.ac_units || '--';
  document.getElementById('statWindows').textContent = job.windows_total_count || '--';
  document.getElementById('statTrusses').textContent = job.struct_truss_count || '--';

  // Populate all spec fields
  for (const [inputId, dbField] of Object.entries(specFields)) {
    const input = document.getElementById(inputId);
    if (input) {
      const value = job[dbField];
      if (input.type === 'date') {
        input.value = value || '';
      } else if (input.tagName === 'SELECT') {
        // Handle boolean values for select elements
        if (value === true) {
          input.value = 'true';
        } else if (value === false) {
          input.value = 'false';
        } else {
          input.value = value || '';
        }
      } else {
        input.value = value ?? '';
      }
    }
  }

  // Financial summary (read-only calculated fields)
  const contractAmount = job.contract_amount || 0;
  const sqft = job.sqft_conditioned || 0;
  document.getElementById('specContractAmount').value = formatCurrency(contractAmount);
  document.getElementById('specCostPerSqft').value = sqft > 0 ? formatCurrency(contractAmount / sqft) + '/sqft' : '--';

  // Load budget summary for billed/complete
  loadFinancialSummary();

  // Related plans
  renderPlans();
}

async function loadFinancialSummary() {
  try {
    const res = await fetch(`/api/jobs/${state.currentJobId}/budget`);
    if (!res.ok) return;

    const budget = await res.json();
    const totalBilled = budget.lines?.reduce((sum, l) => sum + (l.billed_amount || 0), 0) || 0;
    const totalBudget = budget.lines?.reduce((sum, l) => sum + (l.budgeted_amount || 0), 0) || 0;
    const percentComplete = totalBudget > 0 ? Math.round((totalBilled / totalBudget) * 100) : 0;

    document.getElementById('specTotalBilled').value = formatCurrency(totalBilled);
    document.getElementById('specPercentComplete').value = percentComplete + '%';
  } catch (err) {
    console.error('Failed to load financial summary:', err);
  }
}

function renderPlans() {
  const container = document.getElementById('relatedPlans');

  if (!state.plans || state.plans.length === 0) {
    container.innerHTML = '<div class="empty-plans">No plans uploaded yet. <a href="documents.html">Upload plans</a></div>';
    return;
  }

  container.innerHTML = state.plans.slice(0, 6).map(plan => `
    <div class="plan-card" onclick="window.open('${plan.file_url}', '_blank')">
      <div class="plan-icon">📐</div>
      <div class="plan-name">${escapeHtml(plan.name)}</div>
      <div class="plan-date">${formatDate(plan.document_date || plan.created_at)}</div>
    </div>
  `).join('');
}

// ============================================================
// EDIT MODE
// ============================================================

function enableEdit() {
  state.isEditing = true;
  state.originalValues = {};

  // Store original values and enable inputs
  document.querySelectorAll('.spec-input').forEach(input => {
    if (!input.hasAttribute('readonly')) {
      state.originalValues[input.id] = input.value;
      input.disabled = false;
    }
  });

  document.getElementById('editBtn').style.display = 'none';
  document.getElementById('editFooter').style.display = 'flex';

  showToast('Edit mode enabled', 'info');
}

function cancelEdit() {
  state.isEditing = false;

  // Restore original values and disable inputs
  document.querySelectorAll('.spec-input').forEach(input => {
    if (!input.hasAttribute('readonly')) {
      if (state.originalValues[input.id] !== undefined) {
        input.value = state.originalValues[input.id];
      }
      input.disabled = true;
    }
  });

  document.getElementById('editBtn').style.display = '';
  document.getElementById('editFooter').style.display = 'none';
}

async function saveSpecs() {
  const updates = {};

  // Collect changed values
  for (const [inputId, dbField] of Object.entries(specFields)) {
    const input = document.getElementById(inputId);
    if (input && !input.hasAttribute('readonly')) {
      let value = input.value;

      // Convert empty strings to null
      if (value === '') value = null;

      // Convert numbers
      if (input.type === 'number' && value !== null) {
        value = parseFloat(value);
        if (isNaN(value)) value = null;
      }

      // Convert boolean selects
      if (input.tagName === 'SELECT' && (value === 'true' || value === 'false')) {
        value = value === 'true';
      }

      updates[dbField] = value;
    }
  }

  try {
    const res = await fetch(`/api/jobs/${state.currentJobId}/specs`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save');
    }

    // Disable inputs and exit edit mode
    document.querySelectorAll('.spec-input').forEach(input => {
      if (!input.hasAttribute('readonly')) {
        input.disabled = true;
      }
    });

    state.isEditing = false;
    document.getElementById('editBtn').style.display = '';
    document.getElementById('editFooter').style.display = 'none';

    // Reload profile
    await loadJobProfile();
    showToast('Specifications saved', 'success');
  } catch (err) {
    console.error('Save error:', err);
    showToast(err.message, 'error');
  }
}

// ============================================================
// AI EXTRACTION
// ============================================================

async function extractFromPlans() {
  // Load plans if not already loaded
  if (!state.plans || state.plans.length === 0) {
    try {
      const res = await fetch(`/api/documents?job_id=${state.currentJobId}&category=plans`);
      state.plans = await res.json();
    } catch (err) {
      console.error('Failed to load plans:', err);
    }
  }

  if (!state.plans || state.plans.length === 0) {
    showToast('No plans uploaded. Upload plans in Documents first.', 'error');
    return;
  }

  // Show modal with plan selection
  const listContainer = document.getElementById('planSelectList');

  // Add "Extract from ALL" option at top if multiple plans
  let allPlansOption = '';
  if (state.plans.length > 1) {
    allPlansOption = `
      <div class="plan-select-item plan-select-all" onclick="extractAllPlans()">
        <div class="plan-select-icon">🔍</div>
        <div class="plan-select-info">
          <div class="plan-select-name">Extract from ALL Plans (Recommended)</div>
          <div class="plan-select-meta">Combines data from ${state.plans.length} documents for most complete specs</div>
        </div>
      </div>
      <div class="plan-select-divider">Or select a single document:</div>
    `;
  }

  listContainer.innerHTML = allPlansOption + state.plans.map(plan => `
    <div class="plan-select-item" data-id="${plan.id}" data-url="${plan.file_url}" onclick="selectPlanForExtraction(this)">
      <div class="plan-select-icon">📐</div>
      <div class="plan-select-info">
        <div class="plan-select-name">${escapeHtml(plan.name)}</div>
        <div class="plan-select-meta">${plan.file_name} • ${formatDate(plan.created_at)}</div>
      </div>
    </div>
  `).join('');

  document.getElementById('extractionStatus').style.display = 'none';
  document.getElementById('extractionResults').style.display = 'none';
  document.getElementById('applyExtractionBtn').style.display = 'none';
  document.getElementById('extractModal').style.display = 'flex';
}

async function extractAllPlans() {
  // Remove previous selection
  document.querySelectorAll('.plan-select-item').forEach(item => {
    item.classList.remove('selected');
  });

  // Select the "all" option
  document.querySelector('.plan-select-all')?.classList.add('selected');

  document.getElementById('extractionStatus').style.display = 'flex';
  document.getElementById('extractionResults').style.display = 'none';
  document.getElementById('applyExtractionBtn').style.display = 'none';
  document.getElementById('extractionMessage').textContent = `Analyzing ${state.plans.length} plan documents...`;

  try {
    const res = await fetch(`/api/jobs/${state.currentJobId}/extract-all-specs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Extraction failed');
    }

    const result = await res.json();
    state.extractedData = result;

    // Show results
    document.getElementById('extractionStatus').style.display = 'none';
    document.getElementById('extractionResults').style.display = 'block';
    document.getElementById('applyExtractionBtn').style.display = '';

    // Render preview
    renderExtractionPreview(result);

  } catch (err) {
    console.error('Extraction error:', err);
    document.getElementById('extractionStatus').style.display = 'none';
    showToast(err.message, 'error');
  }
}

function selectPlanForExtraction(el) {
  // Remove previous selection
  document.querySelectorAll('.plan-select-item').forEach(item => {
    item.classList.remove('selected');
  });

  // Select this one
  el.classList.add('selected');

  // Start extraction
  const docId = el.dataset.id;
  const docUrl = el.dataset.url;
  runExtraction(docId, docUrl);
}

async function runExtraction(docId, docUrl) {
  document.getElementById('extractionStatus').style.display = 'flex';
  document.getElementById('extractionResults').style.display = 'none';
  document.getElementById('applyExtractionBtn').style.display = 'none';
  document.getElementById('extractionMessage').textContent = 'Analyzing architectural plans...';

  try {
    const res = await fetch('/api/jobs/extract-specs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: state.currentJobId,
        document_id: docId,
        document_url: docUrl
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Extraction failed');
    }

    const result = await res.json();
    state.extractedData = result;

    // Show results
    document.getElementById('extractionStatus').style.display = 'none';
    document.getElementById('extractionResults').style.display = 'block';
    document.getElementById('applyExtractionBtn').style.display = '';

    // Render preview
    renderExtractionPreview(result);

  } catch (err) {
    console.error('Extraction error:', err);
    document.getElementById('extractionStatus').style.display = 'none';
    showToast(err.message, 'error');
  }
}

function renderExtractionPreview(data) {
  const preview = document.getElementById('extractionPreview');
  const specs = data.specs || {};

  const buildingRows = [];
  const structuralRows = [];
  const windowsDoorsRows = [];
  const electricalRows = [];
  const plumbingRows = [];
  const hvacRows = [];
  const roofingRows = [];
  const codeRows = [];
  const teamRows = [];

  // Building specs
  if (specs.sqft_conditioned) buildingRows.push(`<tr><td>Conditioned Sq Ft</td><td>${formatNumber(specs.sqft_conditioned)}</td></tr>`);
  if (specs.sqft_total) buildingRows.push(`<tr><td>Total Sq Ft</td><td>${formatNumber(specs.sqft_total)}</td></tr>`);
  if (specs.sqft_garage) buildingRows.push(`<tr><td>Garage Sq Ft</td><td>${formatNumber(specs.sqft_garage)}</td></tr>`);
  if (specs.sqft_covered) buildingRows.push(`<tr><td>Covered Sq Ft</td><td>${formatNumber(specs.sqft_covered)}</td></tr>`);
  if (specs.bedrooms) buildingRows.push(`<tr><td>Bedrooms</td><td>${specs.bedrooms}</td></tr>`);
  if (specs.bathrooms) buildingRows.push(`<tr><td>Bathrooms</td><td>${specs.bathrooms}</td></tr>`);
  if (specs.half_baths) buildingRows.push(`<tr><td>Half Baths</td><td>${specs.half_baths}</td></tr>`);
  if (specs.stories) buildingRows.push(`<tr><td>Stories</td><td>${specs.stories}</td></tr>`);
  if (specs.garage_spaces) buildingRows.push(`<tr><td>Garage Spaces</td><td>${specs.garage_spaces}</td></tr>`);
  if (specs.pool_type) buildingRows.push(`<tr><td>Pool</td><td>${formatEnumValue(specs.pool_type)}</td></tr>`);
  if (specs.construction_type) buildingRows.push(`<tr><td>Construction Type</td><td>${formatEnumValue(specs.construction_type)}</td></tr>`);
  if (specs.foundation_type) buildingRows.push(`<tr><td>Foundation</td><td>${formatEnumValue(specs.foundation_type)}</td></tr>`);
  if (specs.exterior_finish) buildingRows.push(`<tr><td>Exterior Finish</td><td>${formatEnumValue(specs.exterior_finish)}</td></tr>`);
  if (specs.ceiling_height_main) buildingRows.push(`<tr><td>Ceiling Height</td><td>${specs.ceiling_height_main} ft</td></tr>`);

  // Structural
  if (specs.struct_pier_count) structuralRows.push(`<tr><td>Pier Count</td><td>${specs.struct_pier_count}</td></tr>`);
  if (specs.struct_pier_depth) structuralRows.push(`<tr><td>Pier Depth</td><td>${specs.struct_pier_depth} ft</td></tr>`);
  if (specs.struct_concrete_psi) structuralRows.push(`<tr><td>Concrete PSI</td><td>${formatNumber(specs.struct_concrete_psi)}</td></tr>`);
  if (specs.struct_concrete_yards) structuralRows.push(`<tr><td>Concrete (CY)</td><td>${specs.struct_concrete_yards}</td></tr>`);
  if (specs.struct_rebar_tons) structuralRows.push(`<tr><td>Rebar (tons)</td><td>${specs.struct_rebar_tons}</td></tr>`);
  if (specs.struct_wood_beam_count) structuralRows.push(`<tr><td>Wood Beams</td><td>${specs.struct_wood_beam_count}</td></tr>`);
  if (specs.struct_lvl_beam_count) structuralRows.push(`<tr><td>LVL Beams</td><td>${specs.struct_lvl_beam_count}</td></tr>`);
  if (specs.struct_truss_count) structuralRows.push(`<tr><td>Truss Count</td><td>${specs.struct_truss_count}</td></tr>`);
  if (specs.struct_truss_span_max) structuralRows.push(`<tr><td>Max Truss Span</td><td>${specs.struct_truss_span_max} ft</td></tr>`);
  if (specs.struct_wall_framing) structuralRows.push(`<tr><td>Wall Framing</td><td>${specs.struct_wall_framing}</td></tr>`);
  if (specs.struct_sheathing_type) structuralRows.push(`<tr><td>Sheathing</td><td>${specs.struct_sheathing_type}</td></tr>`);
  if (specs.struct_roof_pitch) structuralRows.push(`<tr><td>Roof Pitch</td><td>${specs.struct_roof_pitch}</td></tr>`);
  if (specs.mat_framing_bf) structuralRows.push(`<tr><td>Est. Framing (BF)</td><td>${formatNumber(specs.mat_framing_bf)}</td></tr>`);
  if (specs.struct_wind_speed) structuralRows.push(`<tr><td>Wind Speed</td><td>${specs.struct_wind_speed} mph</td></tr>`);
  if (specs.struct_exposure_category) structuralRows.push(`<tr><td>Exposure Category</td><td>${specs.struct_exposure_category}</td></tr>`);
  if (specs.struct_live_load_floor) structuralRows.push(`<tr><td>Floor Live Load</td><td>${specs.struct_live_load_floor} PSF</td></tr>`);

  // Windows & Doors
  if (specs.windows_total_count) windowsDoorsRows.push(`<tr><td>Total Windows</td><td>${specs.windows_total_count}</td></tr>`);
  if (specs.windows_impact_rated != null) windowsDoorsRows.push(`<tr><td>Impact Rated Windows</td><td>${specs.windows_impact_rated ? 'Yes' : 'No'}</td></tr>`);
  if (specs.doors_exterior_count) windowsDoorsRows.push(`<tr><td>Exterior Doors</td><td>${specs.doors_exterior_count}</td></tr>`);
  if (specs.doors_interior_count) windowsDoorsRows.push(`<tr><td>Interior Doors</td><td>${specs.doors_interior_count}</td></tr>`);
  if (specs.doors_garage_count) windowsDoorsRows.push(`<tr><td>Garage Doors</td><td>${specs.doors_garage_count}</td></tr>`);
  if (specs.doors_impact_rated != null) windowsDoorsRows.push(`<tr><td>Impact Rated Doors</td><td>${specs.doors_impact_rated ? 'Yes' : 'No'}</td></tr>`);

  // Electrical
  if (specs.elec_service_amps) electricalRows.push(`<tr><td>Service (Amps)</td><td>${specs.elec_service_amps}</td></tr>`);
  if (specs.elec_panel_count) electricalRows.push(`<tr><td>Panel Count</td><td>${specs.elec_panel_count}</td></tr>`);
  if (specs.elec_outlets_count) electricalRows.push(`<tr><td>Est. Outlets</td><td>${specs.elec_outlets_count}</td></tr>`);
  if (specs.elec_lighting_fixtures) electricalRows.push(`<tr><td>Lighting Fixtures</td><td>${specs.elec_lighting_fixtures}</td></tr>`);
  if (specs.elec_recessed_lights) electricalRows.push(`<tr><td>Recessed Lights</td><td>${specs.elec_recessed_lights}</td></tr>`);
  if (specs.elec_ceiling_fans) electricalRows.push(`<tr><td>Ceiling Fans</td><td>${specs.elec_ceiling_fans}</td></tr>`);
  if (specs.elec_generator_ready != null) electricalRows.push(`<tr><td>Generator Ready</td><td>${specs.elec_generator_ready ? 'Yes' : 'No'}</td></tr>`);
  if (specs.elec_solar_ready != null) electricalRows.push(`<tr><td>Solar Ready</td><td>${specs.elec_solar_ready ? 'Yes' : 'No'}</td></tr>`);

  // Plumbing
  if (specs.plumb_toilets) plumbingRows.push(`<tr><td>Toilets</td><td>${specs.plumb_toilets}</td></tr>`);
  if (specs.plumb_sinks) plumbingRows.push(`<tr><td>Sinks</td><td>${specs.plumb_sinks}</td></tr>`);
  if (specs.plumb_showers) plumbingRows.push(`<tr><td>Showers</td><td>${specs.plumb_showers}</td></tr>`);
  if (specs.plumb_tubs) plumbingRows.push(`<tr><td>Tubs</td><td>${specs.plumb_tubs}</td></tr>`);
  if (specs.plumb_water_heater_type) plumbingRows.push(`<tr><td>Water Heater</td><td>${formatEnumValue(specs.plumb_water_heater_type)}</td></tr>`);
  if (specs.plumb_gas_line != null) plumbingRows.push(`<tr><td>Gas Line</td><td>${specs.plumb_gas_line ? 'Yes' : 'No'}</td></tr>`);

  // HVAC
  if (specs.ac_units) hvacRows.push(`<tr><td>AC Units</td><td>${specs.ac_units}</td></tr>`);
  if (specs.ac_tonnage) hvacRows.push(`<tr><td>AC Tonnage</td><td>${specs.ac_tonnage} ton</td></tr>`);
  if (specs.hvac_system_type) hvacRows.push(`<tr><td>System Type</td><td>${formatEnumValue(specs.hvac_system_type)}</td></tr>`);
  if (specs.hvac_fuel_type) hvacRows.push(`<tr><td>Fuel Type</td><td>${formatEnumValue(specs.hvac_fuel_type)}</td></tr>`);
  if (specs.hvac_zones) hvacRows.push(`<tr><td>Zones</td><td>${specs.hvac_zones}</td></tr>`);
  if (specs.hvac_seer_rating) hvacRows.push(`<tr><td>SEER Rating</td><td>${specs.hvac_seer_rating}</td></tr>`);

  // Roofing
  if (specs.roof_sqft) roofingRows.push(`<tr><td>Roof Area</td><td>${formatNumber(specs.roof_sqft)} sq ft</td></tr>`);
  if (specs.roof_squares) roofingRows.push(`<tr><td>Roof Squares</td><td>${specs.roof_squares}</td></tr>`);
  if (specs.roof_material) roofingRows.push(`<tr><td>Roof Material</td><td>${specs.roof_material}</td></tr>`);
  if (specs.roof_type) roofingRows.push(`<tr><td>Roof Type</td><td>${formatEnumValue(specs.roof_type)}</td></tr>`);
  if (specs.roof_skylights) roofingRows.push(`<tr><td>Skylights</td><td>${specs.roof_skylights}</td></tr>`);

  // Code & Design
  if (specs.code_building_code) codeRows.push(`<tr><td>Building Code</td><td>${specs.code_building_code}</td></tr>`);
  if (specs.code_construction_type) codeRows.push(`<tr><td>Construction Type</td><td>${specs.code_construction_type}</td></tr>`);
  if (specs.code_fire_sprinklers != null) codeRows.push(`<tr><td>Fire Sprinklers</td><td>${specs.code_fire_sprinklers ? 'Required' : 'Not Required'}</td></tr>`);

  // Team
  if (specs.architect) teamRows.push(`<tr><td>Architect</td><td>${specs.architect}</td></tr>`);
  if (specs.team_architect_firm) teamRows.push(`<tr><td>Architect Firm</td><td>${specs.team_architect_firm}</td></tr>`);
  if (specs.engineer) teamRows.push(`<tr><td>Engineer</td><td>${specs.engineer}</td></tr>`);
  if (specs.team_engineer_firm) teamRows.push(`<tr><td>Engineer Firm</td><td>${specs.team_engineer_firm}</td></tr>`);

  let html = `<div class="extraction-confidence">AI Confidence: ${Math.round((data.confidence || 0) * 100)}%</div>`;

  if (data.documents_analyzed) {
    html += `<div class="extraction-info">Analyzed ${data.documents_analyzed} document(s)</div>`;
  }

  // Build sections dynamically - only show sections with data
  const sections = [
    { title: 'Building Specs', rows: buildingRows },
    { title: 'Structural', rows: structuralRows },
    { title: 'Windows & Doors', rows: windowsDoorsRows },
    { title: 'Electrical', rows: electricalRows },
    { title: 'Plumbing', rows: plumbingRows },
    { title: 'HVAC', rows: hvacRows },
    { title: 'Roofing', rows: roofingRows },
    { title: 'Code & Design', rows: codeRows },
    { title: 'Project Team', rows: teamRows }
  ];

  let totalRows = 0;
  for (const section of sections) {
    if (section.rows.length > 0) {
      html += `<div class="extraction-section"><div class="extraction-section-title">${section.title}</div><table class="extraction-table"><tbody>${section.rows.join('')}</tbody></table></div>`;
      totalRows += section.rows.length;
    }
  }

  if (totalRows === 0) {
    html += `<div class="extraction-empty">No specs extracted from document</div>`;
  }

  if (specs._notes) {
    html += `<div class="extraction-notes"><strong>AI Notes:</strong> ${escapeHtml(specs._notes)}</div>`;
  }

  preview.innerHTML = html;
}

function formatEnumValue(val) {
  if (!val) return '';
  return val.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

async function applyExtraction() {
  if (!state.extractedData?.specs) {
    showToast('No extraction data to apply', 'error');
    return;
  }

  try {
    const res = await fetch(`/api/jobs/${state.currentJobId}/specs`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...state.extractedData.specs,
        specs_extracted_at: new Date().toISOString(),
        specs_source_document_id: state.extractedData.document_id,
        specs_ai_confidence: state.extractedData.confidence
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to apply');
    }

    closeExtractModal();
    await loadJobProfile();
    showToast('AI specs applied to profile', 'success');
  } catch (err) {
    console.error('Apply error:', err);
    showToast(err.message, 'error');
  }
}

function closeExtractModal() {
  document.getElementById('extractModal').style.display = 'none';
  state.extractedData = null;
}

// ============================================================
// NAVIGATION
// ============================================================

function goToDocuments(category) {
  window.location.href = `documents.html?category=${category}`;
}

// ============================================================
// HELPERS
// ============================================================

function formatStatus(status) {
  const labels = {
    active: 'Active',
    completed: 'Completed',
    on_hold: 'On Hold',
    cancelled: 'Cancelled'
  };
  return labels[status] || status || 'Active';
}

function formatBaths(full, half) {
  if (!full && !half) return '--';
  if (!half) return full.toString();
  return `${full}/${half}`;
}

function formatNumber(num) {
  if (num === null || num === undefined) return '--';
  return num.toLocaleString();
}

function formatCurrency(amount) {
  if (amount === null || amount === undefined) return '--';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
