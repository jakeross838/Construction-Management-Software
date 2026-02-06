/**
 * Company Info utility
 *
 * Provides company information from the builder profile for use
 * in PDF generators, headers, and other display contexts.
 */

export interface CompanyInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
}

const DEFAULT_COMPANY: CompanyInfo = {
  name: 'Your Company',
  address: '',
  phone: '',
  email: '',
};

let cachedInfo: CompanyInfo | null = null;

/**
 * Get company info from the auth API.
 * Caches the result for the session.
 */
export async function getCompanyInfo(): Promise<CompanyInfo> {
  if (cachedInfo) return cachedInfo;

  try {
    const { apiGet } = await import('@/lib/api');
    const response = await apiGet('/api/auth/me');

    if (!response.ok) {
      return DEFAULT_COMPANY;
    }

    const data = await response.json();
    const builder = data?.builder;

    if (!builder) {
      return DEFAULT_COMPANY;
    }

    // Build full address from individual fields
    const addressParts = [
      builder.address,
      builder.city,
      builder.state ? `${builder.state} ${builder.zip || ''}`.trim() : builder.zip,
    ].filter(Boolean);

    cachedInfo = {
      name: builder.name || DEFAULT_COMPANY.name,
      address: addressParts.join(', '),
      phone: builder.phone || DEFAULT_COMPANY.phone,
      email: builder.email || DEFAULT_COMPANY.email,
    };

    return cachedInfo;
  } catch {
    return DEFAULT_COMPANY;
  }
}

/**
 * Build CompanyInfo from a builder object (e.g. from AuthContext).
 * Avoids an extra API call when builder data is already available.
 */
export function buildCompanyInfo(builder: {
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  email?: string;
} | null | undefined): CompanyInfo {
  if (!builder) return DEFAULT_COMPANY;

  const addressParts = [
    builder.address,
    builder.city,
    builder.state ? `${builder.state} ${builder.zip || ''}`.trim() : builder.zip,
  ].filter(Boolean);

  return {
    name: builder.name || DEFAULT_COMPANY.name,
    address: addressParts.join(', '),
    phone: builder.phone || DEFAULT_COMPANY.phone,
    email: builder.email || DEFAULT_COMPANY.email,
  };
}

/**
 * Clear the cached company info (e.g., on logout or builder profile update).
 */
export function clearCompanyInfoCache() {
  cachedInfo = null;
}
