/**
 * Size budgets per entry point (ADR 0015): the brotli size of each built
 * entry, with the shared chunks it loads. They measure the unminified files in
 * dist, an upper bound: applications ship less, because their bundler
 * minifies and drops what they don't import.
 */
export default [
  {
    name: "Server-safe entry (.), with the shared code it loads",
    path: ["dist/index.js", "dist/shared/*.js"],
    brotli: true,
    // 12 kB. It measures 11.6 kB with the button's component tokens. Each
    // module compressed on its own, in kB:
    //   theme/css-value.ts      2.6  the injection allowlist and type grammars
    //   tokens/definitions.ts   2.5  token metadata behind the `tokens` export;
    //                                it grows with every component's tokens
    //   theme/color.ts          1.6  colour parsing and WCAG contrast
    //   theme/css-writer.ts     1.5  the selector allowlist and CSS writer
    //   theme/create-theme.ts   1.5  validation, extends, built-in themes
    //   tokens/themes.ts        0.9  built-in semantic values
    //   tokens/base.ts          0.7  built-in base values
    //   the rest                1.2  contrast pairs and check, messages,
    //                                errors, registry, themeToCss
    // An application using only the built-in themes ships none of this: see
    // the ThemeProvider tree-shaking test in build.test.ts.
    limit: "12 kB",
  },
  {
    name: "React entry (./react), with the shared code it loads",
    path: ["dist/react.js", "dist/shared/*.js"],
    brotli: true,
    // 24 kB. It measures 23.71 kB with the Slider's onValueCommit, about
    // 0.2 kB; moving a clip before it took it from 22.5 kB to 23.5 kB. A
    // budget is raised by the pull request whose component needs it, to its
    // measurement rounded up to the next 0.5 kB. Applications ship only the
    // components they import: see build.test.ts.
    limit: "24 kB",
  },
  {
    name: "Stylesheet (./styles.css)",
    path: "dist/styles.css",
    brotli: true,
    // 9.5 kB. It measures 9.05 kB with lanes that let presses through;
    // the lanes before them took it from 8.5 kB to 9 kB. Raised as the React
    // entry's is: to the measurement, rounded up to the next 0.5 kB. Every
    // application loads the whole stylesheet, so this one is the cost of
    // every component.
    limit: "9.5 kB",
  },
];
