import { snap as snapTo } from "@hussmartinez/sdk-core";
import {
  createContext,
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { warnInDevelopment } from "../../internal/development.js";
import { checkSingleCopy } from "../../internal/single-copy.js";
import { cx, type StyleProps, unstyledAttribute } from "../shared/style-props.js";

declare const process: { readonly env: { readonly NODE_ENV?: string } };

/** How close a pointer snaps to a target, in CSS pixels (sdk-core ADR 0042). */
const SNAP_PIXELS = 8;

/**
 * The widest a track gets, in CSS pixels. Engines stop laying out boxes
 * somewhere above sixteen million pixels, so the zoom stops well before.
 */
const MAX_TRACK_PIXELS = 8_000_000;

/**
 * A range of a timeline, in whole units: `start` is the first unit in it,
 * and `end` is the one after its last.
 *
 * @public
 */
export interface TimelineRange {
  readonly start: number;
  readonly end: number;
}

/**
 * How a {@link Timeline} maps its units to pixels, for the parts and layers
 * inside it. Units are whole numbers, such as frames or samples
 * (sdk-core ADR 0042).
 *
 * @public
 */
export interface TimelineScale {
  /** The timeline's length, in units. */
  readonly length: number;
  /**
   * CSS pixels for one unit at the current zoom. It's 0 until the timeline
   * has measured itself, which is after the first render in a browser, and
   * always on a server.
   */
  readonly pixelsPerUnit: number;
  /** A unit's distance from the start of the track, in CSS pixels. */
  readonly toPixels: (unit: number) => number;
  /**
   * The unit under a pointer, from its `clientX`, within `0…length`. It
   * follows the reading direction. With `snap`, it snaps to the timeline's
   * targets when `snapping` is on.
   */
  readonly unitAt: (clientX: number, options?: { readonly snap?: boolean }) => number;
  /** A unit snapped to the nearest target within reach, or itself. */
  readonly snap: (unit: number) => number;
  /** The units in view now. Read it when you draw; it isn't state. */
  readonly visibleRange: () => TimelineRange;
}

interface TimelineContextValue {
  readonly scale: TimelineScale;
  readonly viewport: RefObject<HTMLDivElement | null>;
  readonly track: RefObject<HTMLDivElement | null>;
  /** Adds snap targets that change over time, such as the playhead. */
  readonly addTargets: (read: () => readonly number[]) => () => void;
}

const TimelineContext = /* @__PURE__ */ createContext<TimelineContextValue | undefined>(undefined);

/** The enclosing timeline's context, for its own parts. */
export function useTimelineContext(part: string): TimelineContextValue | undefined {
  checkSingleCopy();
  const context = useContext(TimelineContext);
  if (!context) {
    if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
      warnInDevelopment(`${part} needs a Timeline above it.`);
    }
  }
  return context;
}

const NO_SCALE: TimelineScale = {
  length: 0,
  pixelsPerUnit: 0,
  toPixels: () => 0,
  unitAt: () => 0,
  snap: (unit) => unit,
  visibleRange: () => ({ start: 0, end: 0 }),
};

/**
 * The scale of the {@link Timeline} around a layer or a part: units to
 * pixels and back, snapping, and the range in view.
 *
 * @example
 * ```tsx
 * function Markers({ at }: { at: readonly number[] }) {
 *   const scale = useTimelineScale();
 *   // Draw each marker at scale.toPixels(unit); hit-test with scale.unitAt(event.clientX).
 * }
 * ```
 *
 * @public
 */
export function useTimelineScale(): TimelineScale {
  return useTimelineContext("useTimelineScale")?.scale ?? NO_SCALE;
}

/**
 * The parts of a timeline that `classNames` can target.
 *
 * @public
 */
export type TimelinePart = "root" | "viewport" | "track";

/**
 * Props of {@link Timeline}.
 *
 * @public
 */
export interface TimelineProps
  extends Omit<HTMLAttributes<HTMLElement>, "className">,
    StyleProps<TimelinePart> {
  /** The timeline's accessible name, such as "Timeline". Required. */
  readonly label: string;
  /** The length of what's on the timeline, in whole units, such as frames or samples. */
  readonly length: number;
  /**
   * The zoom, as a multiple of fitting `length` to the timeline's width.
   * Defaults to 1, which fits; less than 1 fits too.
   */
  readonly zoom?: number | undefined;
  /** The closest zoom, in CSS pixels for one unit. Defaults to 48. */
  readonly maxPixelsPerUnit?: number | undefined;
  /**
   * Called with the largest `zoom` that has an effect, when it changes with
   * the timeline's width or `length`, so zoom controls know when to stop.
   */
  readonly onMaxZoomChange?: ((maxZoom: number) => void) | undefined;
  /**
   * Whether pointers snap to targets, within 8 CSS pixels. Defaults to
   * `true`. Holding Alt turns it off for one gesture.
   */
  readonly snapping?: boolean | undefined;
  /** More units to snap to, such as markers. The playhead and the clips' boundaries always are. */
  readonly snapTargets?: readonly number[] | undefined;
  /**
   * Called with the units in view when they change, by scrolling, zooming
   * or resizing: for a layer that draws only what's visible, such as a
   * waveform on a canvas.
   */
  readonly onVisibleRangeChange?: ((range: TimelineRange) => void) | undefined;
  /** The timeline's parts and layers, in the order they stack. */
  readonly children?: ReactNode;
}

/** Whether an element lays out right to left. */
const isRtl = (element: Element): boolean => getComputedStyle(element).direction === "rtl";

/**
 * A timeline over whole units, such as frames or samples: a scrolling track
 * as wide as `length` at the current zoom, for a playhead, clips and an
 * editor's own layers (docs/adr/0011). It formats no time and has no text
 * of its own: names and values come from you.
 *
 * - **Zoom** is yours: `zoom` is a multiple of fitting `length` to the
 *   width, and `onMaxZoomChange` says where it stops.
 * - **Snapping** pulls a pointer to the playhead, the clips' boundaries and
 *   your `snapTargets`, within 8 CSS pixels at any zoom.
 * - **Layers** are your own drawing, such as a waveform, sized to the
 *   track. `useTimelineScale()` gives them the same mapping the parts use.
 *
 * @example
 * ```tsx
 * <Timeline label={t("timeline.label")} length={frames} zoom={zoom} onMaxZoomChange={setMaxZoom}>
 *   <TimelineLayer>
 *     <Waveform />
 *   </TimelineLayer>
 *   <TimelinePlayhead
 *     label={t("timeline.playhead")}
 *     position={playhead}
 *     onPositionChange={seek}
 *     largeStep={framesPerSecond}
 *     formatValue={formatTime}
 *   />
 * </Timeline>
 * ```
 *
 * @public
 */
export const Timeline = /* @__PURE__ */ forwardRef<HTMLElement, TimelineProps>(function Timeline(
  {
    label,
    length: rawLength,
    zoom = 1,
    maxPixelsPerUnit = 48,
    onMaxZoomChange,
    snapping = true,
    snapTargets,
    onVisibleRangeChange,
    className,
    classNames,
    unstyled,
    children,
    ...props
  },
  ref,
) {
  const length = Number.isSafeInteger(rawLength) && rawLength > 0 ? rawLength : 0;
  const viewport = useRef<HTMLDivElement | null>(null);
  const track = useRef<HTMLDivElement | null>(null);
  // The width the track has to fit into; 0 until it's measured.
  const [room, setRoom] = useState(0);
  // The viewport's padding before the track, which scrolls with it.
  const lead = useRef(0);
  const targets = useRef(new Set<() => readonly number[]>());

  // Measured and sized when React commits, through ref callbacks, so the
  // first frame painted is already sized. A ref callback runs only in a
  // browser, so nothing here reads the browser on a server, and there's no
  // layout effect for React 18 to warn about there.
  const measure = (element: HTMLDivElement): void => {
    const style = getComputedStyle(element);
    const padding = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight);
    lead.current = Number.parseFloat(style.paddingInlineStart) || 0;
    // The same width again changes nothing, so this settles in one more render.
    setRoom(Math.max(0, element.clientWidth - padding));
  };
  const remeasure = useRef(measure);
  remeasure.current = measure;
  useEffect(() => {
    const element = viewport.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver(() => remeasure.current(element));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const fit = length > 0 && room > 0 ? room / length : 0;
  // Never closer than one unit to maxPixelsPerUnit, nor a track too wide to
  // lay out, and never further than fitting.
  const closest = Math.max(fit, Math.min(maxPixelsPerUnit, MAX_TRACK_PIXELS / Math.max(length, 1)));
  const pixelsPerUnit = Math.min(Math.max(fit * zoom, fit), closest);
  const maxZoom = fit > 0 ? closest / fit : 1;

  const notifyMaxZoom = useRef(onMaxZoomChange);
  notifyMaxZoom.current = onMaxZoomChange;
  useEffect(() => {
    if (fit > 0) {
      notifyMaxZoom.current?.(maxZoom);
    }
  }, [fit, maxZoom]);

  // Sizes go through the CSSOM: a style attribute would be blocked by a
  // strict Content Security Policy when rendered on a server.
  const sizeTrack = (element: HTMLDivElement): void => {
    element.style.inlineSize = pixelsPerUnit > 0 ? `${length * pixelsPerUnit}px` : "";
  };

  const settings = useRef({ snapping, snapTargets });
  settings.current = { snapping, snapTargets };

  const scale = useMemo<TimelineScale>(() => {
    const snap = (unit: number): number => {
      if (!settings.current.snapping || pixelsPerUnit <= 0) {
        return unit;
      }
      const all = [...(settings.current.snapTargets ?? [])];
      for (const read of targets.current) {
        all.push(...read());
      }
      const valid = all.filter((target) => Number.isSafeInteger(target) && target >= 0);
      return snapTo(unit, valid, Math.round(SNAP_PIXELS / pixelsPerUnit));
    };
    return {
      length,
      pixelsPerUnit,
      toPixels: (unit) => unit * pixelsPerUnit,
      unitAt: (clientX, options) => {
        const element = track.current;
        if (!element || pixelsPerUnit <= 0) {
          return 0;
        }
        const box = element.getBoundingClientRect();
        const offset = isRtl(element) ? box.right - clientX : clientX - box.left;
        const unit = Math.min(Math.max(Math.round(offset / pixelsPerUnit), 0), length);
        return options?.snap ? Math.min(snap(unit), length) : unit;
      },
      snap,
      visibleRange: () => {
        const element = viewport.current;
        if (!element || pixelsPerUnit <= 0) {
          return { start: 0, end: length };
        }
        // scrollLeft is negative in right-to-left text. The track starts
        // after the viewport's padding.
        const start = (Math.abs(element.scrollLeft) - lead.current) / pixelsPerUnit;
        return {
          start: Math.min(Math.max(Math.floor(start), 0), length),
          end: Math.min(
            Math.max(Math.ceil(start + element.clientWidth / pixelsPerUnit), 0),
            length,
          ),
        };
      },
    };
  }, [length, pixelsPerUnit]);

  const addTargets = useCallback((read: () => readonly number[]) => {
    targets.current.add(read);
    return () => {
      targets.current.delete(read);
    };
  }, []);

  const notifyRange = useRef(onVisibleRangeChange);
  notifyRange.current = onVisibleRangeChange;
  const lastRange = useRef("");
  const reportRange = useCallback((): void => {
    const range = scale.visibleRange();
    const key = `${range.start}:${range.end}`;
    if (key !== lastRange.current && scale.pixelsPerUnit > 0) {
      lastRange.current = key;
      notifyRange.current?.(range);
    }
  }, [scale]);
  // After a zoom, a resize or a change of length; scrolling reports itself.
  // biome-ignore lint/correctness/useExhaustiveDependencies: room changes the range without changing the scale's identity when the zoom is capped.
  useEffect(reportRange, [reportRange, room]);

  const context = useMemo<TimelineContextValue>(
    () => ({ scale, viewport, track, addTargets }),
    [scale, addTargets],
  );

  return (
    <section
      {...props}
      ref={ref}
      aria-label={label}
      className={cx("hm-timeline", classNames?.root, className)}
      data-hm-unstyled={unstyledAttribute(unstyled)}
    >
      <div
        // A new function each render, so React calls it at every commit.
        ref={(node) => {
          viewport.current = node;
          if (node) {
            measure(node);
          }
        }}
        className={cx("hm-timeline-viewport", classNames?.viewport)}
        onScroll={reportRange}
      >
        <div
          ref={(node) => {
            track.current = node;
            if (node) {
              sizeTrack(node);
            }
          }}
          className={cx("hm-timeline-track", classNames?.track)}
        >
          <TimelineContext.Provider value={context}>{children}</TimelineContext.Provider>
        </div>
      </div>
    </section>
  );
});

/**
 * Props of {@link TimelineLayer}.
 *
 * @public
 */
export interface TimelineLayerProps extends HTMLAttributes<HTMLDivElement> {
  /** Your drawing: a canvas, markers, a selection. Size it to the layer. */
  readonly children?: ReactNode;
}

/**
 * A layer of a {@link Timeline} for an editor's own drawing, such as a
 * waveform or a selected range: a box the size of the track. Layers and
 * parts stack in the order written. A layer is as tall as its content, and
 * at least `--hm-timeline-lane-height`.
 *
 * What a layer draws is invisible to assistive technology unless you say
 * otherwise, so give a text equivalent elsewhere, and mark a canvas
 * `aria-hidden`.
 *
 * @public
 */
export const TimelineLayer = /* @__PURE__ */ forwardRef<HTMLDivElement, TimelineLayerProps>(
  function TimelineLayer({ className, children, ...props }, ref) {
    return (
      <div {...props} ref={ref} className={cx("hm-timeline-layer", className)}>
        {children}
      </div>
    );
  },
);
