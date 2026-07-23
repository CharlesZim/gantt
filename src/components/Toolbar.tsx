import { useEffect, useRef, useState } from "react";
import type { TimeUnit } from "../core/types";
import { BRAND_GRADIENT, themes } from "../themes/themes";
import type { Theme } from "../themes/types";
import { withAlpha } from "./util";

interface ToolbarProps {
  title: string;
  unit: TimeUnit;
  theme: Theme;
  canUndo: boolean;
  canRedo: boolean;
  onTitleChange: (title: string) => void;
  onUnitChange: (unit: TimeUnit) => void;
  onThemeChange: (themeId: string) => void;
  onToggleDark: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onFit: () => void;
  onToday: () => void;
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
  canUndo,
  canRedo,
  onTitleChange,
  onUnitChange,
  onThemeChange,
  onToggleDark,
  onUndo,
  onRedo,
  onFit,
  onToday,
  onExport,
}: ToolbarProps) {
  const c = theme.colors;
  const [draft, setDraft] = useState(title);
  useEffect(() => setDraft(title), [title]);

  return (
    <header
      className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:px-4 sm:py-3"
      style={{ background: c.surface, borderBottom: `1px solid ${c.gridLineStrong}` }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
        <Logo />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => onTitleChange(draft.trim() || "Sans titre")}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="min-w-0 flex-1 rounded-md bg-transparent px-1.5 py-1 text-base font-bold outline-none focus:ring-2 sm:max-w-[34vw] sm:text-lg"
          style={{ color: c.text }}
          aria-label="Titre du projet"
          spellCheck={false}
        />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 sm:ml-auto sm:gap-2.5">
        {/* Undo / redo */}
        <div
          className="flex items-center rounded-lg p-0.5"
          style={{ background: c.background, border: `1px solid ${c.gridLine}` }}
        >
          <IconButton label="Annuler (⌘Z)" theme={theme} disabled={!canUndo} onClick={onUndo}>
            <UndoIcon />
          </IconButton>
          <IconButton label="Rétablir (⇧⌘Z)" theme={theme} disabled={!canRedo} onClick={onRedo}>
            <RedoIcon />
          </IconButton>
        </div>

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
                  background: active ? c.accent : "transparent",
                  color: active ? c.onAccent : c.textMuted,
                }}
                title={u.label}
              >
                <span className="sm:hidden">{u.short}</span>
                <span className="hidden sm:inline">{u.label}</span>
              </button>
            );
          })}
        </div>

        <div
          className="flex items-center rounded-lg p-0.5"
          style={{ background: c.background, border: `1px solid ${c.gridLine}` }}
        >
          <IconButton label="Ajuster à la fenêtre" theme={theme} onClick={onFit}>
            <FitIcon />
          </IconButton>
          <IconButton label="Aller à aujourd'hui" theme={theme} onClick={onToday}>
            <TodayIcon />
          </IconButton>
        </div>

        <ThemeMenu theme={theme} onThemeChange={onThemeChange} onToggleDark={onToggleDark} />

        <button
          onClick={onExport}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold shadow-sm transition-transform active:scale-95 sm:px-3.5"
          style={{ background: c.accent, color: c.onAccent }}
        >
          <DownloadIcon />
          <span className="hidden sm:inline">Exporter</span>
        </button>
      </div>
    </header>
  );
}

/**
 * Theme control. The previous version was a bare light/dark toggle, which made
 * two of the four themes unreachable — this exposes all of them, and keeps the
 * one-click light/dark flip.
 */
function ThemeMenu({
  theme,
  onThemeChange,
  onToggleDark,
}: {
  theme: Theme;
  onThemeChange: (id: string) => void;
  onToggleDark: () => void;
}) {
  const c = theme.colors;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative flex items-center rounded-lg p-0.5" style={{ background: c.background, border: `1px solid ${c.gridLine}` }}>
      <IconButton
        label={theme.dark ? "Passer en clair" : "Passer en sombre"}
        theme={theme}
        onClick={onToggleDark}
      >
        {theme.dark ? <SunIcon /> : <MoonIcon />}
      </IconButton>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Choisir un thème"
        className="flex h-8 items-center gap-1 rounded-md px-1.5 text-xs font-semibold"
        style={{ color: c.textMuted }}
      >
        <span className="hidden sm:inline">{theme.name}</span>
        <ChevronIcon />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-full z-50 mt-1.5 w-44 rounded-xl p-1 shadow-2xl"
          style={{ background: c.surface, border: `1px solid ${c.gridLineStrong}` }}
        >
          {themes.map((t) => {
            const active = t.id === theme.id;
            return (
              <button
                key={t.id}
                role="option"
                aria-selected={active}
                onClick={() => {
                  onThemeChange(t.id);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm"
                style={{
                  background: active ? withAlpha(c.accent, 0.1) : "transparent",
                  color: c.text,
                }}
              >
                <span
                  className="h-4 w-4 shrink-0 rounded-full"
                  style={{
                    background: t.colors.surface,
                    boxShadow: `inset 0 0 0 1px ${t.colors.gridLineStrong}, inset -6px 0 0 -2px ${t.barPalette[0]}`,
                  }}
                />
                <span className="flex-1">{t.name}</span>
                {active && <CheckIcon />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function IconButton({
  label,
  theme,
  disabled,
  onClick,
  children,
}: {
  label: string;
  theme: Theme;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-md transition-colors disabled:opacity-35"
      style={{ color: theme.colors.text }}
    >
      {children}
    </button>
  );
}

function Logo() {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" className="hidden shrink-0 sm:block" aria-hidden>
      <defs>
        <linearGradient id="brand" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor={BRAND_GRADIENT[0]} />
          <stop offset="50%" stopColor={BRAND_GRADIENT[1]} />
          <stop offset="100%" stopColor={BRAND_GRADIENT[2]} />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="7" fill="url(#brand)" />
      <rect x="6" y="8" width="14" height="4" rx="2" fill="#fff" opacity="0.95" />
      <rect x="10" y="14" width="16" height="4" rx="2" fill="#fff" opacity="0.72" />
      <rect x="7" y="20" width="11" height="4" rx="2" fill="#fff" opacity="0.86" />
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

function UndoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7v6h6" />
      <path d="M3 13a9 9 0 1 0 3-7.7L3 8" />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 7v6h-6" />
      <path d="M21 13a9 9 0 1 1-3-7.7L21 8" />
    </svg>
  );
}

function FitIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3H5a2 2 0 0 0-2 2v4M15 3h4a2 2 0 0 1 2 2v4M9 21H5a2 2 0 0 1-2-2v-4M15 21h4a2 2 0 0 0 2-2v-4" />
    </svg>
  );
}

function TodayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <circle cx="12" cy="15" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
