import { useEffect, useState } from "react";
import type { TimeUnit } from "../core/types";
import type { Theme } from "../themes/types";

interface ToolbarProps {
  title: string;
  unit: TimeUnit;
  theme: Theme;
  onTitleChange: (title: string) => void;
  onUnitChange: (unit: TimeUnit) => void;
  onToggleDark: () => void;
  onExport: () => void;
}

const UNITS: { value: TimeUnit; label: string; short: string }[] = [
  { value: "day", label: "Jour", short: "J" },
  { value: "week", label: "Semaine", short: "S" },
  { value: "month", label: "Mois", short: "M" },
];

export function Toolbar({
  title,
  unit,
  theme,
  onTitleChange,
  onUnitChange,
  onToggleDark,
  onExport,
}: ToolbarProps) {
  const c = theme.colors;
  const [draft, setDraft] = useState(title);
  useEffect(() => setDraft(title), [title]);

  const isDark = theme.id === "dark" || theme.id === "blueprint";

  return (
    <header
      className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:px-4 sm:py-3"
      style={{ background: c.surface, borderBottom: `1px solid ${c.gridLineStrong}` }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
        <Logo color={theme.barPalette[0]} />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => onTitleChange(draft.trim() || "Sans titre")}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="min-w-0 flex-1 rounded-md bg-transparent px-1.5 py-1 text-base font-bold outline-none focus:ring-2 sm:max-w-[42vw] sm:text-lg"
          style={{ color: c.text }}
          aria-label="Titre du projet"
          spellCheck={false}
        />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 sm:ml-auto sm:gap-3">
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
                className="rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors sm:px-3"
                style={{
                  background: active ? theme.barPalette[0] : "transparent",
                  color: active ? "#fff" : c.textMuted,
                }}
                title={u.label}
              >
                <span className="sm:hidden">{u.short}</span>
                <span className="hidden sm:inline">{u.label}</span>
              </button>
            );
          })}
        </div>

        {/* Light / dark toggle */}
        <button
          onClick={onToggleDark}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors"
          style={{ background: c.background, border: `1px solid ${c.gridLine}`, color: c.text }}
          title={isDark ? "Passer en clair" : "Passer en sombre"}
          aria-label={isDark ? "Passer en mode clair" : "Passer en mode sombre"}
        >
          {isDark ? <SunIcon /> : <MoonIcon />}
        </button>

        <button
          onClick={onExport}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-white shadow-sm transition-transform active:scale-95 sm:px-3.5"
          style={{ background: theme.barPalette[0] }}
        >
          <DownloadIcon />
          <span className="hidden sm:inline">Exporter</span>
        </button>
      </div>
    </header>
  );
}

function Logo({ color }: { color: string }) {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" className="hidden shrink-0 sm:block">
      <rect width="32" height="32" rx="7" fill={color} />
      <rect x="6" y="8" width="14" height="4" rx="2" fill="#fff" opacity="0.95" />
      <rect x="10" y="14" width="16" height="4" rx="2" fill="#fff" opacity="0.7" />
      <rect x="7" y="20" width="11" height="4" rx="2" fill="#fff" opacity="0.85" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
