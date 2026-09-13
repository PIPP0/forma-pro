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
