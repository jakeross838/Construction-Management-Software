// Helper function for currency formatting
function formatCurrency(amount) {
  return parseFloat(amount) || 0;
}

// Helper to format money for PDF (with $ and commas)
function formatMoneyPDF(amount) {
  const num = parseFloat(amount) || 0;
  return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

module.exports = {
  formatCurrency,
  formatMoneyPDF
};
