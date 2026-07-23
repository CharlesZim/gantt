import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { isHexColor, normalizeHex } from "../core/color";
import type { Theme } from "../themes/types";

interface ColorPickerProps {
  /** Element the popover is positioned against; tracked while open. */
  anchor: HTMLElement;
  palette: string[];
  currentColor: string; // resolved hex currently shown
  isCustom: boolean; // true when the task has an explicit custom color
  theme: Theme;
  onPickPreset: (index: number) => void;
  onPickCustom: (hex: string) => void;
  onClose: () => void;
}

const POPOVER_W = 232;

const POPOVER_H = 210;

export function ColorPicker({
  anchor,
  palette,
  currentColor,
  isCustom,
  theme,
  onPickPreset,
  onPickCustom,
  onClose,
}: ColorPickerProps) {
  const c = theme.colors;
  const [hex, setHex] = useState(currentColor);
  const [pos, setPos] = useState({ left: 0, top: 0 });

  useEffect(() => setHex(currentColor), [currentColor]);

  // Keep the popover glued to its anchor and inside the viewport. Recomputed
  // on scroll and resize — a rect captured once detaches as soon as the list
  // behind it moves.
  const reposition = useCallback(() => {
    const rect = anchor.getBoundingClientRect();
    const margin = 8;
    let left = rect.left;
    let top = rect.bottom + 6;
    if (left + POPOVER_W > window.innerWidth - margin) {
      left = window.innerWidth - POPOVER_W - margin;
    }
    if (left < margin) left = margin;
    if (top + POPOVER_H > window.innerHeight - margin) {
      top = Math.max(margin, rect.top - POPOVER_H);
    }
    setPos({ left, top });
  }, [anchor]);

  useLayoutEffect(() => {
    reposition();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [reposition]);

  // Escape closes, matching every other popover in the app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const commitHex = (value: string) => {
    setHex(value);
    const norm = normalizeHex(value);
    if (norm) onPickCustom(norm);
  };

  return createPortal(
    <>
      <div className="fixed inset-0 z-[60]" onPointerDown={onClose} />
      <div
        role="dialog"
        aria-label="Choisir une couleur"
        className="fixed z-[61] rounded-xl p-3 shadow-2xl"
        style={{
          left: pos.left,
          top: pos.top,
          width: POPOVER_W,
          background: c.surface,
          color: c.text,
          border: `1px solid ${c.gridLineStrong}`,
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: c.textMuted }}>
          Palette du thème
        </div>
        <div className="mb-3 grid grid-cols-8 gap-1.5">
          {palette.map((color, i) => {
            const active = !isCustom && color.toLowerCase() === currentColor.toLowerCase();
            return (
              <button
                key={i}
                title={color}
                onClick={() => onPickPreset(i)}
                className="h-6 w-6 rounded-full transition-transform hover:scale-110"
                style={{
                  background: color,
                  boxShadow: active ? `0 0 0 2px ${c.surface}, 0 0 0 4px ${c.text}` : "inset 0 0 0 1px rgba(0,0,0,0.12)",
                }}
              />
            );
          })}
        </div>

        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: c.textMuted }}>
          Personnalisé
        </div>
        <div className="flex items-center gap-2">
          <label
            className="relative h-9 w-9 shrink-0 cursor-pointer overflow-hidden rounded-lg"
            style={{ background: isHexColor(hex) ? hex : currentColor, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.15)" }}
            title="Sélecteur de couleur"
          >
            <input
              type="color"
              value={isHexColor(hex) ? normalizeHex(hex)! : currentColor}
              onChange={(e) => commitHex(e.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>
          <div
            className="flex flex-1 items-center rounded-lg px-2"
            style={{ border: `1px solid ${c.gridLine}`, background: c.background }}
          >
            <span className="text-sm" style={{ color: c.textMuted }}>
              #
            </span>
            <input
              value={hex.replace(/^#/, "")}
              onChange={(e) => commitHex("#" + e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6))}
              onKeyDown={(e) => {
                if (e.key === "Enter") onClose();
              }}
              placeholder="4f46e5"
              spellCheck={false}
              className="w-full bg-transparent py-1.5 text-sm uppercase tracking-wide outline-none"
              style={{ color: c.text }}
              aria-label="Code hexadécimal"
            />
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
