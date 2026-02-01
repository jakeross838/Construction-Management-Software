/**
 * User-friendly error messages
 *
 * Maps technical errors to human-readable messages with actionable guidance
 */

interface ErrorMessageConfig {
  title: string;
  message: string;
  action?: string;
  retryable?: boolean;
}

// Map common HTTP status codes to user-friendly messages
export const httpErrorMessages: Record<number, ErrorMessageConfig> = {
  400: {
    title: 'Invalid Request',
    message: 'The request contains invalid data. Please check your input and try again.',
    action: 'Review your entries and correct any errors.',
    retryable: false,
  },
  401: {
    title: 'Authentication Required',
    message: 'Your session has expired or you need to sign in.',
    action: 'Please sign in to continue.',
    retryable: false,
  },
  403: {
    title: 'Access Denied',
    message: "You don't have permission to perform this action.",
    action: 'Contact your administrator if you believe this is an error.',
    retryable: false,
  },
  404: {
    title: 'Not Found',
    message: 'The requested item could not be found. It may have been deleted or moved.',
    action: 'Go back and try a different selection.',
    retryable: false,
  },
  409: {
    title: 'Conflict',
    message: 'This action conflicts with another operation. The data may have been modified.',
    action: 'Refresh the page and try again.',
    retryable: true,
  },
  422: {
    title: 'Validation Error',
    message: 'The data provided failed validation checks.',
    action: 'Check all required fields and correct any errors.',
    retryable: false,
  },
  429: {
    title: 'Too Many Requests',
    message: "You've made too many requests. Please wait a moment.",
    action: 'Wait a few seconds and try again.',
    retryable: true,
  },
  500: {
    title: 'Server Error',
    message: 'Something went wrong on our end. Our team has been notified.',
    action: 'Try again in a few moments.',
    retryable: true,
  },
  502: {
    title: 'Service Unavailable',
    message: 'The server is temporarily unavailable.',
    action: 'Wait a few moments and try again.',
    retryable: true,
  },
  503: {
    title: 'Service Unavailable',
    message: 'The service is temporarily down for maintenance.',
    action: 'Please try again later.',
    retryable: true,
  },
  504: {
    title: 'Request Timeout',
    message: 'The request took too long to complete.',
    action: 'Check your connection and try again.',
    retryable: true,
  },
};

// Map common error patterns to user-friendly messages
const errorPatterns: Array<{
  pattern: RegExp;
  config: ErrorMessageConfig;
}> = [
  {
    pattern: /network|fetch|connection|offline/i,
    config: {
      title: 'Connection Error',
      message: "Unable to connect to the server. Please check your internet connection.",
      action: 'Check your connection and try again.',
      retryable: true,
    },
  },
  {
    pattern: /timeout|timed out/i,
    config: {
      title: 'Request Timeout',
      message: 'The request took too long to complete.',
      action: 'Try again or check your connection.',
      retryable: true,
    },
  },
  {
    pattern: /duplicate|already exists|unique constraint/i,
    config: {
      title: 'Duplicate Entry',
      message: 'This item already exists. Please use a different value.',
      action: 'Change the duplicate field and try again.',
      retryable: false,
    },
  },
  {
    pattern: /foreign key|referenced|in use/i,
    config: {
      title: 'Cannot Delete',
      message: 'This item is being used by other records and cannot be deleted.',
      action: 'Remove all references to this item first.',
      retryable: false,
    },
  },
  {
    pattern: /allocation|exceed|over/i,
    config: {
      title: 'Amount Error',
      message: 'The allocated amount exceeds the available amount.',
      action: 'Reduce the amount and try again.',
      retryable: false,
    },
  },
  {
    pattern: /required|missing|empty/i,
    config: {
      title: 'Missing Information',
      message: 'Required information is missing.',
      action: 'Fill in all required fields.',
      retryable: false,
    },
  },
  {
    pattern: /invalid.*email/i,
    config: {
      title: 'Invalid Email',
      message: 'Please enter a valid email address.',
      action: 'Check the email format.',
      retryable: false,
    },
  },
  {
    pattern: /invalid.*date/i,
    config: {
      title: 'Invalid Date',
      message: 'Please enter a valid date.',
      action: 'Check the date format.',
      retryable: false,
    },
  },
  {
    pattern: /invalid.*number|NaN/i,
    config: {
      title: 'Invalid Number',
      message: 'Please enter a valid number.',
      action: 'Check the number format.',
      retryable: false,
    },
  },
];

// Default error message
const defaultError: ErrorMessageConfig = {
  title: 'Something Went Wrong',
  message: 'An unexpected error occurred. Please try again.',
  action: 'If the problem persists, contact support.',
  retryable: true,
};

/**
 * Parse an error and return a user-friendly message
 */
export function parseError(error: unknown): ErrorMessageConfig {
  // Handle HTTP response errors
  if (error instanceof Response) {
    return httpErrorMessages[error.status] || defaultError;
  }

  // Handle Error objects
  if (error instanceof Error) {
    const message = error.message;

    // Check for HTTP status in error message
    const httpMatch = message.match(/HTTP\s*(\d{3})/i);
    if (httpMatch) {
      const status = parseInt(httpMatch[1], 10);
      if (httpErrorMessages[status]) {
        return httpErrorMessages[status];
      }
    }

    // Check error patterns
    for (const { pattern, config } of errorPatterns) {
      if (pattern.test(message)) {
        return config;
      }
    }

    // Return error message as-is if it looks user-friendly
    if (message.length < 200 && !message.includes('Error:') && !message.includes('at ')) {
      return {
        title: 'Error',
        message,
        retryable: true,
      };
    }
  }

  // Handle string errors
  if (typeof error === 'string') {
    for (const { pattern, config } of errorPatterns) {
      if (pattern.test(error)) {
        return config;
      }
    }

    if (error.length < 200) {
      return {
        title: 'Error',
        message: error,
        retryable: true,
      };
    }
  }

  return defaultError;
}

/**
 * Get a short error message for toasts
 */
export function getShortErrorMessage(error: unknown): string {
  const parsed = parseError(error);
  return parsed.message;
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  const parsed = parseError(error);
  return parsed.retryable ?? true;
}
