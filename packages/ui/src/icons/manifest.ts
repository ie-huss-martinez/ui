/**
 * ui's icon names and the Lucide glyph behind each (docs/adr/0005). Names
 * describe what an icon is for in the SDK family, not what it draws, so a
 * glyph can change, or Lucide can rename it, without breaking anyone.
 *
 * `mirror` marks icons that point along the reading direction, which flip in
 * right-to-left text. Media controls, rotations and physical directions, such
 * as the chevrons, don't.
 *
 * `own` names a glyph ui draws itself, in `own-glyphs.ts`, for an icon
 * Lucide has no glyph for (docs/adr/0005, as amended).
 *
 * Development-time only: `pnpm --filter @hussmartinez/ui icons` reads it to
 * write `icons.generated.tsx`. Add an icon here, then regenerate.
 */
/** Where an icon's glyph comes from: Lucide's data, or ui's own. */
export type IconSource =
  | { readonly lucide: string; readonly own?: undefined; readonly mirror?: boolean }
  | { readonly own: string; readonly lucide?: undefined; readonly mirror?: boolean };

export const iconManifest = {
  add: { lucide: "plus" },
  arrow: { lucide: "move-up-right" },
  check: { lucide: "check" },
  "chevron-down": { lucide: "chevron-down" },
  "chevron-left": { lucide: "chevron-left" },
  "chevron-right": { lucide: "chevron-right" },
  close: { lucide: "x" },
  crop: { lucide: "crop" },
  delete: { lucide: "trash" },
  download: { lucide: "download" },
  duplicate: { lucide: "copy" },
  ellipse: { lucide: "ellipse" },
  "fade-in": { lucide: "chart-no-axes-column-increasing" },
  "fade-out": { lucide: "chart-no-axes-column-decreasing" },
  fit: { lucide: "scan" },
  "flip-horizontal": { lucide: "triangles-centerline-dashed-vertical" },
  "flip-vertical": { lucide: "triangles-centerline-dashed-horizontal" },
  hidden: { lucide: "eye-off" },
  highlighter: { lucide: "highlighter" },
  image: { lucide: "image" },
  info: { lucide: "info" },
  layers: { lucide: "layers" },
  loop: { lucide: "repeat" },
  menu: { lucide: "menu" },
  more: { lucide: "ellipsis" },
  "move-down": { lucide: "arrow-down" },
  "move-up": { lucide: "arrow-up" },
  muted: { lucide: "volume-x" },
  open: { lucide: "folder-open" },
  "page-add": { lucide: "file-plus" },
  "page-grid": { lucide: "grid-2x2" },
  "page-single": { lucide: "file" },
  pan: { lucide: "hand" },
  pause: { lucide: "pause" },
  pen: { lucide: "pen" },
  play: { lucide: "play" },
  "range-end": { own: "range-end", mirror: true },
  "range-start": { own: "range-start", mirror: true },
  rectangle: { lucide: "rectangle-horizontal" },
  redact: { lucide: "rectangle-ellipsis" },
  redo: { lucide: "redo-2", mirror: true },
  remove: { lucide: "minus" },
  ripple: { lucide: "fold-horizontal" },
  "rotate-left": { lucide: "rotate-ccw" },
  "rotate-right": { lucide: "rotate-cw" },
  search: { lucide: "search" },
  select: { lucide: "mouse-pointer-2" },
  "skip-back": { lucide: "skip-back" },
  "skip-forward": { lucide: "skip-forward" },
  snap: { lucide: "magnet" },
  split: { lucide: "scissors" },
  stop: { lucide: "square" },
  text: { lucide: "type" },
  "trim-end": { lucide: "arrow-left-from-line" },
  "trim-start": { lucide: "arrow-right-from-line" },
  undo: { lucide: "undo-2", mirror: true },
  upload: { lucide: "upload" },
  visible: { lucide: "eye" },
  volume: { lucide: "volume-2" },
  warning: { lucide: "triangle-exclamation-point" },
  "zoom-in": { lucide: "zoom-in" },
  "zoom-out": { lucide: "zoom-out" },
} as const satisfies Record<string, IconSource>;
