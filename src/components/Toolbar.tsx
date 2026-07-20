import { useEffect, useState } from "react";
import type { TimeUnit } from "../core/types";
import type { Theme } from "../themes/types";
import { ThemeSelector } from "./ThemeSelector";

interface ToolbarProps {
  title: string;
  unit: TimeUnit;
  theme: Theme;
  onTitleChange: (title: string) => void;
  onUnitChange: (unit: TimeUnit) => void;
  onThemeChange: (id: string) => void;
  onExport: () => void;
}

const UNITS: { value: TimeUnit; label: string }[] = [
  { value: "day", label: "Jour" },
  { value: "week", label: "Semaine" },
  { value: "month", label: "Mois" },
];

export function Toolbar({
  title,
  unit,
  theme,
  onTitleChange,
  onUnitChange,
  onThemeChange,
  onExport,
}: ToolbarProps) {
  const c = theme.colors;
  const [draft, setDraft] = useState(title);
  useEffect(() => setDraft(title), [title]);

  return (
    <header
      className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
      style={{ background: c.surface, borderBottom: `1px solid ${c.gridLineStrong}` }}
    >
      <div className="flex items-center gap-2.5">
        <Logo color={theme.barPalette[0]} />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => onTitleChange(draft.trim() || "Sans titre")}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="min-w-0 max-w-[42vw] rounded-md bg-transparent px-1.5 py-1 text-lg font-bold outline-none focus:ring-2"
          style={{ color: c.text }}
          aria-label="Titre du projet"
          spellCheck={false}
        />
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-3">
        {/* Zoom */}
        <div
          className="flex items-center rounded-lg p-0.5"
          style={{ background: c.background, border: `1px solid ${c.gridLine}` }}
          role="radiogroup"
          aria-label="Zoom"
        >
          {UNITS.map((u) => {
            const active = u.value === unit;
            return (
              <button
                key={u.value}
                role="radio"
                aria-checked={active}
                onClick={() => onUnitChange(u.value)}
                className="rounded-md px-3 py-1 text-xs font-semibold transition-colors"
                style={{
                  background: active ? theme.barPalette[0] : "transparent",
                  color: active ? "#fff" : c.textMuted,
                }}
              >
                {u.label}
              </button>
            );
          })}
        </div>

        <div className="hidden h-6 w-px sm:block" style={{ background: c.gridLine }} />

        <ThemeSelector theme={theme} onChange={onThemeChange} />

        <div className="hidden h-6 w-px sm:block" style={{ background: c.gridLine }} />

        <button
          onClick={onExport}
          className="flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm transition-transform active:scale-95"
          style={{ background: theme.barPalette[0] }}
        >
          <DownloadIcon />
          Exporter
        </button>
      </div>
    </header>
  );
}

function Logo({ color }: { color: string }) {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" className="shrink-0">
      <rect width="32" height="32" rx="7" fill={color} />
      <rect x="6" y="8" width="14" height="4" rx="2" fill="#fff" opacity="0.95" />
      <rect x="10" y="14" width="16" height="4" rx="2" fill="#fff" opacity="0.7" />
      <rect x="7" y="20" width="11" height="4" rx="2" fill="#fff" opacity="0.85" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
