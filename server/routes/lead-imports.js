const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');

// Parse CSV string
function parseCSV(csvString) {
  const lines = csvString.split('\n').filter(line => line.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  // Parse headers (first line)
  const headers = parseCSVLine(lines[0]);

  // Parse data rows
  const rows = lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    const row = {};
    headers.forEach((header, i) => {
      row[header.trim().toLowerCase().replace(/\s+/g, '_')] = values[i] || '';
    });
    return row;
  });

  return { headers, rows };
}

// Parse a single CSV line (handles quoted values)
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());

  return values;
}

// Map CSV row to lead data
function mapRowToLead(row, mappings, defaults) {
  const lead = { ...defaults };

  Object.entries(mappings).forEach(([csvField, leadField]) => {
    const csvKey = csvField.toLowerCase().replace(/\s+/g, '_');
    if (row[csvKey] !== undefined && row[csvKey] !== '') {
      // Handle numeric fields
      if (leadField === 'estimated_value' || leadField === 'square_footage') {
        const num = parseFloat(row[csvKey].replace(/[$,]/g, ''));
        if (!isNaN(num)) lead[leadField] = num;
      } else {
        lead[leadField] = row[csvKey];
      }
    }
  });

  return lead;
}

// Get import history
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;

    const { data, error } = await supabase
      .from('v2_lead_imports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching imports:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single import details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('v2_lead_imports')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching import:', error);
    res.status(500).json({ error: error.message });
  }
});

// Preview CSV (parse and show sample)
router.post('/preview', async (req, res) => {
  try {
    const { csv_content, sample_size = 5 } = req.body;

    if (!csv_content) {
      return res.status(400).json({ error: 'CSV content is required' });
    }

    const { headers, rows } = parseCSV(csv_content);
    const sampleRows = rows.slice(0, sample_size);

    res.json({
      headers,
      sample_rows: sampleRows,
      total_rows: rows.length,
    });
  } catch (error) {
    console.error('Error previewing CSV:', error);
    res.status(500).json({ error: error.message });
  }
});

// Import leads from CSV
router.post('/', async (req, res) => {
  try {
    const { csv_content, file_name, mappings, defaults = {} } = req.body;

    if (!csv_content) {
      return res.status(400).json({ error: 'CSV content is required' });
    }

    // Parse CSV
    const { headers, rows } = parseCSV(csv_content);

    if (rows.length === 0) {
      return res.status(400).json({ error: 'CSV has no data rows' });
    }

    // Create import record
    const { data: importRecord, error: importError } = await supabase
      .from('v2_lead_imports')
      .insert({
        file_name: file_name || 'import.csv',
        file_size: csv_content.length,
        total_rows: rows.length,
        status: 'processing',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (importError) throw importError;

    // Use default mappings if not provided
    const finalMappings = mappings || {
      first_name: 'first_name',
      last_name: 'last_name',
      email: 'email',
      phone: 'phone',
      company_name: 'company_name',
      project_address: 'project_address',
      project_type: 'project_type',
      estimated_value: 'estimated_value',
      notes: 'notes',
    };

    // Process rows
    const results = {
      successful: 0,
      failed: 0,
      errors: [],
      created_ids: [],
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const leadData = mapRowToLead(row, finalMappings, {
          stage: 'new_inquiry',
          ...defaults,
        });

        // Validate required fields
        if (!leadData.first_name && !leadData.last_name && !leadData.email) {
          throw new Error('At least one of first_name, last_name, or email is required');
        }

        // Insert lead
        const { data: lead, error: leadError } = await supabase
          .from('v2_leads')
          .insert(leadData)
          .select('id')
          .single();

        if (leadError) throw leadError;

        results.successful++;
        results.created_ids.push(lead.id);
      } catch (err) {
        results.failed++;
        results.errors.push({
          row: i + 2, // +2 for header row and 0-based index
          error: err.message,
          data: row,
        });
      }
    }

    // Update import record
    const { error: updateError } = await supabase
      .from('v2_lead_imports')
      .update({
        status: results.failed === rows.length ? 'failed' : 'completed',
        processed_rows: rows.length,
        successful_rows: results.successful,
        failed_rows: results.failed,
        error_log: results.errors,
        created_lead_ids: results.created_ids,
        completed_at: new Date().toISOString(),
      })
      .eq('id', importRecord.id);

    if (updateError) console.error('Failed to update import record:', updateError);

    res.status(201).json({
      import_id: importRecord.id,
      total_rows: rows.length,
      successful: results.successful,
      failed: results.failed,
      errors: results.errors.slice(0, 10), // Return first 10 errors
    });
  } catch (error) {
    console.error('Error importing leads:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get mapping templates
router.get('/mappings/templates', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('v2_lead_import_mappings')
      .select('*')
      .order('is_default', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching mapping templates:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save mapping template
router.post('/mappings/templates', async (req, res) => {
  try {
    const { name, description, mappings, defaults } = req.body;

    const { data, error } = await supabase
      .from('v2_lead_import_mappings')
      .insert({
        name,
        description,
        mappings,
        defaults: defaults || {},
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error('Error saving mapping template:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export leads to CSV
router.get('/export', async (req, res) => {
  try {
    const { stage, source_id, created_after, created_before } = req.query;

    let query = supabase
      .from('v2_leads')
      .select(`
        id,
        first_name,
        last_name,
        email,
        phone,
        company_name,
        project_address,
        project_type,
        project_description,
        estimated_value,
        square_footage,
        stage,
        notes,
        created_at,
        source:v2_lead_sources(name)
      `)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (stage) query = query.eq('stage', stage);
    if (source_id) query = query.eq('source_id', source_id);
    if (created_after) query = query.gte('created_at', created_after);
    if (created_before) query = query.lte('created_at', created_before);

    const { data, error } = await query;
    if (error) throw error;

    // Convert to CSV
    const headers = [
      'ID',
      'First Name',
      'Last Name',
      'Email',
      'Phone',
      'Company',
      'Project Address',
      'Project Type',
      'Description',
      'Estimated Value',
      'Square Footage',
      'Stage',
      'Source',
      'Notes',
      'Created At',
    ];

    const rows = data.map(lead => [
      lead.id,
      lead.first_name || '',
      lead.last_name || '',
      lead.email || '',
      lead.phone || '',
      lead.company_name || '',
      lead.project_address || '',
      lead.project_type || '',
      lead.project_description || '',
      lead.estimated_value || '',
      lead.square_footage || '',
      lead.stage || '',
      lead.source?.name || '',
      (lead.notes || '').replace(/"/g, '""'),
      lead.created_at || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(v => `"${v}"`).join(',')),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="leads-export-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvContent);
  } catch (error) {
    console.error('Error exporting leads:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get available lead fields for mapping
router.get('/fields', async (req, res) => {
  const fields = [
    { name: 'first_name', label: 'First Name', required: false },
    { name: 'last_name', label: 'Last Name', required: false },
    { name: 'email', label: 'Email', required: false },
    { name: 'phone', label: 'Phone', required: false },
    { name: 'company_name', label: 'Company', required: false },
    { name: 'project_address', label: 'Project Address', required: false },
    { name: 'project_type', label: 'Project Type', required: false },
    { name: 'project_description', label: 'Description', required: false },
    { name: 'estimated_value', label: 'Estimated Value', required: false },
    { name: 'square_footage', label: 'Square Footage', required: false },
    { name: 'notes', label: 'Notes', required: false },
    { name: 'source_name', label: 'Source (creates if not exists)', required: false },
  ];

  res.json(fields);
});

module.exports = router;
