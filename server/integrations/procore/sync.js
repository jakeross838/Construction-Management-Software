/**
 * Procore Sync Module
 * Handles two-way synchronization of jobs, vendors, RFIs, and submittals
 */

const { supabase } = require('../../../config');
const { AppError } = require('../../core/errors');
const { getValidConnection, procoreApiRequest } = require('./auth');
const crypto = require('crypto');

// ============================================================
// ENTITY MAPPERS - Procore <-> Local field mapping
// ============================================================

/**
 * Map Procore project to local job format
 */
function mapProcoreProjectToJob(project, builderId) {
  return {
    name: project.name,
    address: project.address || null,
    city: project.city || null,
    state: project.state_code || null,
    zip: project.zip || null,
    client_name: project.project_number || null,  // Use project number as reference
    contract_amount: project.total_value ? parseFloat(project.total_value) : null,
    status: mapProcoreProjectStatus(project.stage),
    notes: project.description || null,
    builder_id: builderId,
    // Procore-specific metadata
    external_data: {
      procore_id: project.id,
      procore_project_number: project.project_number,
      procore_stage: project.stage,
      last_synced: new Date().toISOString(),
    },
  };
}

/**
 * Map local job to Procore project format
 */
function mapJobToProcoreProject(job) {
  return {
    project: {
      name: job.name,
      address: job.address || undefined,
      city: job.city || undefined,
      state_code: job.state || undefined,
      zip: job.zip || undefined,
      project_number: job.client_name || undefined,
      description: job.notes || undefined,
      total_value: job.contract_amount ? String(job.contract_amount) : undefined,
      stage: mapLocalStatusToProcoreStage(job.status),
    },
  };
}

/**
 * Map Procore vendor to local vendor format
 */
function mapProcoreVendorToLocal(vendor, builderId) {
  return {
    name: vendor.name,
    email: vendor.email_address || null,
    phone: vendor.business_phone || vendor.mobile_phone || null,
    address: vendor.address || null,
    city: vendor.city || null,
    state: vendor.state_code || null,
    zip: vendor.zip || null,
    license_number: vendor.license_number || null,
    builder_id: builderId,
    external_data: {
      procore_id: vendor.id,
      procore_vendor_type: vendor.vendor_type,
      last_synced: new Date().toISOString(),
    },
  };
}

/**
 * Map local vendor to Procore vendor format
 */
function mapLocalVendorToProcore(vendor) {
  return {
    vendor: {
      name: vendor.name,
      email_address: vendor.email || undefined,
      business_phone: vendor.phone || undefined,
      address: vendor.address || undefined,
      city: vendor.city || undefined,
      state_code: vendor.state || undefined,
      zip: vendor.zip || undefined,
      license_number: vendor.license_number || undefined,
    },
  };
}

/**
 * Map Procore RFI to local RFI format
 */
function mapProcoreRFIToLocal(rfi, builderId, jobId) {
  return {
    job_id: jobId,
    number: rfi.number || String(rfi.id),
    subject: rfi.subject,
    question: rfi.question || rfi.description,
    answer: rfi.answer || null,
    status: mapProcoreRFIStatus(rfi.status),
    priority: rfi.priority || 'normal',
    due_date: rfi.due_date || null,
    responded_at: rfi.answered_at || null,
    created_by: rfi.created_by?.name || null,
    assignee_name: rfi.assignee?.name || null,
    builder_id: builderId,
    external_data: {
      procore_id: rfi.id,
      procore_status: rfi.status,
      last_synced: new Date().toISOString(),
    },
  };
}

/**
 * Map Procore submittal to local submittal format
 */
function mapProcoreSubmittalToLocal(submittal, builderId, jobId) {
  return {
    job_id: jobId,
    number: submittal.number || String(submittal.id),
    title: submittal.title,
    description: submittal.description || null,
    spec_section: submittal.specification_section?.number || null,
    status: mapProcoreSubmittalStatus(submittal.status),
    due_date: submittal.due_date || null,
    submitted_date: submittal.received_date || null,
    approved_date: submittal.approved_date || null,
    ball_in_court: submittal.ball_in_court?.name || null,
    builder_id: builderId,
    external_data: {
      procore_id: submittal.id,
      procore_status: submittal.status,
      last_synced: new Date().toISOString(),
    },
  };
}

// ============================================================
// STATUS MAPPERS
// ============================================================

function mapProcoreProjectStatus(stage) {
  const statusMap = {
    'Pre-Construction': 'planning',
    'Construction': 'active',
    'Post-Construction': 'closeout',
    'Closed': 'completed',
    'Warranty': 'warranty',
  };
  return statusMap[stage] || 'active';
}

function mapLocalStatusToProcoreStage(status) {
  const stageMap = {
    'planning': 'Pre-Construction',
    'active': 'Construction',
    'closeout': 'Post-Construction',
    'completed': 'Closed',
    'on_hold': 'Construction',
    'warranty': 'Warranty',
  };
  return stageMap[status] || 'Construction';
}

function mapProcoreRFIStatus(status) {
  const statusMap = {
    'draft': 'draft',
    'open': 'open',
    'closed': 'closed',
    'answered': 'answered',
    'void': 'closed',
  };
  return statusMap[status?.toLowerCase()] || 'open';
}

function mapProcoreSubmittalStatus(status) {
  const statusMap = {
    'draft': 'draft',
    'pending': 'pending',
    'submitted': 'submitted',
    'approved': 'approved',
    'approved_as_noted': 'approved_as_noted',
    'rejected': 'rejected',
    'revise_and_resubmit': 'revise_resubmit',
    'closed': 'closed',
  };
  return statusMap[status?.toLowerCase()] || 'pending';
}

// ============================================================
// SYNC HELPER FUNCTIONS
// ============================================================

/**
 * Create a hash of entity data for change detection
 */
function createEntityHash(entity) {
  const sortedKeys = Object.keys(entity).sort();
  const normalized = {};
  for (const key of sortedKeys) {
    if (key !== 'external_data' && key !== 'created_at' && key !== 'updated_at') {
      normalized[key] = entity[key];
    }
  }
  return crypto.createHash('md5').update(JSON.stringify(normalized)).digest('hex');
}

/**
 * Create a sync log entry
 */
async function createSyncLog(integrationId, builderId, syncType, direction) {
  const { data, error } = await supabase
    .from('v2_procore_sync_log')
    .insert({
      integration_id: integrationId,
      builder_id: builderId,
      sync_type: syncType,
      direction: direction,
      status: 'in_progress',
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('[Procore Sync] Failed to create sync log:', error);
    return null;
  }
  return data;
}

/**
 * Update sync log with results
 */
async function updateSyncLog(logId, stats, status = 'success') {
  await supabase
    .from('v2_procore_sync_log')
    .update({
      status: status,
      records_synced: stats.synced || 0,
      records_created: stats.created || 0,
      records_updated: stats.updated || 0,
      records_failed: stats.failed || 0,
      errors: stats.errors?.length > 0 ? { errors: stats.errors } : null,
      completed_at: new Date().toISOString(),
    })
    .eq('id', logId);
}

/**
 * Get or create entity mapping
 */
async function getEntityMapping(builderId, entityType, localId = null, procoreId = null) {
  let query = supabase
    .from('v2_procore_entity_map')
    .select('*')
    .eq('builder_id', builderId)
    .eq('entity_type', entityType);

  if (localId) {
    query = query.eq('local_id', localId);
  } else if (procoreId) {
    query = query.eq('procore_id', procoreId);
  }

  const { data } = await query.single();
  return data;
}

/**
 * Create or update entity mapping
 */
async function upsertEntityMapping(builderId, entityType, localId, procoreId, projectId = null, hash = null) {
  const { error } = await supabase
    .from('v2_procore_entity_map')
    .upsert({
      builder_id: builderId,
      entity_type: entityType,
      local_id: localId,
      procore_id: procoreId,
      procore_project_id: projectId,
      sync_hash: hash,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'builder_id, entity_type, local_id' });

  if (error) {
    console.error('[Procore Sync] Failed to upsert entity mapping:', error);
  }
}

// ============================================================
// SYNC FUNCTIONS
// ============================================================

/**
 * Sync jobs/projects from Procore (import only for now)
 * @param {string} builderId - The builder ID
 * @returns {Object} Sync results
 */
async function syncJobs(builderId) {
  const connection = await getValidConnection(builderId);
  const syncLog = await createSyncLog(connection.id, builderId, 'jobs', 'import');

  const stats = { synced: 0, created: 0, updated: 0, failed: 0, errors: [] };

  try {
    // Fetch projects from Procore
    const projects = await procoreApiRequest(
      connection,
      'GET',
      `/rest/v1.0/projects`,
      null,
      { company_id: connection.company_id, per_page: 100 }
    );

    console.log(`[Procore Sync] Found ${projects.length} projects to sync`);

    for (const project of projects) {
      try {
        // Check if already mapped
        const existing = await getEntityMapping(builderId, 'job', null, String(project.id));

        if (existing) {
          // Update existing job
          const jobData = mapProcoreProjectToJob(project, builderId);
          delete jobData.builder_id; // Don't update builder_id

          const { error } = await supabase
            .from('v2_jobs')
            .update(jobData)
            .eq('id', existing.local_id);

          if (error) throw error;

          await upsertEntityMapping(
            builderId, 'job', existing.local_id, String(project.id), null, createEntityHash(jobData)
          );

          stats.updated++;
        } else {
          // Create new job
          const jobData = mapProcoreProjectToJob(project, builderId);

          const { data: newJob, error } = await supabase
            .from('v2_jobs')
            .insert(jobData)
            .select('id')
            .single();

          if (error) throw error;

          await upsertEntityMapping(
            builderId, 'job', newJob.id, String(project.id), null, createEntityHash(jobData)
          );

          stats.created++;
        }

        stats.synced++;
      } catch (err) {
        stats.failed++;
        stats.errors.push({
          procore_id: project.id,
          name: project.name,
          error: err.message,
        });
      }
    }

    // Update last sync time
    await supabase
      .from('v2_procore_integrations')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', connection.id);

    await updateSyncLog(syncLog?.id, stats, 'success');
    return stats;

  } catch (err) {
    console.error('[Procore Sync] Jobs sync failed:', err);
    await updateSyncLog(syncLog?.id, { ...stats, errors: [{ error: err.message }] }, 'failed');
    throw err;
  }
}

/**
 * Sync vendors from Procore (import only for now)
 * @param {string} builderId - The builder ID
 * @returns {Object} Sync results
 */
async function syncVendors(builderId) {
  const connection = await getValidConnection(builderId);
  const syncLog = await createSyncLog(connection.id, builderId, 'vendors', 'import');

  const stats = { synced: 0, created: 0, updated: 0, failed: 0, errors: [] };

  try {
    // Fetch vendors from Procore company directory
    const vendors = await procoreApiRequest(
      connection,
      'GET',
      `/rest/v1.0/companies/${connection.company_id}/vendors`,
      null,
      { per_page: 250 }
    );

    console.log(`[Procore Sync] Found ${vendors.length} vendors to sync`);

    for (const vendor of vendors) {
      try {
        const existing = await getEntityMapping(builderId, 'vendor', null, String(vendor.id));

        if (existing) {
          // Update existing vendor
          const vendorData = mapProcoreVendorToLocal(vendor, builderId);
          delete vendorData.builder_id;

          const { error } = await supabase
            .from('v2_vendors')
            .update(vendorData)
            .eq('id', existing.local_id);

          if (error) throw error;

          await upsertEntityMapping(
            builderId, 'vendor', existing.local_id, String(vendor.id), null, createEntityHash(vendorData)
          );

          stats.updated++;
        } else {
          // Create new vendor
          const vendorData = mapProcoreVendorToLocal(vendor, builderId);

          const { data: newVendor, error } = await supabase
            .from('v2_vendors')
            .insert(vendorData)
            .select('id')
            .single();

          if (error) throw error;

          await upsertEntityMapping(
            builderId, 'vendor', newVendor.id, String(vendor.id), null, createEntityHash(vendorData)
          );

          stats.created++;
        }

        stats.synced++;
      } catch (err) {
        stats.failed++;
        stats.errors.push({
          procore_id: vendor.id,
          name: vendor.name,
          error: err.message,
        });
      }
    }

    await updateSyncLog(syncLog?.id, stats, 'success');
    return stats;

  } catch (err) {
    console.error('[Procore Sync] Vendors sync failed:', err);
    await updateSyncLog(syncLog?.id, { ...stats, errors: [{ error: err.message }] }, 'failed');
    throw err;
  }
}

/**
 * Sync RFIs from Procore (read-only import)
 * @param {string} builderId - The builder ID
 * @param {string} jobId - Optional specific job to sync
 * @returns {Object} Sync results
 */
async function syncRFIs(builderId, jobId = null) {
  const connection = await getValidConnection(builderId);
  const syncLog = await createSyncLog(connection.id, builderId, 'rfis', 'import');

  const stats = { synced: 0, created: 0, updated: 0, failed: 0, errors: [] };

  try {
    // Get jobs to sync RFIs for
    let jobMappings = [];
    if (jobId) {
      const mapping = await getEntityMapping(builderId, 'job', jobId);
      if (mapping) {
        jobMappings = [mapping];
      }
    } else {
      const { data } = await supabase
        .from('v2_procore_entity_map')
        .select('*')
        .eq('builder_id', builderId)
        .eq('entity_type', 'job');
      jobMappings = data || [];
    }

    for (const jobMapping of jobMappings) {
      try {
        // Fetch RFIs for this project
        const rfis = await procoreApiRequest(
          connection,
          'GET',
          `/rest/v1.0/projects/${jobMapping.procore_id}/rfis`,
          null,
          { per_page: 100 }
        );

        for (const rfi of rfis) {
          try {
            const existing = await getEntityMapping(builderId, 'rfi', null, String(rfi.id));

            if (existing) {
              // Update existing RFI
              const rfiData = mapProcoreRFIToLocal(rfi, builderId, jobMapping.local_id);
              delete rfiData.builder_id;
              delete rfiData.job_id;

              const { error } = await supabase
                .from('v2_rfis')
                .update(rfiData)
                .eq('id', existing.local_id);

              if (error) throw error;

              await upsertEntityMapping(
                builderId, 'rfi', existing.local_id, String(rfi.id), jobMapping.procore_id
              );

              stats.updated++;
            } else {
              // Create new RFI
              const rfiData = mapProcoreRFIToLocal(rfi, builderId, jobMapping.local_id);

              const { data: newRFI, error } = await supabase
                .from('v2_rfis')
                .insert(rfiData)
                .select('id')
                .single();

              if (error) throw error;

              await upsertEntityMapping(
                builderId, 'rfi', newRFI.id, String(rfi.id), jobMapping.procore_id
              );

              stats.created++;
            }

            stats.synced++;
          } catch (err) {
            stats.failed++;
            stats.errors.push({
              procore_id: rfi.id,
              subject: rfi.subject,
              error: err.message,
            });
          }
        }
      } catch (err) {
        console.error(`[Procore Sync] Failed to sync RFIs for project ${jobMapping.procore_id}:`, err);
        stats.errors.push({
          project_id: jobMapping.procore_id,
          error: err.message,
        });
      }
    }

    await updateSyncLog(syncLog?.id, stats, stats.errors.length > 0 && stats.synced === 0 ? 'failed' : 'success');
    return stats;

  } catch (err) {
    console.error('[Procore Sync] RFIs sync failed:', err);
    await updateSyncLog(syncLog?.id, { ...stats, errors: [{ error: err.message }] }, 'failed');
    throw err;
  }
}

/**
 * Sync submittals from Procore (read-only import)
 * @param {string} builderId - The builder ID
 * @param {string} jobId - Optional specific job to sync
 * @returns {Object} Sync results
 */
async function syncSubmittals(builderId, jobId = null) {
  const connection = await getValidConnection(builderId);
  const syncLog = await createSyncLog(connection.id, builderId, 'submittals', 'import');

  const stats = { synced: 0, created: 0, updated: 0, failed: 0, errors: [] };

  try {
    // Get jobs to sync submittals for
    let jobMappings = [];
    if (jobId) {
      const mapping = await getEntityMapping(builderId, 'job', jobId);
      if (mapping) {
        jobMappings = [mapping];
      }
    } else {
      const { data } = await supabase
        .from('v2_procore_entity_map')
        .select('*')
        .eq('builder_id', builderId)
        .eq('entity_type', 'job');
      jobMappings = data || [];
    }

    for (const jobMapping of jobMappings) {
      try {
        // Fetch submittals for this project
        const submittals = await procoreApiRequest(
          connection,
          'GET',
          `/rest/v1.0/projects/${jobMapping.procore_id}/submittals`,
          null,
          { per_page: 100 }
        );

        for (const submittal of submittals) {
          try {
            const existing = await getEntityMapping(builderId, 'submittal', null, String(submittal.id));

            if (existing) {
              // Update existing submittal
              const submittalData = mapProcoreSubmittalToLocal(submittal, builderId, jobMapping.local_id);
              delete submittalData.builder_id;
              delete submittalData.job_id;

              const { error } = await supabase
                .from('v2_submittals')
                .update(submittalData)
                .eq('id', existing.local_id);

              if (error) throw error;

              await upsertEntityMapping(
                builderId, 'submittal', existing.local_id, String(submittal.id), jobMapping.procore_id
              );

              stats.updated++;
            } else {
              // Create new submittal
              const submittalData = mapProcoreSubmittalToLocal(submittal, builderId, jobMapping.local_id);

              const { data: newSubmittal, error } = await supabase
                .from('v2_submittals')
                .insert(submittalData)
                .select('id')
                .single();

              if (error) throw error;

              await upsertEntityMapping(
                builderId, 'submittal', newSubmittal.id, String(submittal.id), jobMapping.procore_id
              );

              stats.created++;
            }

            stats.synced++;
          } catch (err) {
            stats.failed++;
            stats.errors.push({
              procore_id: submittal.id,
              title: submittal.title,
              error: err.message,
            });
          }
        }
      } catch (err) {
        console.error(`[Procore Sync] Failed to sync submittals for project ${jobMapping.procore_id}:`, err);
        stats.errors.push({
          project_id: jobMapping.procore_id,
          error: err.message,
        });
      }
    }

    await updateSyncLog(syncLog?.id, stats, stats.errors.length > 0 && stats.synced === 0 ? 'failed' : 'success');
    return stats;

  } catch (err) {
    console.error('[Procore Sync] Submittals sync failed:', err);
    await updateSyncLog(syncLog?.id, { ...stats, errors: [{ error: err.message }] }, 'failed');
    throw err;
  }
}

/**
 * Run a full sync of all entity types
 * @param {string} builderId - The builder ID
 * @returns {Object} Combined sync results
 */
async function fullSync(builderId) {
  const connection = await getValidConnection(builderId);
  const settings = connection.sync_settings || {};

  const results = {
    jobs: null,
    vendors: null,
    rfis: null,
    submittals: null,
    totalSynced: 0,
    totalCreated: 0,
    totalUpdated: 0,
    totalFailed: 0,
  };

  // Sync jobs first (needed for RFIs and submittals)
  if (settings.sync_jobs !== false) {
    try {
      results.jobs = await syncJobs(builderId);
      results.totalSynced += results.jobs.synced;
      results.totalCreated += results.jobs.created;
      results.totalUpdated += results.jobs.updated;
      results.totalFailed += results.jobs.failed;
    } catch (err) {
      results.jobs = { error: err.message };
    }
  }

  // Sync vendors
  if (settings.sync_vendors !== false) {
    try {
      results.vendors = await syncVendors(builderId);
      results.totalSynced += results.vendors.synced;
      results.totalCreated += results.vendors.created;
      results.totalUpdated += results.vendors.updated;
      results.totalFailed += results.vendors.failed;
    } catch (err) {
      results.vendors = { error: err.message };
    }
  }

  // Sync RFIs
  if (settings.sync_rfis !== false) {
    try {
      results.rfis = await syncRFIs(builderId);
      results.totalSynced += results.rfis.synced;
      results.totalCreated += results.rfis.created;
      results.totalUpdated += results.rfis.updated;
      results.totalFailed += results.rfis.failed;
    } catch (err) {
      results.rfis = { error: err.message };
    }
  }

  // Sync submittals
  if (settings.sync_submittals !== false) {
    try {
      results.submittals = await syncSubmittals(builderId);
      results.totalSynced += results.submittals.synced;
      results.totalCreated += results.submittals.created;
      results.totalUpdated += results.submittals.updated;
      results.totalFailed += results.submittals.failed;
    } catch (err) {
      results.submittals = { error: err.message };
    }
  }

  return results;
}

module.exports = {
  // Mappers
  mapProcoreProjectToJob,
  mapJobToProcoreProject,
  mapProcoreVendorToLocal,
  mapLocalVendorToProcore,
  mapProcoreRFIToLocal,
  mapProcoreSubmittalToLocal,

  // Sync functions
  syncJobs,
  syncVendors,
  syncRFIs,
  syncSubmittals,
  fullSync,

  // Helpers
  getEntityMapping,
  upsertEntityMapping,
  createEntityHash,
};
