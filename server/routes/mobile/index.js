/**
 * Mobile API Routes Index
 * Aggregates all mobile-specific API endpoints
 */

const express = require('express');
const router = express.Router();

// Import mobile route modules
const timeclockRoutes = require('./timeclock');

// Mount routes
router.use('/timeclock', timeclockRoutes);

module.exports = router;
