/**
 * Inspections Routes
 * Building inspections scheduling, tracking, and deficiency management
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { supabase } = require('../../config');

// Configure multer for photo uploads
const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, GIF, WebP, HEIC) are allowed'));
    }
  }
});

// Use existing 'invoices' bucket with subfolder for inspection photos
const PHOTO_BUCKET = 'invoices';
const PHOTO_PREFIX = 'inspection-photos';

// Common inspection types for suggestions
const INSPECTION_TYPES = [
  'Foundation',
  'Slab',
  'Framing',
  'Electrical Rough',
  'Plumbing Rough',
  'HVAC Rough',
  'Insulation',
  'Drywall',
  'Electrical Final',
  'Plumbing Final',
  'HVAC Final',
  'Roofing',
  'Fire',
  'Building Final',
  'Certificate of Occupancy',
  'Pool',
  'Septic',
  'Impact Fee',
  'Other'
];

// ============================================================
// GET INSPECTION TYPES
// ============================================================

router.get('/types', (req, res) => {
  res.json(INSPECTION_TYPES);
});

// ============================================================
// LIST INSPECTIONS
// ============================================================

router.get('/', async (req, res) => {
  try {
    let query = supabase
      .from('v2_inspections')
      .select(`
        *,
        job:v2_jobs(id, name, address),
        deficiencies:v2_inspection_deficiencies(id, description, severity, status)
      `)
      .is('deleted_at', null)
      .order('scheduled_date', { ascending: false });

    // Filter by job_id
    if (req.query.job_id) {
      query = query.eq('job_id', req.query.job_id);
    }

    // Filter by result status
    if (req.query.result) {
      query = query.eq('result', req.query.result);
    }

    // Filter by type
    if (req.query.type) {
      query = query.ilike('inspection_type', `%${req.query.type}%`);
    }

    // Filter by date range
    if (req.query.from_date) {
      query = query.gte('scheduled_date', req.query.from_date);
    }
    if (req.query.to_date) {
      query = query.lte('scheduled_date', req.query.to_date);
    }

    // Search by inspector name or type
    if (req.query.search) {
      query = query.or(`inspection_type.ilike.%${req.query.search}%,inspector_name.ilike.%${req.query.search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Enrich with re-inspection info and deficiency counts
    const enriched = await Promise.all((data || []).map(async (inspection) => {
      // Count open deficiencies
      const openDeficiencies = (inspection.deficiencies || []).filter(d => d.status !== 'resolved').length;

      // Check for linked re-inspections
      if (inspection.result === 'failed') {
        const { data: reInspection } = await supabase
          .from('v2_inspections')
          .select('id, scheduled_date, result')
          .eq('parent_inspection_id', inspection.id)
          .is('deleted_at', null)
          .order('scheduled_date', { ascending: false })
          .limit(1)
          .single();

        inspection.next_reinspection = reInspection || null;
      }

      inspection.open_deficiency_count = openDeficiencies;
      return inspection;
    }));

    res.json(enriched);
  } catch (err) {
    console.error('Error listing inspections:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// GET INSPECTION STATS
// ============================================================

router.get('/stats', async (req, res) => {
  try {
    const jobId = req.query.job_id;
    if (!jobId) {
      return res.status(400).json({ error: 'job_id is required' });
    }

    // Get all inspections for this job
    const { data: inspections, error } = await supabase
      .from('v2_inspections')
      .select('result, scheduled_date')
      .eq('job_id', jobId)
      .is('deleted_at', null);

    if (error) throw error;

    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const stats = {
      scheduled: 0,
      passed: 0,
      failed: 0,
      partial: 0,
      cancelled: 0,
      no_show: 0,
      upcoming: 0,
      total: inspections?.length || 0
    };

    (inspections || []).forEach(insp => {
      if (stats[insp.result] !== undefined) {
        stats[insp.result]++;
      }

      // Check if upcoming (scheduled within 7 days)
      if (insp.result === 'scheduled') {
        const schedDate = new Date(insp.scheduled_date);
        if (schedDate >= now && schedDate <= in7Days) {
          stats.upcoming++;
        }
      }
    });

    res.json(stats);
  } catch (err) {
    console.error('Error getting inspection stats:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// GET UPCOMING INSPECTIONS (next 7 days)
// ============================================================

router.get('/upcoming', async (req, res) => {
  try {
    const now = new Date().toISOString().split('T')[0];
    const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let query = supabase
      .from('v2_inspections')
      .select(`
        *,
        job:v2_jobs(id, name, address)
      `)
      .eq('result', 'scheduled')
      .is('deleted_at', null)
      .gte('scheduled_date', now)
      .lte('scheduled_date', in7Days)
      .order('scheduled_date', { ascending: true });

    if (req.query.job_id) {
      query = query.eq('job_id', req.query.job_id);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json(data || []);
  } catch (err) {
    console.error('Error getting upcoming inspections:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// GET INSPECTION TYPES (for dropdown)
// ============================================================

router.get('/types', (req, res) => {
  res.json(INSPECTION_TYPES);
});

// ============================================================
// GET SINGLE INSPECTION WITH DETAILS
// ============================================================

router.get('/:id', async (req, res) => {
  try {
    const { data: inspection, error } = await supabase
      .from('v2_inspections')
      .select(`
        *,
        job:v2_jobs(id, name, address),
        deficiencies:v2_inspection_deficiencies(
          *,
          vendor:v2_vendors(id, name)
        ),
        attachments:v2_inspection_attachments(*),
        activity:v2_inspection_activity(*)
      `)
      .eq('id', req.params.id)
      .is('deleted_at', null)
      .single();

    if (error) throw error;
    if (!inspection) {
      return res.status(404).json({ error: 'Inspection not found' });
    }

    // Get parent inspection if this is a re-inspection
    if (inspection.parent_inspection_id) {
      const { data: parent } = await supabase
        .from('v2_inspections')
        .select('id, inspection_type, inspection_number, scheduled_date, result')
        .eq('id', inspection.parent_inspection_id)
        .single();
      inspection.parent_inspection = parent;
    }

    // Get child re-inspections
    const { data: reInspections } = await supabase
      .from('v2_inspections')
      .select('id, scheduled_date, result, reinspection_count')
      .eq('parent_inspection_id', inspection.id)
      .is('deleted_at', null)
      .order('scheduled_date', { ascending: true });

    inspection.reinspections = reInspections || [];

    res.json(inspection);
  } catch (err) {
    console.error('Error getting inspection:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// CREATE INSPECTION
// ============================================================

router.post('/', async (req, res) => {
  try {
    const {
      job_id,
      inspection_type,
      scheduled_date,
      scheduled_time,
      inspector_name,
      inspector_phone,
      inspector_agency,
      created_by
    } = req.body;

    if (!job_id || !inspection_type || !scheduled_date || !created_by) {
      return res.status(400).json({
        error: 'job_id, inspection_type, scheduled_date, and created_by are required'
      });
    }

    // Get next inspection number for this type
    const { data: existing } = await supabase
      .from('v2_inspections')
      .select('inspection_number')
      .eq('job_id', job_id)
      .eq('inspection_type', inspection_type)
      .is('deleted_at', null)
      .order('inspection_number', { ascending: false })
      .limit(1);

    const nextNumber = existing && existing.length > 0 && existing[0].inspection_number
      ? existing[0].inspection_number + 1
      : 1;

    const { data: inspection, error } = await supabase
      .from('v2_inspections')
      .insert({
        job_id,
        inspection_type,
        inspection_number: nextNumber,
        scheduled_date,
        scheduled_time: scheduled_time || null,
        inspector_name: inspector_name || null,
        inspector_phone: inspector_phone || null,
        inspector_agency: inspector_agency || null,
        created_by,
        result: 'scheduled'
      })
      .select()
      .single();

    if (error) throw error;

    // Log activity
    await supabase
      .from('v2_inspection_activity')
      .insert({
        inspection_id: inspection.id,
        action: 'created',
        performed_by: created_by,
        details: { scheduled_date, inspection_type }
      });

    res.status(201).json(inspection);
  } catch (err) {
    console.error('Error creating inspection:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// UPDATE INSPECTION
// ============================================================

router.patch('/:id', async (req, res) => {
  try {
    const updates = { ...req.body, updated_at: new Date().toISOString() };
    delete updates.id;
    delete updates.created_at;
    delete updates.created_by;

    const { data: inspection, error } = await supabase
      .from('v2_inspections')
      .update(updates)
      .eq('id', req.params.id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) throw error;
    if (!inspection) {
      return res.status(404).json({ error: 'Inspection not found' });
    }

    // Log activity
    await supabase
      .from('v2_inspection_activity')
      .insert({
        inspection_id: inspection.id,
        action: 'updated',
        performed_by: req.body.updated_by || 'system',
        details: updates
      });

    res.json(inspection);
  } catch (err) {
    console.error('Error updating inspection:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// DELETE INSPECTION (soft delete)
// ============================================================

router.delete('/:id', async (req, res) => {
  try {
    const { data: inspection, error } = await supabase
      .from('v2_inspections')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) throw error;
    if (!inspection) {
      return res.status(404).json({ error: 'Inspection not found' });
    }

    // Log activity
    await supabase
      .from('v2_inspection_activity')
      .insert({
        inspection_id: inspection.id,
        action: 'deleted',
        performed_by: req.body.deleted_by || 'system'
      });

    res.json({ success: true, message: 'Inspection deleted' });
  } catch (err) {
    console.error('Error deleting inspection:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// MARK INSPECTION AS PASSED
// ============================================================

router.post('/:id/pass', async (req, res) => {
  try {
    const { result_notes, result_date, performed_by } = req.body;

    const { data: inspection, error } = await supabase
      .from('v2_inspections')
      .update({
        result: 'passed',
        result_date: result_date || new Date().toISOString().split('T')[0],
        result_notes: result_notes || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) throw error;
    if (!inspection) {
      return res.status(404).json({ error: 'Inspection not found' });
    }

    // Log activity
    await supabase
      .from('v2_inspection_activity')
      .insert({
        inspection_id: inspection.id,
        action: 'passed',
        performed_by: performed_by || 'system',
        details: { result_notes }
      });

    res.json(inspection);
  } catch (err) {
    console.error('Error marking inspection passed:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// MARK INSPECTION AS FAILED
// ============================================================

router.post('/:id/fail', async (req, res) => {
  try {
    const { result_notes, result_date, deficiencies, performed_by } = req.body;

    const { data: inspection, error } = await supabase
      .from('v2_inspections')
      .update({
        result: 'failed',
        result_date: result_date || new Date().toISOString().split('T')[0],
        result_notes: result_notes || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) throw error;
    if (!inspection) {
      return res.status(404).json({ error: 'Inspection not found' });
    }

    // Add deficiencies if provided
    if (deficiencies && Array.isArray(deficiencies) && deficiencies.length > 0) {
      const deficiencyRecords = deficiencies.map(d => ({
        inspection_id: inspection.id,
        description: d.description,
        location: d.location || null,
        severity: d.severity || 'minor',
        assigned_vendor_id: d.assigned_vendor_id || null
      }));

      await supabase
        .from('v2_inspection_deficiencies')
        .insert(deficiencyRecords);
    }

    // Log activity
    await supabase
      .from('v2_inspection_activity')
      .insert({
        inspection_id: inspection.id,
        action: 'failed',
        performed_by: performed_by || 'system',
        details: { result_notes, deficiency_count: deficiencies?.length || 0 }
      });

    // Return with deficiencies
    const { data: fullInspection } = await supabase
      .from('v2_inspections')
      .select(`
        *,
        deficiencies:v2_inspection_deficiencies(*)
      `)
      .eq('id', inspection.id)
      .single();

    res.json(fullInspection);
  } catch (err) {
    console.error('Error marking inspection failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// CANCEL INSPECTION
// ============================================================

router.post('/:id/cancel', async (req, res) => {
  try {
    const { result_notes, performed_by } = req.body;

    const { data: inspection, error } = await supabase
      .from('v2_inspections')
      .update({
        result: 'cancelled',
        result_date: new Date().toISOString().split('T')[0],
        result_notes: result_notes || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) throw error;
    if (!inspection) {
      return res.status(404).json({ error: 'Inspection not found' });
    }

    // Log activity
    await supabase
      .from('v2_inspection_activity')
      .insert({
        inspection_id: inspection.id,
        action: 'cancelled',
        performed_by: performed_by || 'system',
        details: { result_notes }
      });

    res.json(inspection);
  } catch (err) {
    console.error('Error cancelling inspection:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// RESCHEDULE INSPECTION
// ============================================================

router.post('/:id/reschedule', async (req, res) => {
  try {
    const { scheduled_date, scheduled_time, result_notes, performed_by } = req.body;

    if (!scheduled_date) {
      return res.status(400).json({ error: 'scheduled_date is required' });
    }

    // Get original inspection
    const { data: original, error: fetchError } = await supabase
      .from('v2_inspections')
      .select('scheduled_date, scheduled_time')
      .eq('id', req.params.id)
      .single();

    if (fetchError) throw fetchError;

    const { data: inspection, error } = await supabase
      .from('v2_inspections')
      .update({
        scheduled_date,
        scheduled_time: scheduled_time || null,
        result: 'scheduled',
        result_notes: result_notes || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) throw error;
    if (!inspection) {
      return res.status(404).json({ error: 'Inspection not found' });
    }

    // Log activity
    await supabase
      .from('v2_inspection_activity')
      .insert({
        inspection_id: inspection.id,
        action: 'rescheduled',
        performed_by: performed_by || 'system',
        details: {
          from_date: original.scheduled_date,
          to_date: scheduled_date,
          result_notes
        }
      });

    res.json(inspection);
  } catch (err) {
    console.error('Error rescheduling inspection:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// CREATE RE-INSPECTION
// ============================================================

router.post('/:id/reinspect', async (req, res) => {
  try {
    const { scheduled_date, scheduled_time, created_by } = req.body;

    if (!scheduled_date || !created_by) {
      return res.status(400).json({ error: 'scheduled_date and created_by are required' });
    }

    // Get parent inspection
    const { data: parent, error: fetchError } = await supabase
      .from('v2_inspections')
      .select('*')
      .eq('id', req.params.id)
      .is('deleted_at', null)
      .single();

    if (fetchError) throw fetchError;
    if (!parent) {
      return res.status(404).json({ error: 'Parent inspection not found' });
    }

    // Calculate reinspection count
    const { count } = await supabase
      .from('v2_inspections')
      .select('*', { count: 'exact', head: true })
      .eq('parent_inspection_id', parent.id)
      .is('deleted_at', null);

    const reinspectionCount = (count || 0) + 1;

    // Create re-inspection
    const { data: inspection, error } = await supabase
      .from('v2_inspections')
      .insert({
        job_id: parent.job_id,
        inspection_type: parent.inspection_type,
        inspection_number: parent.inspection_number,
        scheduled_date,
        scheduled_time: scheduled_time || null,
        inspector_name: parent.inspector_name,
        inspector_phone: parent.inspector_phone,
        inspector_agency: parent.inspector_agency,
        parent_inspection_id: parent.id,
        reinspection_count: reinspectionCount,
        created_by,
        result: 'scheduled'
      })
      .select()
      .single();

    if (error) throw error;

    // Log activity on both parent and new inspection
    await supabase
      .from('v2_inspection_activity')
      .insert([
        {
          inspection_id: parent.id,
          action: 'reinspection_created',
          performed_by: created_by,
          details: { reinspection_id: inspection.id, scheduled_date }
        },
        {
          inspection_id: inspection.id,
          action: 'created',
          performed_by: created_by,
          details: {
            is_reinspection: true,
            parent_id: parent.id,
            reinspection_number: reinspectionCount
          }
        }
      ]);

    res.status(201).json(inspection);
  } catch (err) {
    console.error('Error creating re-inspection:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// ADD DEFICIENCY
// ============================================================

router.post('/:id/deficiencies', async (req, res) => {
  try {
    const { description, location, severity, assigned_vendor_id } = req.body;

    if (!description) {
      return res.status(400).json({ error: 'description is required' });
    }

    // Verify inspection exists
    const { data: inspection } = await supabase
      .from('v2_inspections')
      .select('id')
      .eq('id', req.params.id)
      .is('deleted_at', null)
      .single();

    if (!inspection) {
      return res.status(404).json({ error: 'Inspection not found' });
    }

    const { data: deficiency, error } = await supabase
      .from('v2_inspection_deficiencies')
      .insert({
        inspection_id: req.params.id,
        description,
        location: location || null,
        severity: severity || 'minor',
        assigned_vendor_id: assigned_vendor_id || null
      })
      .select()
      .single();

    if (error) throw error;

    // Log activity
    await supabase
      .from('v2_inspection_activity')
      .insert({
        inspection_id: req.params.id,
        action: 'deficiency_added',
        performed_by: req.body.created_by || 'system',
        details: { deficiency_id: deficiency.id, description, severity }
      });

    res.status(201).json(deficiency);
  } catch (err) {
    console.error('Error adding deficiency:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// UPDATE DEFICIENCY
// ============================================================

router.patch('/deficiencies/:id', async (req, res) => {
  try {
    const updates = { ...req.body, updated_at: new Date().toISOString() };
    delete updates.id;
    delete updates.created_at;
    delete updates.inspection_id;

    const { data: deficiency, error } = await supabase
      .from('v2_inspection_deficiencies')
      .update(updates)
      .eq('id', req.params.id)
      .select(`
        *,
        vendor:v2_vendors(id, name)
      `)
      .single();

    if (error) throw error;
    if (!deficiency) {
      return res.status(404).json({ error: 'Deficiency not found' });
    }

    // Log activity
    await supabase
      .from('v2_inspection_activity')
      .insert({
        inspection_id: deficiency.inspection_id,
        action: 'deficiency_updated',
        performed_by: req.body.updated_by || 'system',
        details: { deficiency_id: deficiency.id, updates }
      });

    res.json(deficiency);
  } catch (err) {
    console.error('Error updating deficiency:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// RESOLVE DEFICIENCY
// ============================================================

router.post('/deficiencies/:id/resolve', async (req, res) => {
  try {
    const { resolved_by, resolution_notes } = req.body;

    const { data: deficiency, error } = await supabase
      .from('v2_inspection_deficiencies')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolved_by: resolved_by || null,
        resolution_notes: resolution_notes || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    if (!deficiency) {
      return res.status(404).json({ error: 'Deficiency not found' });
    }

    // Log activity
    await supabase
      .from('v2_inspection_activity')
      .insert({
        inspection_id: deficiency.inspection_id,
        action: 'deficiency_resolved',
        performed_by: resolved_by || 'system',
        details: { deficiency_id: deficiency.id, resolution_notes }
      });

    res.json(deficiency);
  } catch (err) {
    console.error('Error resolving deficiency:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// UPLOAD PHOTO
// ============================================================

router.post('/:id/photos', photoUpload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Verify inspection exists
    const { data: inspection } = await supabase
      .from('v2_inspections')
      .select('id, job_id')
      .eq('id', req.params.id)
      .is('deleted_at', null)
      .single();

    if (!inspection) {
      return res.status(404).json({ error: 'Inspection not found' });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const ext = req.file.originalname.split('.').pop() || 'jpg';
    const fileName = `${PHOTO_PREFIX}/${inspection.job_id}/${req.params.id}_${timestamp}.${ext}`;

    // Upload to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(PHOTO_BUCKET)
      .getPublicUrl(fileName);

    // Save attachment record
    const { data: attachment, error } = await supabase
      .from('v2_inspection_attachments')
      .insert({
        inspection_id: req.params.id,
        deficiency_id: req.body.deficiency_id || null,
        file_url: urlData.publicUrl,
        file_name: req.file.originalname,
        file_type: req.file.mimetype,
        caption: req.body.caption || null,
        category: req.body.category || 'inspection',
        uploaded_by: req.body.uploaded_by || null
      })
      .select()
      .single();

    if (error) throw error;

    // Log activity
    await supabase
      .from('v2_inspection_activity')
      .insert({
        inspection_id: req.params.id,
        action: 'photo_uploaded',
        performed_by: req.body.uploaded_by || 'system',
        details: { attachment_id: attachment.id, file_name: req.file.originalname }
      });

    res.status(201).json(attachment);
  } catch (err) {
    console.error('Error uploading photo:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// DELETE PHOTO
// ============================================================

router.delete('/:id/photos/:photoId', async (req, res) => {
  try {
    // Get attachment to find the storage path
    const { data: attachment, error: fetchError } = await supabase
      .from('v2_inspection_attachments')
      .select('*')
      .eq('id', req.params.photoId)
      .eq('inspection_id', req.params.id)
      .single();

    if (fetchError || !attachment) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    // Extract storage path from URL
    const urlParts = attachment.file_url.split('/');
    const storagePath = urlParts.slice(-3).join('/'); // inspection-photos/job_id/filename

    // Delete from storage
    await supabase.storage
      .from(PHOTO_BUCKET)
      .remove([storagePath]);

    // Delete record
    const { error: deleteError } = await supabase
      .from('v2_inspection_attachments')
      .delete()
      .eq('id', req.params.photoId);

    if (deleteError) throw deleteError;

    // Log activity
    await supabase
      .from('v2_inspection_activity')
      .insert({
        inspection_id: req.params.id,
        action: 'photo_deleted',
        performed_by: req.body.deleted_by || 'system',
        details: { file_name: attachment.file_name }
      });

    res.json({ success: true, message: 'Photo deleted' });
  } catch (err) {
    console.error('Error deleting photo:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
