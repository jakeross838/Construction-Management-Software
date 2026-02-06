module.exports = {
  theme: {
    extend: {
      colors: {
        // Modern Neutral Palette inspired by professional services / construction
        // These will be mapped to CSS variables like --color-primary-DEFAULT
        // and defined in globals.css
        'primary-brand': {
          DEFAULT: '222 47% 11%', // Dark slate gray (e.g., #1a202c)
          light: '222 47% 20%',
          dark: '222 47% 7%',
        },
        'secondary-brand': {
          DEFAULT: '220 13% 30%', // Medium gray (e.g., #4a5568)
          light: '220 13% 45%',
          dark: '220 13% 15%',
        },
        'accent-brand': {
          DEFAULT: '39 77% 40%', // DarkGoldenrod (e.g., #B8860B)
          light: '43 74% 56%', // Goldenrod (e.g., #D4AF37)
          dark: '38 78% 27%', // Darker Goldenrod (e.g., #8B6508)
        },
        'background-brand': {
          DEFAULT: '210 20% 98%', // Light almost white background (e.g., #F7FAFC)
          dark: '210 20% 95%', // Slightly darker for subtle differentiation (e.g., #EDF2F7)
        },
        'border-brand': {
          DEFAULT: '214 32% 91%', // Light border color (e.g., #E2E8F0)
        },
        'success-brand': '142 76% 36%', // Green for success messages
        'error-brand': '0 84% 60%',   // Red for error messages
        'warning-brand': '34 91% 64%', // Orange for warning messages
        'info-brand': '203 84% 60%',    // Blue for informational messages
      },
      spacing: {
        '1.5': '0.375rem',
        '2.5': '0.625rem',
        '4.5': '1.125rem',
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
      },
      boxShadow: {
        'smooth': '0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08)',
        'md-light': '0 4px 6px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.025)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', '"Noto Sans"', 'sans-serif', '"Apple Color Emoji"', '"Segoe UI Emoji"', '"Segoe UI Symbol"', '"Noto Color Emoji"'],
        // Assuming 'Inter' is desired and available, otherwise ensure it's imported or replaced
      },
    },
  },
  plugins: [],
};
