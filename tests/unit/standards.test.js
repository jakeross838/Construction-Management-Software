/**
 * Unit tests for standards module (naming conventions and normalization)
 */

const {
  toTitleCase,
  normalizeAddress,
  normalizePhone,
  normalizeDate,
  cleanForFilename,
  getJobIdentifier,
  getClientName,
  generateInvoiceFilename,
  generatePONumber
} = require('../../server/standards');

describe('toTitleCase', () => {
  test('converts lowercase to title case', () => {
    expect(toTitleCase('florida sunshine carpentry')).toBe('Florida Sunshine Carpentry');
  });

  test('preserves business abbreviations', () => {
    expect(toTitleCase('acme builders llc')).toBe('Acme Builders LLC');
    expect(toTitleCase('smith construction inc')).toBe('Smith Construction INC');
    expect(toTitleCase('jones corp')).toBe('Jones CORP');
  });

  test('preserves directional abbreviations', () => {
    expect(toTitleCase('n main st')).toBe('N Main St');
    expect(toTitleCase('123 sw 5th ave')).toBe('123 SW 5th Ave');
  });

  test('handles null and empty', () => {
    expect(toTitleCase(null)).toBeNull();
    // Empty string returns null as per implementation
    expect(toTitleCase('')).toBeNull();
  });
});

describe('normalizeAddress', () => {
  test('standardizes street types', () => {
    expect(normalizeAddress('123 main street')).toBe('123 Main St');
    expect(normalizeAddress('456 oak avenue')).toBe('456 Oak Ave');
    expect(normalizeAddress('789 pine boulevard')).toBe('789 Pine Blvd');
  });

  test('preserves directional abbreviations', () => {
    expect(normalizeAddress('123 n main st')).toBe('123 N Main St');
    expect(normalizeAddress('456 sw 7th ave')).toBe('456 SW 7th Ave');
  });

  test('handles null', () => {
    expect(normalizeAddress(null)).toBeNull();
  });
});

describe('normalizePhone', () => {
  test('formats 10-digit numbers', () => {
    expect(normalizePhone('9415551234')).toBe('(941) 555-1234');
    expect(normalizePhone('941-555-1234')).toBe('(941) 555-1234');
    expect(normalizePhone('(941)555-1234')).toBe('(941) 555-1234');
    expect(normalizePhone('941.555.1234')).toBe('(941) 555-1234');
  });

  test('handles 11-digit numbers with country code', () => {
    expect(normalizePhone('19415551234')).toBe('(941) 555-1234');
    expect(normalizePhone('1-941-555-1234')).toBe('(941) 555-1234');
  });

  test('returns original for non-standard formats', () => {
    expect(normalizePhone('123')).toBe('123');
    expect(normalizePhone('555-1234')).toBe('555-1234');
  });

  test('handles null', () => {
    expect(normalizePhone(null)).toBeNull();
  });
});

describe('normalizeDate', () => {
  test('converts to YYYY-MM-DD', () => {
    expect(normalizeDate('2026-01-15')).toBe('2026-01-15');
    expect(normalizeDate('01/15/2026')).toBe('2026-01-15');
    expect(normalizeDate('January 15, 2026')).toBe('2026-01-15');
  });

  test('handles invalid dates', () => {
    expect(normalizeDate('not a date')).toBeNull();
    expect(normalizeDate('')).toBeNull();
  });

  test('handles null', () => {
    expect(normalizeDate(null)).toBeNull();
  });
});

describe('cleanForFilename', () => {
  test('removes special characters', () => {
    expect(cleanForFilename('ABC Company!')).toBe('AbcCompany');
  });

  test('removes business suffixes', () => {
    expect(cleanForFilename('Florida Sunshine Carpentry, LLC')).toBe('FloridaSunshineCarpentry');
    expect(cleanForFilename('Smith & Sons Inc.')).toBe('SmithSons');
  });

  test('handles spaces and hyphens', () => {
    // "Company" is treated as a business suffix and removed
    expect(cleanForFilename('ABC-XYZ Company')).toBe('AbcXyz');
  });

  test('limits length to 50 characters', () => {
    const longName = 'Very Long Company Name That Exceeds The Maximum Allowed Length For Filenames';
    expect(cleanForFilename(longName).length).toBeLessThanOrEqual(50);
  });

  test('handles null and empty', () => {
    expect(cleanForFilename(null)).toBe('');
    expect(cleanForFilename('')).toBe('');
  });
});

describe('getJobIdentifier', () => {
  test('extracts client name and street number', () => {
    expect(getJobIdentifier('Drummond-501 74th St')).toBe('Drummond501');
    expect(getJobIdentifier('Smith-123 Main St')).toBe('Smith123');
  });

  test('handles jobs without street number', () => {
    expect(getJobIdentifier('Drummond Project')).toBe('Drummond');
  });

  test('handles null', () => {
    expect(getJobIdentifier(null)).toBe('');
  });
});

describe('getClientName', () => {
  test('extracts first part before hyphen or space', () => {
    expect(getClientName('Drummond-501 74th St')).toBe('Drummond');
    expect(getClientName('Smith Project')).toBe('Smith');
  });

  test('handles null', () => {
    expect(getClientName(null)).toBe('');
  });
});

describe('generateInvoiceFilename', () => {
  test('generates complete filename', () => {
    const result = generateInvoiceFilename({
      jobName: 'Drummond-501 74th St',
      vendorName: 'Florida Sunshine Carpentry, LLC',
      invoiceDate: '2026-01-15'
    });
    expect(result).toBe('INV_Drummond_FloridaSunshineCarpentry_2026-01-15.pdf');
  });

  test('handles missing job', () => {
    const result = generateInvoiceFilename({
      vendorName: 'ABC Company',
      invoiceDate: '2026-01-15'
    });
    // "Company" is a suffix and gets removed
    expect(result).toBe('INV_Abc_2026-01-15.pdf');
  });

  test('handles custom extension', () => {
    const result = generateInvoiceFilename({
      jobName: 'Test',
      vendorName: 'ABC',
      invoiceDate: '2026-01-15',
      extension: 'jpg'
    });
    expect(result).toContain('.jpg');
  });
});

describe('generatePONumber', () => {
  test('generates PO number with job identifier', () => {
    const result = generatePONumber('Drummond-501 74th St', 1);
    expect(result).toBe('PO-Drummond501-0001');
  });

  test('increments sequence number', () => {
    const result1 = generatePONumber('Smith-123 Main St', 1);
    const result2 = generatePONumber('Smith-123 Main St', 42);
    expect(result1).toBe('PO-Smith123-0001');
    expect(result2).toBe('PO-Smith123-0042');
  });

  test('handles null job name', () => {
    const result = generatePONumber(null, 1);
    expect(result).toBe('PO--0001');
  });
});
