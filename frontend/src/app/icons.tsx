import { SVGProps } from 'react';

/** Small inline icon set (24px grid, 1.8 stroke). Keeps the bundle free of an icon library. */
type P = SVGProps<SVGSVGElement>;
const base = (props: P) => ({
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...props,
});

export const Icons = {
  home: (p: P) => <svg {...base(p)}><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v10h14V10" /></svg>,
  leads: (p: P) => <svg {...base(p)}><path d="M4 5h16l-6 7v6l-4 2v-8z" /></svg>,
  clients: (p: P) => <svg {...base(p)}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4a3.5 3.5 0 0 1 0 7M18 13.5a6.5 6.5 0 0 1 3.5 6.5" /></svg>,
  quotations: (p: P) => <svg {...base(p)}><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5M10 13h6M10 17h6" /></svg>,
  projects: (p: P) => <svg {...base(p)}><path d="M3 21h18M5 21V8l7-4 7 4v13" /><path d="M9 21v-5h6v5M9 11h2M13 11h2" /></svg>,
  drawings: (p: P) => <svg {...base(p)}><path d="M4 4h16v16H4z" /><path d="M4 10h16M10 4v16" /></svg>,
  site: (p: P) => <svg {...base(p)}><path d="M3 21h18M6 21V11h12v10" /><path d="M9 11V7h6v4M12 3v4" /></svg>,
  quality: (p: P) => <svg {...base(p)}><path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6z" /><path d="m9 12 2 2 4-4" /></svg>,
  safety: (p: P) => <svg {...base(p)}><path d="M4 15a8 8 0 0 1 16 0" /><path d="M2 15h20v3H2zM10 7V4h4v3" /></svg>,
  materials: (p: P) => <svg {...base(p)}><path d="M12 3 3 7.5 12 12l9-4.5z" /><path d="M3 7.5V16l9 4.5 9-4.5V7.5M12 12v8.5" /></svg>,
  procurement: (p: P) => <svg {...base(p)}><path d="M3 5h3l2.5 11h10L21 8H7" /><circle cx="10" cy="20" r="1.3" /><circle cx="17" cy="20" r="1.3" /></svg>,
  vendors: (p: P) => <svg {...base(p)}><path d="M3 9h18v11H3z" /><path d="M3 9l2-5h14l2 5M9 20v-6h6v6" /></svg>,
  inventory: (p: P) => <svg {...base(p)}><path d="M3 8h18v12H3z" /><path d="M3 8l2-4h14l2 4M10 12h4" /></svg>,
  assets: (p: P) => <svg {...base(p)}><path d="m14 6 4 4-9 9H5v-4z" /><path d="m12 8 4 4M16 4l4 4" /></svg>,
  people: (p: P) => <svg {...base(p)}><circle cx="12" cy="7" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>,
  accounting: (p: P) => <svg {...base(p)}><path d="M4 4h16v16H4z" /><path d="M8 8h8M8 12h3M13 12h3M8 16h3M13 16h3" /></svg>,
  reports: (p: P) => <svg {...base(p)}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>,
  admin: (p: P) => <svg {...base(p)}><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.5-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.5 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.5-2-1.5c.1-.4.1-.8.1-1.2z" /></svg>,
  more: (p: P) => <svg {...base(p)}><circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" /></svg>,
  menu: (p: P) => <svg {...base(p)}><path d="M4 7h16M4 12h16M4 17h16" /></svg>,
  close: (p: P) => <svg {...base(p)}><path d="m6 6 12 12M18 6 6 18" /></svg>,
  chevronLeft: (p: P) => <svg {...base(p)}><path d="m15 5-7 7 7 7" /></svg>,
  chevronRight: (p: P) => <svg {...base(p)}><path d="m9 5 7 7-7 7" /></svg>,
  sun: (p: P) => <svg {...base(p)}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>,
  moon: (p: P) => <svg {...base(p)}><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></svg>,
  signOut: (p: P) => <svg {...base(p)}><path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9" /></svg>,
  plus: (p: P) => <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>,
  search: (p: P) => <svg {...base(p)}><circle cx="11" cy="11" r="6" /><path d="m20 20-4-4" /></svg>,
  camera: (p: P) => <svg {...base(p)}><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>,
  arrowUp: (p: P) => <svg {...base(p)}><path d="M12 19V5M6 11l6-6 6 6" /></svg>,
  arrowDown: (p: P) => <svg {...base(p)}><path d="M12 5v14M6 13l6 6 6-6" /></svg>,
  bell: (p: P) => <svg {...base(p)}><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>,
  inbox: (p: P) => <svg {...base(p)}><path d="M4 4h16v16H4z" /><path d="M4 14h5l1.5 2h3l1.5-2h5" /></svg>,
};

export type IconName = keyof typeof Icons;
