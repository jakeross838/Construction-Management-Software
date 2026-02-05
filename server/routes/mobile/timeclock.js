/**
 * Mobile Time Clock API Routes
 * Phase 1.1b: Time Clock with GPS Tracking
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../../config');

// Helper to get authenticated user ID
const getUserId = (req) => {
  return req.user?.id || req.headers['x-user-id'];
};

/**
 * GET /api/mobile/timeclock/status
 * Get current clock-in status for the user
 */
router.get('/status', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get active time clock entry (not clocked out)
    const { data: entry, error } = await supabase
      .from('v2_time_clock_entries')
      .select(`
        *,
        job:v2_jobs(id, name),
        breaks:v2_time_clock_breaks(*)
      `)
      .eq('user_id', userId)
      .is('clock_out_time', null)
      .order('clock_in_time', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
      throw error;
    }

    // Check for active break
    let activeBreak = null;
    if (entry?.breaks) {
      activeBreak = entry.breaks.find(b => !b.break_end_time);
    }

    // Calculate elapsed time
    let elapsedMinutes = 0;
    let breakMinutes = 0;
    if (entry) {
      const now = new Date();
      const clockIn = new Date(entry.clock_in_time);
      elapsedMinutes = Math.floor((now - clockIn) / 60000);

      // Calculate total break time
      if (entry.breaks) {
        breakMinutes = entry.breaks.reduce((total, brk) => {
          if (brk.duration_minutes) {
            return total + brk.duration_minutes;
          } else if (!brk.break_end_time) {
            // Active break - calculate current duration
            const breakStart = new Date(brk.break_start_time);
            return total + Math.floor((now - breakStart) / 60000);
          }
          return total;
        }, 0);
      }
    }

    res.json({
      clocked_in: !!entry,
      entry: entry || null,
      active_break: activeBreak,
      elapsed_minutes: elapsedMinutes,
      break_minutes: breakMinutes,
      working_minutes: elapsedMinutes - breakMinutes,
    });
  } catch (error) {
    console.error('Error getting time clock status:', error);
    res.status(500).json({ error: 'Failed to get time clock status' });
  }
});

/**
 * POST /api/mobile/timeclock/clock-in
 * Clock in with GPS location
 */
router.post('/clock-in', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { job_id, latitude, longitude, notes } = req.body;

    // Check if already clocked in
    const { data: existing } = await supabase
      .from('v2_time_clock_entries')
      .select('id')
      .eq('user_id', userId)
      .is('clock_out_time', null)
      .limit(1);

    if (existing && existing.length > 0) {
      return res.status(400).json({ error: 'Already clocked in' });
    }

    // Create new time clock entry
    const { data: entry, error } = await supabase
      .from('v2_time_clock_entries')
      .insert({
        user_id: userId,
        job_id: job_id || null,
        clock_in_latitude: latitude || null,
        clock_in_longitude: longitude || null,
        current_latitude: latitude || null,
        current_longitude: longitude || null,
        last_location_update: latitude ? new Date().toISOString() : null,
        notes: notes || null,
        tracking_status: 'active',
      })
      .select(`
        *,
        job:v2_jobs(id, name)
      `)
      .single();

    if (error) throw error;

    // Record initial location if provided
    if (latitude && longitude) {
      await supabase.from('v2_time_clock_locations').insert({
        time_clock_entry_id: entry.id,
        latitude,
        longitude,
      });
    }

    res.json({ entry });
  } catch (error) {
    console.error('Error clocking in:', error);
    res.status(500).json({ error: 'Failed to clock in' });
  }
});

/**
 * POST /api/mobile/timeclock/clock-out
 * Clock out with GPS location
 */
router.post('/clock-out', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { entry_id, latitude, longitude, notes } = req.body;

    // Get active entry
    let query = supabase
      .from('v2_time_clock_entries')
      .select('*')
      .eq('user_id', userId)
      .is('clock_out_time', null);

    if (entry_id) {
      query = query.eq('id', entry_id);
    }

    const { data: entries, error: fetchError } = await query.limit(1);

    if (fetchError) throw fetchError;
    if (!entries || entries.length === 0) {
      return res.status(400).json({ error: 'No active clock entry found' });
    }

    const entry = entries[0];

    // End any active breaks first
    await supabase
      .from('v2_time_clock_breaks')
      .update({ break_end_time: new Date().toISOString() })
      .eq('time_clock_entry_id', entry.id)
      .is('break_end_time', null);

    // Update entry with clock out
    const updateData = {
      clock_out_time: new Date().toISOString(),
      clock_out_latitude: latitude || null,
      clock_out_longitude: longitude || null,
    };
    if (notes) updateData.notes = notes;

    const { data: updated, error: updateError } = await supabase
      .from('v2_time_clock_entries')
      .update(updateData)
      .eq('id', entry.id)
      .select(`
        *,
        job:v2_jobs(id, name),
        breaks:v2_time_clock_breaks(*)
      `)
      .single();

    if (updateError) throw updateError;

    // Record final location
    if (latitude && longitude) {
      await supabase.from('v2_time_clock_locations').insert({
        time_clock_entry_id: entry.id,
        latitude,
        longitude,
      });
    }

    res.json({ entry: updated });
  } catch (error) {
    console.error('Error clocking out:', error);
    res.status(500).json({ error: 'Failed to clock out' });
  }
});

/**
 * POST /api/mobile/timeclock/break/start
 * Start a break
 */
router.post('/break/start', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { entry_id, break_type = 'lunch' } = req.body;

    // Get active entry
    let query = supabase
      .from('v2_time_clock_entries')
      .select('id')
      .eq('user_id', userId)
      .is('clock_out_time', null);

    if (entry_id) {
      query = query.eq('id', entry_id);
    }

    const { data: entries } = await query.limit(1);

    if (!entries || entries.length === 0) {
      return res.status(400).json({ error: 'Not clocked in' });
    }

    const timeClockEntryId = entries[0].id;

    // Check if already on break
    const { data: existingBreaks } = await supabase
      .from('v2_time_clock_breaks')
      .select('id')
      .eq('time_clock_entry_id', timeClockEntryId)
      .is('break_end_time', null)
      .limit(1);

    if (existingBreaks && existingBreaks.length > 0) {
      return res.status(400).json({ error: 'Already on break' });
    }

    // Create break
    const { data: breakRecord, error } = await supabase
      .from('v2_time_clock_breaks')
      .insert({
        time_clock_entry_id: timeClockEntryId,
        break_type,
      })
      .select()
      .single();

    if (error) throw error;

    // Update tracking status
    await supabase
      .from('v2_time_clock_entries')
      .update({ tracking_status: 'paused' })
      .eq('id', timeClockEntryId);

    res.json({ break: breakRecord });
  } catch (error) {
    console.error('Error starting break:', error);
    res.status(500).json({ error: 'Failed to start break' });
  }
});

/**
 * POST /api/mobile/timeclock/break/end
 * End a break
 */
router.post('/break/end', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { break_id } = req.body;

    // Get active break
    let query = supabase
      .from('v2_time_clock_breaks')
      .select(`
        *,
        entry:v2_time_clock_entries!inner(user_id, id)
      `)
      .is('break_end_time', null);

    if (break_id) {
      query = query.eq('id', break_id);
    }

    const { data: breaks } = await query.limit(1);

    if (!breaks || breaks.length === 0) {
      return res.status(400).json({ error: 'No active break found' });
    }

    const breakRecord = breaks[0];

    // Verify ownership
    if (breakRecord.entry.user_id !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // End break
    const { data: updated, error } = await supabase
      .from('v2_time_clock_breaks')
      .update({ break_end_time: new Date().toISOString() })
      .eq('id', breakRecord.id)
      .select()
      .single();

    if (error) throw error;

    // Update tracking status
    await supabase
      .from('v2_time_clock_entries')
      .update({ tracking_status: 'active' })
      .eq('id', breakRecord.entry.id);

    res.json({ break: updated });
  } catch (error) {
    console.error('Error ending break:', error);
    res.status(500).json({ error: 'Failed to end break' });
  }
});

/**
 * POST /api/mobile/timeclock/location
 * Update current location (called periodically while clocked in)
 */
router.post('/location', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { entry_id, latitude, longitude, accuracy } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Location required' });
    }

    // Get active entry
    let query = supabase
      .from('v2_time_clock_entries')
      .select('id')
      .eq('user_id', userId)
      .is('clock_out_time', null);

    if (entry_id) {
      query = query.eq('id', entry_id);
    }

    const { data: entries } = await query.limit(1);

    if (!entries || entries.length === 0) {
      return res.status(400).json({ error: 'Not clocked in' });
    }

    const timeClockEntryId = entries[0].id;

    // Update current location on entry
    await supabase
      .from('v2_time_clock_entries')
      .update({
        current_latitude: latitude,
        current_longitude: longitude,
        last_location_update: new Date().toISOString(),
      })
      .eq('id', timeClockEntryId);

    // Record location in history
    await supabase.from('v2_time_clock_locations').insert({
      time_clock_entry_id: timeClockEntryId,
      latitude,
      longitude,
      accuracy: accuracy || null,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating location:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

/**
 * GET /api/mobile/timeclock/history
 * Get time clock history for the user
 */
router.get('/history', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { start_date, end_date, job_id, limit = 50, offset = 0 } = req.query;

    let query = supabase
      .from('v2_time_clock_entries')
      .select(`
        *,
        job:v2_jobs(id, name),
        breaks:v2_time_clock_breaks(*)
      `, { count: 'exact' })
      .eq('user_id', userId)
      .order('clock_in_time', { ascending: false })
      .range(offset, offset + limit - 1);

    if (start_date) {
      query = query.gte('clock_in_time', start_date);
    }
    if (end_date) {
      query = query.lte('clock_in_time', end_date);
    }
    if (job_id) {
      query = query.eq('job_id', job_id);
    }

    const { data: entries, count, error } = await query;

    if (error) throw error;

    res.json({ entries, total: count });
  } catch (error) {
    console.error('Error getting time clock history:', error);
    res.status(500).json({ error: 'Failed to get time clock history' });
  }
});

/**
 * GET /api/mobile/timeclock/summary
 * Get summary stats (today, this week, this pay period)
 */
router.get('/summary', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay()); // Sunday

    // Get today's entries
    const { data: todayEntries } = await supabase
      .from('v2_time_clock_entries')
      .select('total_hours, clock_in_time, clock_out_time')
      .eq('user_id', userId)
      .gte('clock_in_time', today.toISOString());

    // Get week's entries
    const { data: weekEntries } = await supabase
      .from('v2_time_clock_entries')
      .select('total_hours')
      .eq('user_id', userId)
      .gte('clock_in_time', weekStart.toISOString())
      .not('clock_out_time', 'is', null);

    // Calculate totals
    let todayHours = 0;
    todayEntries?.forEach(e => {
      if (e.total_hours) {
        todayHours += parseFloat(e.total_hours);
      } else if (!e.clock_out_time) {
        // Still clocked in - calculate running total
        const clockIn = new Date(e.clock_in_time);
        todayHours += (now - clockIn) / 3600000;
      }
    });

    const weekHours = weekEntries?.reduce((sum, e) => sum + (parseFloat(e.total_hours) || 0), 0) || 0;

    res.json({
      today: {
        hours: Math.round(todayHours * 100) / 100,
        entries: todayEntries?.length || 0,
      },
      week: {
        hours: Math.round(weekHours * 100) / 100,
        entries: weekEntries?.length || 0,
      },
    });
  } catch (error) {
    console.error('Error getting time clock summary:', error);
    res.status(500).json({ error: 'Failed to get summary' });
  }
});

module.exports = router;
