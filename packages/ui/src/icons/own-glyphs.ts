/**
 * Glyphs ui draws itself, for icons Lucide has no glyph for (docs/adr/0005,
 * as amended). They're ui's own code, under ui's licence, not Lucide's.
 *
 * Each is drawn as Lucide's are, so it sits with them: a 24-unit grid, a
 * stroke of 2 with round caps and joins (from `renderIcon`), and only the
 * shapes and attributes the generator allows. The generator validates them
 * exactly as it does Lucide's data.
 *
 * Development-time only, like the manifest: `pnpm --filter @hussmartinez/ui
 * icons` reads it.
 */
export const ownGlyphs = {
  // A bracket opening a range, and the range running on from it. A dot is a
  // path of no length, which the round cap draws as a dot, as Lucide's are.
  "range-start": [
    ["path", { d: "M9 4H5v16h4" }],
    ["path", { d: "M12 12h.01" }],
    ["path", { d: "M16 12h.01" }],
    ["path", { d: "M20 12h.01" }],
  ],
  // The mirror: the range running into a bracket that closes it.
  "range-end": [
    ["path", { d: "M15 4h4v16h-4" }],
    ["path", { d: "M4 12h.01" }],
    ["path", { d: "M8 12h.01" }],
    ["path", { d: "M12 12h.01" }],
  ],
} as const satisfies Record<string, readonly (readonly [string, Record<string, string>])[]>;
