import { useMemo, useState } from "react";
import type { GanttState } from "../core/types";
import { buildSvg, svgDimensions } from "../export/buildSvg";
import { downloadBlob } from "../export/download";
import { svgToPng } from "../export/toPng";
import { svgToPdf } from "../export/toPdf";
import { getTheme, themes } from "../themes/themes";
import type { Theme } from "../themes/types";
import { slugify } from "./util";

type Format = "svg" | "png" | "pdf";

interface ExportModalProps {
  open: boolean;
  state: GanttState;
  currentThemeId: string;
  uiTheme: Theme;
  onClose: () => void;
}

const FORMATS: { value: Format; label: string; hint: string }[] = [
  { value: "pdf", label: "PDF", hint: "Vectoriel, net à tout zoom" },
  { value: "png", label: "PNG", hint: "Image, échelle réglable" },
  { value: "svg", label: "SVG", hint: "Vectoriel, éditable" },
];

export function ExportModal({ open, state, currentThemeId, uiTheme, onClose }: ExportModalProps) {
  const [format, setFormat] = useState<Format>("pdf");
  const [themeId, setThemeId] = useState(currentThemeId);
  const [scale, setScale] = useState(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportTheme = getTheme(themeId);
  const previewSvg = useMemo(
    () => (open ? buildSvg(state, exportTheme) : ""),
    [open, state, exportTheme],
  );

  if (!open) return null;

  const c = uiTheme.colors;

  const handleExport = async () => {
    setBusy(true);
    setError(null);
    try {
      const svg = buildSvg(state, exportTheme);
      const { width, height } = svgDimensions(state);
      const base = `${slugify(state.title)}-${exportTheme.id}`;

      if (format === "svg") {
        downloadBlob(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), `${base}.svg`);
      } else if (format === "png") {
        const { blob } = await svgToPng(svg, width, height, scale);
        downloadBlob(blob, `${base}.png`);
      } else {
        const blob = await svgToPdf(svg, width, height);
        downloadBlob(blob, `${base}.pdf`);
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'export");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl shadow-2xl"
        style={{ background: c.surface, color: c.text }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: `1px solid ${c.gridLine}` }}
        >
          <h2 className="text-lg font-bold">Exporter le diagramme</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 transition-colors hover:bg-black/10"
            style={{ color: c.textMuted }}
            aria-label="Fermer"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="grid gap-6 overflow-auto p-6 md:grid-cols-[1fr_260px]">
          {/* Preview */}
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: c.textMuted }}>
              Aperçu
            </div>
            <div
              className="export-preview overflow-hidden rounded-xl"
              style={{ border: `1px solid ${c.gridLine}`, background: exportTheme.colors.background }}
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: previewSvg }}
            />
          </div>

          {/* Controls */}
          <div className="flex flex-col gap-5">
            <Field label="Format">
              <div className="flex flex-col gap-2">
                {FORMATS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setFormat(f.value)}
                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors"
                    style={{
                      borderColor: format === f.value ? uiTheme.barPalette[0] : c.gridLine,
                      background: format === f.value ? withAlpha(uiTheme.barPalette[0], 0.08) : "transparent",
                    }}
                  >
                    <span className="text-sm font-semibold">{f.label}</span>
                    <span className="text-[11px]" style={{ color: c.textMuted }}>
                      {f.hint}
                    </span>
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Thème">
              <select
                value={themeId}
                onChange={(e) => setThemeId(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                style={{ borderColor: c.gridLine, background: c.background, color: c.text }}
              >
                {themes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>

            {format === "png" && (
              <Field label={`Échelle · ${scale}×`}>
                <div className="flex gap-2">
                  {[1, 2, 3].map((s) => (
                    <button
                      key={s}
                      onClick={() => setScale(s)}
                      className="flex-1 rounded-lg border py-1.5 text-sm font-semibold transition-colors"
                      style={{
                        borderColor: scale === s ? uiTheme.barPalette[0] : c.gridLine,
                        background: scale === s ? uiTheme.barPalette[0] : "transparent",
                        color: scale === s ? "#fff" : c.text,
                      }}
                    >
                      {s}×
                    </button>
                  ))}
                </div>
              </Field>
            )}

            {error && (
              <div className="rounded-lg bg-red-500/10 px-3 py-2 text-xs font-medium text-red-500">
                {error}
              </div>
            )}

            <button
              onClick={handleExport}
              disabled={busy}
              className="mt-auto flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform active:scale-95 disabled:opacity-60"
              style={{ background: uiTheme.barPalette[0] }}
            >
              {busy ? "Export en cours…" : `Exporter en ${format.toUpperCase()}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider opacity-70">{label}</div>
      {children}
    </div>
  );
}

function withAlpha(hex: string, alpha: number): string {
  const cc = hex.replace("#", "");
  const full = cc.length === 3 ? cc.split("").map((x) => x + x).join("") : cc;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
