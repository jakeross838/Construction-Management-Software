/**
 * Deprecation Middleware
 * Adds deprecation headers to old API routes
 */

/**
 * Create deprecation middleware for an old route
 * @param {string} newPath - The new canonical path
 * @param {Date} sunsetDate - Optional date when the old route will be removed
 * @returns {Function} Express middleware
 */
function deprecate(newPath, sunsetDate = null) {
  return (req, res, next) => {
    // Add deprecation header
    res.setHeader('Deprecation', 'true');
    res.setHeader('Link', `<${newPath}>; rel="successor-version"`);

    // Add sunset header if date provided
    if (sunsetDate) {
      res.setHeader('Sunset', sunsetDate.toUTCString());
    }

    next();
  };
}

// Pre-configured deprecation middleware for specific route migrations
const deprecatedRoutes = {
  savings: deprecate('/api/savings-tracker'),
  spend: deprecate('/api/spend-analytics'),
  messages: deprecate('/api/messaging'),
  wip: deprecate('/api/work-in-progress'),
  pnl: deprecate('/api/profit-loss')
};

module.exports = {
  deprecate,
  deprecatedRoutes
};
