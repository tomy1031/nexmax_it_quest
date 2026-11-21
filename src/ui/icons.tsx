/** 画面で使う小さな記号（線の絵）。キャラクターではないので SVG で描いてよい。 */
type P = { className?: string; style?: React.CSSProperties };

export const IconPlay = ({ className, style }: P) => (
  <svg viewBox="0 0 24 24" className={className} style={style} fill="currentColor" aria-hidden>
    <path d="M7 4.5v15l13-7.5z" />
  </svg>
);

export const IconBook = ({ className }: P) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="M3 5c3-1 6-1 9 1 3-2 6-2 9-1v14c-3-1-6-1-9 1-3-2-6-2-9-1z" />
    <path d="M12 6v14" />
  </svg>
);

export const IconGear = ({ className }: P) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
  </svg>
);

export const IconMenu = ({ className }: P) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    aria-hidden
  >
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

export const IconChat = ({ className }: P) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="M4 5h16v11H9l-5 4z" />
  </svg>
);

export const IconMap = ({ className }: P) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <circle cx="6" cy="6" r="2" />
    <circle cx="18" cy="18" r="2" />
    <path d="M6 8v4a4 4 0 0 0 4 4h6" />
  </svg>
);

export const IconMemo = ({ className }: P) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="M6 3h9l3 3v15H6z" />
    <path d="M9 10h6M9 14h6M9 18h4" />
  </svg>
);

export const IconBag = ({ className }: P) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="M5 8h14l-1 13H6z" />
    <path d="M9 8a3 3 0 0 1 6 0" />
  </svg>
);

export const IconBulb = ({ className }: P) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="M9 18h6M10 21h4" />
    <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />
  </svg>
);

export const IconShirt = ({ className }: P) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="M8 3l4 3 4-3 5 4-3 3v11H6V10L3 7z" />
  </svg>
);

export const IconClose = ({ className }: P) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2.6"
    aria-hidden
  >
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const IconExit = ({ className }: P) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10" />
  </svg>
);

export const IconCheck = ({ className }: P) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    aria-hidden
  >
    <path d="M5 12.5l4.5 4.5L19 7" />
  </svg>
);

export const IconCamera = ({ className }: P) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="M4 7h4l2-2h4l2 2h4v12H4z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
);

/** 開いた本（ボタンのイメージの「ストーリー」の記号）。 */
export const IconBookOpen = ({ className, style }: P) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    style={style}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M2.5 5.5h7a2.5 2.5 0 0 1 2.5 2.5v11a2 2 0 0 0-2-2h-7.5z" />
    <path d="M21.5 5.5h-7A2.5 2.5 0 0 0 12 8v11a2 2 0 0 1 2-2h7.5z" />
    <path d="M5 9h4M5 12h4M5 15h4M15 9h4M15 12h4M15 15h4" strokeLinecap="round" />
  </svg>
);

/** 歯車（ぬりつぶし。ボタンのイメージの「設定」の記号）。 */
export const IconGearSolid = ({ className, style }: P) => (
  <svg viewBox="0 0 24 24" className={className} style={style} fill="currentColor" aria-hidden>
    <path
      fillRule="evenodd"
      d="M10.3 2h3.4l.5 2.6c.6.2 1.2.5 1.7.9l2.5-.9 1.7 2.9-2 1.7c.1.6.1 1.3 0 1.9l2 1.7-1.7 2.9-2.5-.9c-.5.4-1.1.7-1.7.9l-.5 2.6h-3.4l-.5-2.6c-.6-.2-1.2-.5-1.7-.9l-2.5.9-1.7-2.9 2-1.7a6 6 0 0 1 0-1.9l-2-1.7 1.7-2.9 2.5.9c.5-.4 1.1-.7 1.7-.9zM12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8z"
      transform="translate(0 1.6)"
    />
  </svg>
);
