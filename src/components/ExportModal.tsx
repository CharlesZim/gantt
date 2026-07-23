import { useEffect, useMemo, useState } from "react";
import type { GanttState } from "../core/types";
import { buildStandaloneSvg, buildSvg, svgDimensions, type BuildSvgOptions } from "../export/buildSvg";
import { downloadBlob } from "../export/download";
import { layoutPage, PAPERS, suggestOrientation, type Orientation, type PaperId } from "../export/paper";
import { svgToPdf } from "../export/toPdf";
import { svgToPng } from "../export/toPng";
import { getTheme, themes } from "../themes/themes";
import type { Theme } from "../themes/types";
import { slugify, withAlpha } from "./util";

type Format = "svg" | "png" | "pdf";

interface ExportModalProps {
  open: boolean;
  state: GanttState;
  currentThemeId: string;
  uiTheme: Theme;
  onClose: () => void;
}

const FORMATS: { value: Format; label: string; hint: string }[] = [
  { value: "pdf", label: "PDF", hint: "Vectoriel, texte sélectionnable" },
  { value: "png", label: "PNG", hint: "Image, typographie exacte" },
  { value: "svg", label: "SVG", hint: "Vectoriel, éditable" },
];

export function ExportModal({ open, state, currentThemeId, uiTheme, onClose }: ExportModalProps) {
  const [format, setFormat] = useState<Format>("pdf");
  const [themeId, setThemeId] = useState(currentThemeId);
  const [scale, setScale] = useState(2);
  const [transparent, setTransparent] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [showFooter, setShowFooter] = useState(true);
  const [paper, setPaper] = useState<PaperId>("a4");
  const [orientation, setOrientation] = useState<Orientation>("landscape");
  const [marginPt, setMarginPt] = useState(28);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setThemeId(currentThemeId);
  }, [open, currentThemeId]);

  const exportTheme = getTheme(themeId);

  const svgOptions: BuildSvgOptions = useMemo(
    () => ({
      showLegend,
      showFooter,
      transparent: format === "png" && transparent,
    }),
    [showLegend, showFooter, transparent, format],
  );

  const dims = useMemo(() => svgDimensions(state, svgOptions), [state, svgOptions]);

  // Preview is built without embedded fonts — the app already has Inter loaded,
  // and inlining ~400 KB of base64 on every keystroke would be wasteful.
  const previewSvg = useMemo(
    () => (open ? buildSvg(state, exportTheme, svgOptions) : ""),
    [open, state, exportTheme, svgOptions],
  );

  // Default the orientation to whatever wastes the least paper.
  useEffect(() => {
    setOrientation(suggestOrientation(dims));
  }, [dims.width, dims.height]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const c = uiTheme.colors;
  const page = layoutPage(dims, paper, orientation, marginPt);
  const pngW = Math.round(dims.width * scale);
  const pngH = Math.round(dims.height * scale);

  const handleExport = async () => {
    setBusy(true);
    setError(null);
    try {
      const svg = await buildStandaloneSvg(state, exportTheme, svgOptions);
      const base = `${slugify(state.title)}-${exportTheme.id}`;

      if (format === "svg") {
        downloadBlob(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), `${base}.svg`);
      } else if (format === "png") {
        const { blob } = await svgToPng(svg, dims.width, dims.height, scale);
        downloadBlob(blob, `${base}.png`);
      } else {
        const { blob } = await svgToPdf(svg, dims.width, dims.height, {
          paper,
          orientation,
          marginPt,
          background: exportTheme.colors.background,
          fontKind: exportTheme.fontKind,
        });
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
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl shadow-2xl"
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

        <div className="grid gap-6 overflow-auto p-6 md:grid-cols-[1fr_280px]">
          {/* Preview */}
          <div className="min-w-0">
            <div
              className="mb-2 flex items-baseline justify-between text-xs font-semibold uppercase tracking-wider"
              style={{ color: c.textMuted }}
            >
              <span>Aperçu</span>
              <span className="tabular-nums normal-case tracking-normal">
                {format === "png"
                  ? `${pngW} × ${pngH} px`
                  : format === "pdf"
                    ? `${Math.round(page.pageWidth)} × ${Math.round(page.pageHeight)} pt${
                        page.scale < 1 ? ` · réduit à ${Math.round(page.scale * 100)} %` : ""
                      }`
                    : `${Math.round(dims.width)} × ${Math.round(dims.height)} px`}
              </span>
            </div>
            <div
              className="export-preview checker overflow-hidden rounded-xl"
              style={{
                border: `1px solid ${c.gridLine}`,
                background: svgOptions.transparent ? undefined : exportTheme.colors.background,
              }}
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: previewSvg }}
            />
          </div>

          {/* Controls */}
          <div className="flex flex-col gap-5">
            <Field label="Format" theme={uiTheme}>
              <div className="flex flex-col gap-2">
                {FORMATS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setFormat(f.value)}
                    className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-colors"
                    style={{
                      borderColor: format === f.value ? c.accent : c.gridLine,
                      background: format === f.value ? withAlpha(c.accent, 0.08) : "transparent",
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

            <Field label="Thème" theme={uiTheme}>
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

            {format === "pdf" && (
              <>
                <Field label="Format de page" theme={uiTheme}>
                  <div className="grid grid-cols-2 gap-2">
                    {PAPERS.map((p) => (
                      <Chip
                        key={p.id}
                        active={paper === p.id}
                        theme={uiTheme}
                        onClick={() => setPaper(p.id)}
                      >
                        {p.label}
                      </Chip>
                    ))}
                  </div>
                </Field>

                <Field label="Orientation" theme={uiTheme}>
                  <div className="grid grid-cols-2 gap-2">
                    <Chip
                      active={orientation === "landscape"}
                      theme={uiTheme}
                      onClick={() => setOrientation("landscape")}
                    >
                      Paysage
                    </Chip>
                    <Chip
                      active={orientation === "portrait"}
                      theme={uiTheme}
                      onClick={() => setOrientation("portrait")}
                    >
                      Portrait
                    </Chip>
                  </div>
                </Field>

                <Field label={`Marge · ${Math.round(marginPt)} pt`} theme={uiTheme}>
                  <input
                    type="range"
                    min={0}
                    max={72}
                    step={4}
                    value={marginPt}
                    onChange={(e) => setMarginPt(Number(e.target.value))}
                    className="w-full accent-[var(--accent)]"
                    aria-label="Marge de page"
                  />
                </Field>
              </>
            )}

            {format === "png" && (
              <>
                <Field label={`Échelle · ${scale}×`} theme={uiTheme}>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4].map((s) => (
                      <Chip key={s} active={scale === s} theme={uiTheme} onClick={() => setScale(s)}>
                        {s}×
                      </Chip>
                    ))}
                  </div>
                </Field>
                <Toggle
                  label="Fond transparent"
                  checked={transparent}
                  onChange={setTransparent}
                  theme={uiTheme}
                />
              </>
            )}

            <Field label="Contenu" theme={uiTheme}>
              <div className="flex flex-col gap-2">
                <Toggle label="Légende" checked={showLegend} onChange={setShowLegend} theme={uiTheme} />
                <Toggle
                  label="Date de génération"
                  checked={showFooter}
                  onChange={setShowFooter}
                  theme={uiTheme}
                />
              </div>
            </Field>

            {error && (
              <div className="rounded-lg bg-red-500/10 px-3 py-2 text-xs font-medium text-red-500">
                {error}
              </div>
            )}

            <button
              onClick={handleExport}
              disabled={busy}
              className="mt-auto flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold shadow-sm transition-transform active:scale-95 disabled:opacity-60"
              style={{ background: c.accent, color: c.onAccent }}
            >
              {busy ? "Export en cours…" : `Exporter en ${format.toUpperCase()}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  theme,
  children,
}: {
  label: string;
  theme: Theme;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        className="mb-2 text-xs font-semibold uppercase tracking-wider"
        style={{ color: theme.colors.textMuted }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function Chip({
  active,
  theme,
  onClick,
  children,
}: {
  active: boolean;
  theme: Theme;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const c = theme.colors;
  return (
    <button
      onClick={onClick}
      className="rounded-lg border py-1.5 text-sm font-semibold transition-colors"
      style={{
        borderColor: active ? c.accent : c.gridLine,
        background: active ? c.accent : "transparent",
        color: active ? c.onAccent : c.text,
      }}
    >
      {children}
    </button>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  theme,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  theme: Theme;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-[var(--accent)]"
      />
      <span style={{ color: theme.colors.text }}>{label}</span>
    </label>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
