import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
    watch: {
      // Use polling on Windows to avoid UNKNOWN watch errors
      usePolling: true,
      interval: 1000,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Dedupe React packages to prevent version conflicts
    dedupe: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query', 'scheduler'],
  },
  build: {
    // Enable source maps for production debugging
    sourcemap: mode === 'development',
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching
        manualChunks: {
          // Vendor chunks - libraries that rarely change
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-popover',
          ],
          'vendor-charts': ['recharts'],
          'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
          // Large features as separate chunks
          'feature-bim': ['three', 'web-ifc-three'],
          'feature-pdf': ['jspdf', 'jspdf-autotable'],
          'feature-excel': ['xlsx'],
        },
      },
    },
    // Minification options
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: mode === 'production',
        drop_debugger: true,
      },
    },
  },
  // Optimize dependencies - include all React-dependent packages together
  optimizeDeps: {
    // Scan source files to find all dependencies
    entries: ['src/**/*.tsx', 'src/**/*.ts'],
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@tanstack/react-query',
      'lucide-react',
      // Radix UI components
      '@radix-ui/react-toast',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-popover',
      '@radix-ui/react-tabs',
      '@radix-ui/react-alert-dialog',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-separator',
      '@radix-ui/react-label',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-switch',
      '@radix-ui/react-slider',
      '@radix-ui/react-progress',
      '@radix-ui/react-avatar',
      '@radix-ui/react-accordion',
      '@radix-ui/react-collapsible',
      // Other React libraries
      'sonner',
      'react-hook-form',
      'react-day-picker',
      'react-dropzone',
      'cmdk',
      'recharts',
      'vaul',
      'embla-carousel-react',
      'input-otp',
      'next-themes',
      'react-resizable-panels',
      '@dnd-kit/core',
      '@dnd-kit/sortable',
      '@hello-pangea/dnd',
    ],
    exclude: ['web-ifc-three', 'react-pdf', 'react-leaflet'], // Large or problematic dependencies
    esbuildOptions: {
      jsx: 'automatic',
    },
  },
}));
