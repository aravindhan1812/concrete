import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/** Breakpoints shared with styles.css: phone < 640, tablet 640–1023, desktop ≥ 1024. */
export const BP = { phone: '(max-width: 639px)', tablet: '(min-width: 640px) and (max-width: 1023px)', desktop: '(min-width: 1024px)' };

export function useViewport(): 'phone' | 'tablet' | 'desktop' {
  const phone = useMediaQuery(BP.phone);
  const desktop = useMediaQuery(BP.desktop);
  return phone ? 'phone' : desktop ? 'desktop' : 'tablet';
}
