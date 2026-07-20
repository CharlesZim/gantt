import { themes } from "../themes/themes";
import type { Theme } from "../themes/types";

interface ThemeSelectorProps {
  theme: Theme;
  onChange: (id: string) => void;
}

export function ThemeSelector({ theme, onChange }: ThemeSelectorProps) {
  return (
    <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Thème">
      {themes.map((t) => {
        const active = t.id === theme.id;
        return (
          <button
            key={t.id}
            role="radio"
            aria-checked={active}
            title={t.name}
            onClick={() => onChange(t.id)}
            className="relative grid h-7 w-7 place-items-center rounded-full transition-transform hover:scale-110"
            style={{
              boxShadow: active
                ? `0 0 0 2px var(--surface), 0 0 0 4px ${t.barPalette[0]}`
                : "none",
            }}
          >
            <span
              className="block h-5 w-5 overflow-hidden rounded-full ring-1 ring-black/10"
              style={{
                background: `conic-gradient(${t.barPalette[0]} 0 25%, ${t.barPalette[1]} 0 50%, ${t.colors.surface} 0 75%, ${t.barPalette[2]} 0 100%)`,
              }}
            />
          </button>
        );
      })}
    </div>
  );
}
