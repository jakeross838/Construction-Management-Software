import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command';
import { useSearchContext } from './SearchContext';
import { apiGet } from '@/lib/api';
import {
  Briefcase,
  FileText,
  Users,
  ShoppingCart,
  Clock,
  Search,
} from 'lucide-react';

// ---- Types ----

interface SearchResult {
  type: 'job' | 'vendor' | 'invoice' | 'po';
  id: string;
  title: string;
  subtitle: string;
  status?: string;
}

interface RecentSearch {
  query: string;
  timestamp: number;
}

// ---- Constants ----

const RECENT_SEARCHES_KEY = 'global-search-recent';
const MAX_RECENT_SEARCHES = 5;
const DEBOUNCE_MS = 300;

const TYPE_CONFIG: Record<
  string,
  { label: string; icon: typeof Briefcase; route: (id: string) => string }
> = {
  job: {
    label: 'Jobs',
    icon: Briefcase,
    route: (id) => `/jobs?highlight=${id}`,
  },
  vendor: {
    label: 'Vendors',
    icon: Users,
    route: (id) => `/vendors?highlight=${id}`,
  },
  invoice: {
    label: 'Invoices',
    icon: FileText,
    route: (id) => `/invoices?highlight=${id}`,
  },
  po: {
    label: 'Purchase Orders',
    icon: ShoppingCart,
    route: (id) => `/purchase-orders?highlight=${id}`,
  },
};

// ---- Helpers ----

function getRecentSearches(): RecentSearch[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string) {
  const trimmed = query.trim();
  if (!trimmed) return;
  try {
    let recent = getRecentSearches().filter((r) => r.query !== trimmed);
    recent.unshift({ query: trimmed, timestamp: Date.now() });
    recent = recent.slice(0, MAX_RECENT_SEARCHES);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent));
  } catch {
    // localStorage not available
  }
}

// ---- Component ----

export function GlobalSearch() {
  const { open, setOpen } = useSearchContext();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const navigate = useNavigate();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ctrl+K / Cmd+K keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(!open);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, setOpen]);

  // Load recent searches when dialog opens; reset state on close
  useEffect(() => {
    if (open) {
      setRecentSearches(getRecentSearches());
      setQuery('');
      setResults([]);
    }
  }, [open]);

  // Debounced search
  const performSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await apiGet(`/api/search?q=${encodeURIComponent(searchQuery)}&limit=15`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        performSearch(value);
      }, DEBOUNCE_MS);
    },
    [performSearch],
  );

  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      const config = TYPE_CONFIG[result.type];
      if (config) {
        saveRecentSearch(result.title);
        setOpen(false);
        navigate(config.route(result.id));
      }
    },
    [navigate, setOpen],
  );

  const handleRecentSelect = useCallback(
    (recentQuery: string) => {
      setQuery(recentQuery);
      performSearch(recentQuery);
    },
    [performSearch],
  );

  // Group results by type
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, result) => {
    if (!acc[result.type]) acc[result.type] = [];
    acc[result.type].push(result);
    return acc;
  }, {});

  const hasResults = results.length > 0;
  const hasQuery = query.trim().length >= 2;
  const showRecent = !hasQuery && recentSearches.length > 0;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search jobs, invoices, vendors, purchase orders..."
        value={query}
        onValueChange={handleQueryChange}
      />
      <CommandList>
        {loading && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Searching...
          </div>
        )}

        {!loading && hasQuery && !hasResults && (
          <CommandEmpty>No results found for &ldquo;{query}&rdquo;</CommandEmpty>
        )}

        {showRecent && (
          <CommandGroup heading="Recent Searches">
            {recentSearches.map((recent) => (
              <CommandItem
                key={recent.timestamp}
                value={`recent-${recent.query}`}
                onSelect={() => handleRecentSelect(recent.query)}
              >
                <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>{recent.query}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {!loading && !showRecent && !hasQuery && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            <Search className="mx-auto mb-2 h-5 w-5" />
            Type to search across jobs, invoices, vendors, and purchase orders
          </div>
        )}

        {!loading &&
          Object.entries(grouped).map(([type, items], idx) => {
            const config = TYPE_CONFIG[type];
            if (!config) return null;
            const Icon = config.icon;
            return (
              <div key={type}>
                {idx > 0 && <CommandSeparator />}
                <CommandGroup heading={config.label}>
                  {items.map((result) => (
                    <CommandItem
                      key={`${result.type}-${result.id}`}
                      value={`${result.type}-${result.id}-${result.title}`}
                      onSelect={() => handleSelect(result)}
                    >
                      <Icon className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="truncate">{result.title}</span>
                        {result.subtitle && (
                          <span className="text-xs text-muted-foreground truncate">
                            {result.subtitle}
                          </span>
                        )}
                      </div>
                      {result.status && (
                        <span className="ml-auto text-xs text-muted-foreground capitalize shrink-0">
                          {result.status}
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </div>
            );
          })}
      </CommandList>
      <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground flex items-center justify-between">
        <div className="flex items-center gap-2">
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">&uarr;&darr;</span>
          </kbd>
          <span>Navigate</span>
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">&crarr;</span>
          </kbd>
          <span>Select</span>
        </div>
        <div>
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            Esc
          </kbd>
          <span className="ml-1">Close</span>
        </div>
      </div>
    </CommandDialog>
  );
}
