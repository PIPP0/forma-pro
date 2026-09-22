import type { CSSProperties, ReactNode } from 'react';

export interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: CSSProperties;
  className?: string;
}

function svg(children: ReactNode, { size = 16, color = 'currentColor', strokeWidth = 1.8, style, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ flex: 'none', ...style }}
      className={className}
    >
      {children}
    </svg>
  );
}

export const IconCursor = (p: IconProps = {}) => svg(<path d="M5 3l14 7-6.2 1.8L11 18z" />, p);
export const IconFrame = (p: IconProps = {}) => svg(<path d="M8 3v18M16 3v18M3 8h18M3 16h18" />, p);
export const IconDiamond = (p: IconProps = {}) => svg(<path d="M12 3.5l8.5 8.5-8.5 8.5L3.5 12z" />, p);
export const IconSparkle = (p: IconProps = {}) =>
  svg(
    <>
      <path d="M11 3l1.9 5.1L18 10l-5.1 1.9L11 17l-1.9-5.1L4 10l5.1-1.9z" />
      <path d="M18.5 15l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
    </>,
    p,
  );
export const IconUndo = (p: IconProps = {}) =>
  svg(
    <>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 010 11H11" />
    </>,
    p,
  );
export const IconRedo = (p: IconProps = {}) =>
  svg(
    <>
      <path d="M15 14l5-5-5-5" />
      <path d="M20 9H9.5a5.5 5.5 0 000 11H13" />
    </>,
    p,
  );
export const IconPlay = (p: IconProps = {}) => svg(<path d="M7 4.5l12 7.5-12 7.5z" />, p);
export const IconUpload = (p: IconProps = {}) =>
  svg(
    <>
      <path d="M12 15V4" />
      <path d="M7.5 8.5L12 4l4.5 4.5" />
      <path d="M4 15v3.5A2.5 2.5 0 006.5 21h11a2.5 2.5 0 002.5-2.5V15" />
    </>,
    p,
  );
export const IconSave = (p: IconProps = {}) =>
  svg(
    <>
      <path d="M5 3.5h11l3.5 3.5v11.5a2 2 0 01-2 2h-11a2 2 0 01-2-2v-13a2 2 0 01.5-2z" />
      <path d="M8 3.5V8h7V3.5" />
      <path d="M8 20.5V14h8v6.5" />
    </>,
    p,
  );
export const IconCheckCircle = (p: IconProps = {}) =>
  svg(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.7 2.7L16.2 9.5" />
    </>,
    p,
  );
export const IconCheck = (p: IconProps = {}) => svg(<path d="M5 12.5l4.5 4.5L19 7.5" />, p);
export const IconChevronRight = (p: IconProps = {}) => svg(<path d="M9.5 5.5L16 12l-6.5 6.5" />, p);
export const IconChevronDown = (p: IconProps = {}) => svg(<path d="M6 9.5l6 6 6-6" />, p);
export const IconChevronLeft = (p: IconProps = {}) => svg(<path d="M14.5 5.5L8 12l6.5 6.5" />, p);
export const IconArrowLeft = (p: IconProps = {}) =>
  svg(
    <>
      <path d="M19 12H5" />
      <path d="M11 6l-6 6 6 6" />
    </>,
    p,
  );
export const IconArrowUpRight = (p: IconProps = {}) =>
  svg(
    <>
      <path d="M7 17L17 7" />
      <path d="M8.5 7H17v8.5" />
    </>,
    p,
  );
export const IconBell = (p: IconProps = {}) =>
  svg(
    <>
      <path d="M6 16.5V11a6 6 0 1112 0v5.5l1.5 1.5h-15z" />
      <path d="M10 20.5a2 2 0 004 0" />
    </>,
    p,
  );
export const IconShield = (p: IconProps = {}) =>
  svg(
    <>
      <path d="M12 3l7.5 3v6c0 4.4-3.2 8.2-7.5 9-4.3-.8-7.5-4.6-7.5-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </>,
    p,
  );
export const IconInfo = (p: IconProps = {}) =>
  svg(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 7.8h.01" />
    </>,
    p,
  );
export const IconTarget = (p: IconProps = {}) =>
  svg(
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5.2" />
      <circle cx="12" cy="12" r="1.6" />
    </>,
    p,
  );
export const IconSearch = (p: IconProps = {}) =>
  svg(
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.2-4.2" />
    </>,
    p,
  );
export const IconPlus = (p: IconProps = {}) => svg(<path d="M12 5v14M5 12h14" />, p);
export const IconMinus = (p: IconProps = {}) => svg(<path d="M5 12h14" />, p);
export const IconExpand = (p: IconProps = {}) => svg(<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />, p);
export const IconSliders = (p: IconProps = {}) =>
  svg(
    <>
      <path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="17" cy="17" r="2" />
    </>,
    p,
  );
export const IconMessage = (p: IconProps = {}) => svg(<path d="M4.5 5h15v10.5H10L5.5 19.5v-4H4.5z" />, p);
export const IconChart = (p: IconProps = {}) => svg(<path d="M4 20h16M7.5 16.5V10M12 16.5V5.5M16.5 16.5v-4" />, p);
export const IconSend = (p: IconProps = {}) => svg(<path d="M4 4l16 7.5L4 19l3-7.5z" />, p);
export const IconWallet = (p: IconProps = {}) =>
  svg(
    <>
      <rect x="3.5" y="6" width="17" height="13" rx="2" />
      <path d="M15.5 12.5h2M3.5 9.5h17" />
    </>,
    p,
  );
export const IconLink = (p: IconProps = {}) =>
  svg(
    <>
      <path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" />
    </>,
    p,
  );
export const IconSun = (p: IconProps = {}) =>
  svg(
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>,
    p,
  );
export const IconMoon = (p: IconProps = {}) => svg(<path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" />, p);
export const IconTrash = (p: IconProps = {}) => svg(<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13" />, p);
export const IconUsers = (p: IconProps = {}) =>
  svg(
    <>
      <circle cx="9" cy="8.5" r="3.3" />
      <path d="M3.5 19.5c0-3 2.5-4.8 5.5-4.8s5.5 1.8 5.5 4.8" />
      <path d="M16 5.6a3.2 3.2 0 0 1 0 6M17.2 14.9c2.1.4 3.3 2 3.3 4.1" />
    </>,
    p,
  );
export const IconClose = (p: IconProps = {}) => svg(<path d="M6 6l12 12M18 6L6 18" />, p);

export const IconRefresh = (p: IconProps = {}) =>
  svg(
    <>
      <path d="M19.5 10A7.7 7.7 0 006 7.3L4.5 9" />
      <path d="M4.5 4.5V9H9" />
      <path d="M4.5 14A7.7 7.7 0 0018 16.7l1.5-1.7" />
      <path d="M19.5 19.5V15H15" />
    </>,
    p,
  );
export const IconDownload = (p: IconProps = {}) =>
  svg(
    <>
      <path d="M12 4v11" />
      <path d="M7.5 10.5L12 15l4.5-4.5" />
      <path d="M4 15v3.5A2.5 2.5 0 006.5 21h11a2.5 2.5 0 002.5-2.5V15" />
    </>,
    p,
  );
export const IconFileImage = (p: IconProps = {}) =>
  svg(
    <>
      <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
      <path d="M14 3v5h5" />
      <circle cx="10" cy="12" r="1.4" />
      <path d="M18.5 17.5l-3.5-3.5-5.5 5.5" />
    </>,
    p,
  );

/** Íconos de interfaz para los prototipos (banca móvil y usos generales). */
const APP_ICONS: Record<string, ReactNode> = {
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  qr: (
    <>
      <rect x="6" y="6" width="4.5" height="4.5" rx="0.8" />
      <rect x="13.5" y="6" width="4.5" height="4.5" rx="0.8" />
      <rect x="6" y="13.5" width="4.5" height="4.5" rx="0.8" />
      <path d="M13.5 13.5h1.8v1.8h-1.8zM16.2 16.2H18V18h-1.8z" />
      <path d="M3 7.5V3h4.5M16.5 3H21v4.5M21 16.5V21h-4.5M7.5 21H3v-4.5" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16.5V11a6 6 0 1112 0v5.5l1.5 1.5h-15z" />
      <path d="M10 20.5a2 2 0 004 0" />
    </>
  ),
  wallet: (
    <>
      <path d="M4 8.5h14.5a1.5 1.5 0 011.5 1.5v8.5a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 18.5z" />
      <path d="M4 8.5l12-4v4" />
      <rect x="15" y="12" width="6" height="4" rx="1" />
    </>
  ),
  transfer: (
    <>
      <rect x="5.5" y="5.5" width="13" height="13" rx="3" />
      <path d="M12 8.5v7M13.8 10c-.3-.6-1-1-1.8-1-1 0-1.8.6-1.8 1.3 0 1.7 3.6.8 3.6 2.6 0 .7-.8 1.3-1.8 1.3-.8 0-1.5-.4-1.8-1" />
      <path d="M19 8.5l2-2-2-2M5 15.5l-2 2 2 2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  credits: (
    <>
      <rect x="3" y="8.5" width="14.5" height="10" rx="1.5" />
      <path d="M6 8.5V6h15v10h-3.5" />
      <path d="M10.2 11.5v4M11.6 12.3c-.2-.4-.7-.7-1.3-.7-.7 0-1.3.4-1.3.9 0 1.2 2.6.6 2.6 1.8 0 .5-.6.9-1.3.9-.6 0-1.1-.3-1.3-.7" />
    </>
  ),
  investments: (
    <>
      <path d="M4 20.5h16" />
      <path d="M6 20.5v-5h3v5M11 20.5v-8h3v8M16 20.5V9h3v11.5" />
      <path d="M8 3.5v4M9.3 4.3c-.2-.4-.7-.7-1.3-.7-.7 0-1.2.4-1.2.9 0 1.1 2.5.6 2.5 1.7 0 .5-.6.9-1.3.9-.6 0-1-.3-1.2-.7" />
    </>
  ),
  cashCard: (
    <>
      <rect x="3" y="6.5" width="18" height="12" rx="2" />
      <path d="M3 10.5h18" />
      <path d="M12 12.5v4.5M13.3 13.3c-.2-.4-.7-.7-1.3-.7-.7 0-1.3.4-1.3.9 0 1.2 2.6.6 2.6 1.8 0 .5-.6.9-1.3.9-.6 0-1.1-.3-1.3-.7" />
    </>
  ),
  compare: (
    <>
      <rect x="3" y="4.5" width="13" height="9" rx="1.5" />
      <path d="M9.5 7v4M10.8 7.8c-.2-.4-.7-.7-1.3-.7-.7 0-1.2.4-1.2.8 0 1.1 2.5.6 2.5 1.7 0 .5-.6.9-1.3.9-.6 0-1-.3-1.2-.7" />
      <path d="M14 16l2.5 3 4.5-5.5" />
    </>
  ),
  debts: (
    <>
      <path d="M6 3h9l3 3v8" />
      <path d="M6 3v17h8" />
      <path d="M9 8h6M9 11.5h6M9 15h3" />
      <circle cx="18" cy="18" r="3" />
      <path d="M18 16.5v3M16.5 18h3" />
    </>
  ),
  feedback: (
    <>
      <circle cx="8" cy="10" r="3" />
      <path d="M2.5 20.5c.4-3 2.6-5 5.5-5s5.1 2 5.5 5" />
      <path d="M13 3.5h8.5v6.5h-4L15 12.5V10h-2z" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="10" r="3.2" />
      <path d="M6.3 18.2c1.3-2.1 3.3-3.2 5.7-3.2s4.4 1.1 5.7 3.2" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.8l1.7 2.3 2.8-.5.7 2.8 2.5 1.4-1.2 2.6 1.2 2.6-2.5 1.4-.7 2.8-2.8-.5L12 21.2l-1.7-2.3-2.8.5-.7-2.8-2.5-1.4L5.5 12 4.3 9.4l2.5-1.4.7-2.8 2.8.5z" />
    </>
  ),
  chat: (
    <>
      <path d="M4 5h16v11H9.5L5 19.5V16H4z" />
      <path d="M8 9h8M8 12h5" />
    </>
  ),
  gift: (
    <>
      <rect x="4" y="10" width="16" height="10.5" rx="1" />
      <path d="M3 10h18V7H3zM12 7v13.5" />
      <path d="M12 7C10.5 4 7 3.8 7 5.5 7 7 10 7 12 7zM12 7c1.5-3 5-3.2 5-1.5C17 7 14 7 12 7z" />
    </>
  ),
  voucher: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="1.5" />
      <path d="M13 10h5M13 14h5" />
      <path d="M8 9v6M9.5 10.2c-.3-.5-.9-.7-1.5-.7-.8 0-1.5.5-1.5 1.1 0 1.4 3 .7 3 2.1 0 .6-.7 1.1-1.5 1.1-.6 0-1.2-.3-1.5-.7" />
    </>
  ),
  power: (
    <>
      <path d="M12 3v8" />
      <path d="M6.3 6.8a8 8 0 1011.4 0" />
    </>
  ),
  doc: (
    <>
      <path d="M4 5.5h13v14H4z" />
      <path d="M7 9.5h7M7 12.5h7M7 15.5h4" />
      <circle cx="18.5" cy="5" r="2" fill="currentColor" stroke="none" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="12.5" rx="1.5" />
      <path d="M9 7V5h6v2M3 12h18" />
    </>
  ),
  funds: (
    <>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M5 9a7.5 7.5 0 0114 0M19 15a7.5 7.5 0 01-14 0" />
      <circle cx="4.5" cy="17" r="1" />
      <circle cx="19.5" cy="17" r="1" />
      <circle cx="12" cy="3.5" r="1" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  piggy: (
    <>
      <path d="M5 11.5c0-3.3 3.1-6 7-6s7 2.7 7 6c0 2-1.1 3.7-2.8 4.8L15.5 19.5h-3l-.4-1.5h-1.2l-.4 1.5h-3l-.8-3.2C5.9 15.2 5 13.5 5 11.5z" />
      <path d="M19 10.5h2.2v3H19" />
      <path d="M12 9v5M13.4 9.9c-.3-.5-.8-.8-1.4-.8-.8 0-1.4.5-1.4 1 0 1.4 2.8.7 2.8 2.1 0 .6-.6 1-1.4 1-.6 0-1.1-.3-1.4-.8" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7.5 3v6c0 4.4-3.2 8.2-7.5 9-4.3-.8-7.5-4.6-7.5-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  receipt: (
    <>
      <path d="M5 3h14v18l-2.5-1.5L14 21l-2-1.5-2 1.5-2.5-1.5L5 21z" />
      <path d="M8 8h3M8 11h3M13 8h3M13 11h3M8 15h8" />
    </>
  ),
  bitcoin: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 7.5v9M10 7.5h3a2 2 0 010 4h-3M10 11.5h3.5a2.3 2.3 0 010 4.5H10" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.2-4.2" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.7" fill="currentColor" stroke="none" />
    </>
  ),
  trendIn: <path d="M17 7L7 17M7 9v8h8" />,
  trendUp: <path d="M7 17L17 7M9 7h8v8" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 7.8h.01" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,
  back: (
    <>
      <path d="M20 12H4.5" />
      <path d="M10.5 6l-6 6 6 6" />
    </>
  ),
  userAdd: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.5-3.5 3.2-6 6.5-6s6 2.5 6.5 6" />
      <path d="M18.5 7v6M15.5 10h6" />
    </>
  ),
  swap: <path d="M4 8.5h15.5l-3-3M20 15.5H4.5l3 3" />,
  coin: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M14.4 9c-.5-.8-1.3-1.2-2.4-1.2-1.3 0-2.4.8-2.4 1.8 0 2.3 4.8 1.2 4.8 3.6 0 1-1.1 1.8-2.4 1.8-1.1 0-2-.5-2.4-1.3" />
    </>
  ),
  card: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18M6 14.5h4" />
    </>
  ),
  cardPay: (
    <>
      <rect x="3" y="5.5" width="17" height="11.5" rx="2" />
      <path d="M3 9.5h17" />
      <circle cx="18" cy="17.5" r="3.2" fill="currentColor" stroke="none" />
      <path d="M16.7 17.5l.9.9 1.7-1.8" stroke="#fff" />
    </>
  ),
  cardSettings: (
    <>
      <rect x="3" y="5.5" width="17" height="11.5" rx="2" />
      <path d="M3 9.5h17M6 13h3" />
      <circle cx="18.5" cy="17.5" r="2" />
      <path d="M18.5 14.5v1M18.5 19.5v1M15.5 17.5h1M20.5 17.5h1" />
    </>
  ),
  cardCash: (
    <>
      <rect x="3" y="7" width="13" height="11" rx="1.5" />
      <path d="M7 5h13v11h-2" />
      <path d="M9.5 9.5v6M10.8 10.3c-.2-.4-.7-.7-1.3-.7-.7 0-1.3.4-1.3.9 0 1.2 2.6.6 2.6 1.8 0 .5-.6.9-1.3.9-.6 0-1.1-.3-1.3-.7" />
    </>
  ),
  import: (
    <>
      <path d="M12 4v10.5M8 10.5l4 4 4-4" />
      <path d="M4 16v4h16v-4" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  chevron: <path d="M9.5 5.5L16 12l-6.5 6.5" />,
};

export const APP_ICON_NAMES = Object.keys(APP_ICONS);

export function AppIcon({ name, size = 22, color = 'currentColor', strokeWidth = 1.5, style }: { name: string } & IconProps) {
  return svg(APP_ICONS[name] ?? APP_ICONS.info, { size, color, strokeWidth, style: { color, ...style } });
}

/** Marca genérica de tres barras para la barra superior del prototipo. */
export function BrandMark({ colors }: { colors: string[] }) {
  return (
    <span aria-hidden="true" style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }}>
      {colors.map((c, i) => (
        <span key={i} style={{ width: 5, height: 18, background: c, transform: 'skewX(-18deg)', borderRadius: 1 }} />
      ))}
    </span>
  );
}
