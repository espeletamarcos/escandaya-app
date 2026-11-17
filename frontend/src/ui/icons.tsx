// Line icons, drawn in the current text colour. Decorative: the text next to
// each one names the control.

const LINE = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: false,
} as const;

export function MicrophoneIcon({ size = 24 }: { size?: number }) {
  return (
    <svg {...LINE} width={size} height={size}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}

export function ListIcon() {
  return (
    <svg {...LINE}>
      <path d="M9 6h12M9 12h12M9 18h12" />
      <path d="M4 6h1M4 12h1M4 18h1" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg {...LINE} width={18} height={18} strokeWidth={2}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function BackIcon() {
  return (
    <svg {...LINE} width={20} height={20} strokeWidth={2}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg {...LINE} width={18} height={18} strokeWidth={2.25}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}
