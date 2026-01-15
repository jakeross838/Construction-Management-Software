/**
 * Realtime Routes
 * Server-Sent Events (SSE) for real-time updates
 */

const express = require('express');
const router = express.Router();
const { sseHandler, getStats: getRealtimeStats } = require('../realtime');

// SSE endpoint for real-time events
router.get('/events', sseHandler);

// Get realtime statistics
router.get('/stats', (req, res) => {
  res.json(getRealtimeStats());
});

module.exports = router;

