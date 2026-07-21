import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { isHexColor, normalizeHex } from "../core/color";
import type { Theme } from "../themes/types";

interface ColorPickerProps {
  anchorRect: DOMRect;
  palette: string[];
  currentColor: string; // resolved hex currently shown
  isCustom: boolean; // true when the task has an explicit custom color
  theme: Theme;
  onPickPreset: (index: number) => void;
  onPickCustom: (hex: string) => void;
  onClose: () => void;
}

const POPOVER_W = 232;

export function ColorPicker({
  anchorRect,
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

  useEffect(() => setHex(currentColor), [currentColor]);

  // Keep the popover inside the viewport.
  const pos = useMemo(() => {
    const margin = 8;
    let left = anchorRect.left;
    let top = anchorRect.bottom + 6;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (left + POPOVER_W > vw - margin) left = vw - POPOVER_W - margin;
    if (left < margin) left = margin;
    // Flip above if not enough room below.
    if (top + 210 > vh - margin) top = Math.max(margin, anchorRect.top - 210);
    return { left, top };
  }, [anchorRect]);

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
