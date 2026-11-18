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
import { setStyle } from "./set-style.js";

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
  /** The timeline's length, in units: as far as the playhead goes. */
  readonly length: number;
  /**
   * How far the track is drawn, in units: `length`, or more when clips run
   * past it.
   */
  readonly extent: number;
  /**
   * CSS pixels for one unit at the current zoom. It's 0 until the timeline
   * has measured itself, which is after the first render in a browser, and
   * always on a server.
   */
  readonly pixelsPerUnit: number;
  /** A unit's distance from the start of the track, in CSS pixels. */
  readonly toPixels: (unit: number) => number;
  /**
   * The unit under a pointer, from its `clientX`, within `0…extent`. It
   * follows the reading direction. With `snap`, it snaps to the timeline's
   * targets when `snapping` is on.
   */
  readonly unitAt: (clientX: number, options?: { readonly snap?: boolean }) => number;
  /** A unit snapped to the nearest target within reach, or itself. */
  readonly snap: (unit: number) => number;
  /** The units in view now. Read it when you draw; it isn't state. */
  readonly visibleRange: () => TimelineRange;
}

/** What a lane's clip track lets the other lanes do, for ↑ and ↓ between them. */
export interface LaneClips {
  /** Whether the track has clips. */
  readonly any: () => boolean;
  /** Focuses a clip of this track, if it has it. */
  readonly focus: (key: string) => boolean;
  /** Focuses the clip nearest a unit, selecting it unless told not to. */
  readonly focusNearest: (unit: number, select: boolean) => void;
}

export interface TimelineContextValue {
  readonly scale: TimelineScale;
  readonly viewport: RefObject<HTMLDivElement | null>;
  readonly track: RefObject<HTMLDivElement | null>;
  /** Adds snap targets that change over time, such as the playhead. */
  readonly addTargets: (read: () => readonly number[]) => () => void;
  /** The lanes' ids, in the order shown; empty in a timeline without lanes. */
  readonly lanes: readonly string[];
  /**
   * The width of the column the lanes' headers share, in CSS pixels: 0 with
   * no headers, and when the headers sit above their lanes.
   */
  readonly headerWidth: number;
  /** The viewport's padding after the track, which the headers' column adds to. */
  readonly trail: number;
  /** A lane says it's there, with its element and its header's toolbar; `null` when it goes. */
  readonly setLane: (
    id: string,
    lane: { readonly element: HTMLElement; readonly toolbar: HTMLElement | null } | null,
  ) => void;
  /** A lane's clip track says it's there, for the other lanes to reach. */
  readonly setLaneClips: (id: string, clips: LaneClips | null) => void;
  /** The clip track of the next lane with clips, above (-1) or below (1) a lane. */
  readonly nextLaneClips: (id: string, direction: -1 | 1) => LaneClips | undefined;
  /** Focuses a clip on whichever other lane has it now: where a moved clip went. */
  readonly focusOnAnotherLane: (from: string, key: string) => boolean;
  /** A unit snapped to the timeline's targets, leaving some out: a moving clip's own edges. */
  readonly snapExcept: (unit: number, except: readonly number[]) => number;
}

/** The lane a part is in, or `undefined` in a timeline without lanes. */
export const TimelineLaneContext = /* @__PURE__ */ createContext<string | undefined>(undefined);

export const TimelineContext = /* @__PURE__ */ createContext<TimelineContextValue | undefined>(
  undefined,
);

/**
 * Below this width of the timeline itself, in CSS pixels, the lanes' headers
 * sit above their lanes rather than beside them (docs/adr/0011).
 */
const HEADERS_BESIDE = 720;

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
  extent: 0,
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
   * How far to draw the track, in units, when clips run past `length`, such
   * as audio that outlasts its video. The playhead still ends at `length`,
   * and a clip that passes it is marked `data-hm-past-end`. Defaults to
   * `length`, and is never less.
   */
  readonly extent?: number | undefined;
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
    extent: rawExtent,
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
  // What's drawn: the length, or further when clips run past it.
  const extent =
    rawExtent !== undefined && Number.isSafeInteger(rawExtent)
      ? Math.max(rawExtent, length)
      : length;
  const viewport = useRef<HTMLDivElement | null>(null);
  const track = useRef<HTMLDivElement | null>(null);
  // The width the track has to fit into; 0 until it's measured.
  const [room, setRoom] = useState(0);
  // The viewport's padding before the track, which scrolls with it.
  const lead = useRef(0);
  const targets = useRef(new Set<() => readonly number[]>());
  // The lanes: what each registered, and what's known of them as state.
  const laneParts = useRef(
    new Map<string, { readonly element: HTMLElement; readonly toolbar: HTMLElement | null }>(),
  );
  const laneClips = useRef(new Map<string, LaneClips>());
  const [lanes, setLanes] = useState<readonly string[]>([]);
  const [headerWidth, setHeaderWidth] = useState(0);
  const [trail, setTrail] = useState(0);
  const [beside, setBeside] = useState(true);

  // Measured and sized when React commits, through ref callbacks, so the
  // first frame painted is already sized. A ref callback runs only in a
  // browser, so nothing here reads the browser on a server, and there's no
  // layout effect for React 18 to warn about there.
  const measure = (element: HTMLDivElement): void => {
    // Also once after the last lane has gone, to undo what the lanes set.
    if (laneParts.current.size > 0 || order.current.length > 0) {
      measureLanes(element);
    }
    const style = getComputedStyle(element);
    const padding = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight);
    lead.current = Number.parseFloat(style.paddingInlineStart) || 0;
    // The same width again changes nothing, so this settles in one more render.
    setRoom(Math.max(0, element.clientWidth - padding));
  };

  // With lanes: their order, the width their headers need, and whether there's
  // room for the headers beside the lanes. The headers' column is the
  // viewport's own padding before the track, so the track still starts at
  // the first unit and everything that maps units to pixels is unchanged.
  const measureLanes = (element: HTMLDivElement): void => {
    const order = [...laneParts.current.entries()].sort(([, a], [, b]) =>
      a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    );
    const ids = order.map(([id]) => id);
    setLanes((current) =>
      current.length === ids.length && current.every((id, index) => id === ids[index])
        ? current
        : ids,
    );
    const wide = element.offsetWidth >= HEADERS_BESIDE;
    setBeside(wide);
    // Each toolbar is as wide as its content; the column is as wide as the widest.
    const widest = Math.max(0, ...order.map(([, lane]) => lane.toolbar?.offsetWidth ?? 0));
    const column = wide ? Math.ceil(widest) : 0;
    setHeaderWidth(column);
    const after = Number.parseFloat(getComputedStyle(element).paddingInlineEnd) || 0;
    setTrail(after);
    setStyle(element, "padding-inline-start", column > 0 ? `${column + after}px` : "");
  };
  const remeasure = useRef(measure);
  remeasure.current = measure;
  // Watches the viewport, and each lane's header, whose content sets its width.
  const resized = useRef<ResizeObserver | null>(null);
  useEffect(() => {
    const element = viewport.current;
    if (!element) {
      return;
    }
    // On the next frame: measuring sets sizes, and a size set while the
    // observer is reporting would be reported to it again at once.
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => remeasure.current(element));
    });
    observer.observe(element);
    resized.current = observer;
    // Headers that registered before this ran.
    for (const lane of laneParts.current.values()) {
      if (lane.toolbar) {
        observer.observe(lane.toolbar);
      }
    }
    return () => {
      resized.current = null;
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  const fit = extent > 0 && room > 0 ? room / extent : 0;
  // Never closer than one unit to maxPixelsPerUnit, nor a track too wide to
  // lay out, and never further than fitting.
  const closest = Math.max(fit, Math.min(maxPixelsPerUnit, MAX_TRACK_PIXELS / Math.max(extent, 1)));
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
    setStyle(element, "inline-size", pixelsPerUnit > 0 ? `${extent * pixelsPerUnit}px` : "");
  };

  const headerColumn = useRef(headerWidth);
  headerColumn.current = headerWidth;

  const settings = useRef({ snapping, snapTargets });
  settings.current = { snapping, snapTargets };
  const snapExceptRef = useRef<(unit: number, except: readonly number[]) => number>((unit) => unit);

  const scale = useMemo<TimelineScale>(() => {
    const snap = (unit: number, except: readonly number[] = []): number => {
      if (!settings.current.snapping || pixelsPerUnit <= 0) {
        return unit;
      }
      const all = [...(settings.current.snapTargets ?? [])];
      for (const read of targets.current) {
        all.push(...read());
      }
      const valid = all.filter(
        (target) => Number.isSafeInteger(target) && target >= 0 && !except.includes(target),
      );
      return snapTo(unit, valid, Math.round(SNAP_PIXELS / pixelsPerUnit));
    };
    snapExceptRef.current = snap;
    return {
      length,
      extent,
      pixelsPerUnit,
      toPixels: (unit) => unit * pixelsPerUnit,
      unitAt: (clientX, options) => {
        const element = track.current;
        if (!element || pixelsPerUnit <= 0) {
          return 0;
        }
        const box = element.getBoundingClientRect();
        const offset = isRtl(element) ? box.right - clientX : clientX - box.left;
        const unit = Math.min(Math.max(Math.round(offset / pixelsPerUnit), 0), extent);
        return options?.snap ? Math.min(snap(unit), extent) : unit;
      },
      snap: (unit) => snap(unit),
      visibleRange: () => {
        const element = viewport.current;
        if (!element || pixelsPerUnit <= 0) {
          return { start: 0, end: extent };
        }
        // scrollLeft is negative in right-to-left text. The track starts
        // after the viewport's padding.
        const scrolled = Math.abs(element.scrollLeft) - lead.current;
        // The headers' column covers the start of the view.
        const start = (scrolled + headerColumn.current) / pixelsPerUnit;
        const end = (scrolled + element.clientWidth) / pixelsPerUnit;
        return {
          start: Math.min(Math.max(Math.floor(start), 0), extent),
          end: Math.min(Math.max(Math.ceil(end), 0), extent),
        };
      },
    };
  }, [length, extent, pixelsPerUnit]);

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

  const setLane = useCallback<TimelineContextValue["setLane"]>((id, lane) => {
    const before = laneParts.current.get(id);
    if (lane) {
      if (before?.element === lane.element && before.toolbar === lane.toolbar) {
        return;
      }
      laneParts.current.set(id, lane);
      if (lane.toolbar) {
        resized.current?.observe(lane.toolbar);
      }
    } else if (before) {
      laneParts.current.delete(id);
      if (before.toolbar) {
        resized.current?.unobserve(before.toolbar);
      }
    }
    // The lanes changed without the timeline rendering: measure them now.
    if (viewport.current) {
      remeasure.current(viewport.current);
    }
  }, []);

  const setLaneClips = useCallback<TimelineContextValue["setLaneClips"]>((id, clips) => {
    if (clips) {
      laneClips.current.set(id, clips);
    } else {
      laneClips.current.delete(id);
    }
  }, []);

  const order = useRef(lanes);
  order.current = lanes;
  const nextLaneClips = useCallback<TimelineContextValue["nextLaneClips"]>((id, direction) => {
    const ids = order.current;
    for (let at = ids.indexOf(id) + direction; at >= 0 && at < ids.length; at += direction) {
      const clips = laneClips.current.get(ids[at] as string);
      if (clips?.any()) {
        return clips;
      }
    }
    return undefined;
  }, []);

  const focusOnAnotherLane = useCallback<TimelineContextValue["focusOnAnotherLane"]>(
    (from, key) => {
      for (const [id, clips] of laneClips.current) {
        if (id !== from && clips.focus(key)) {
          return true;
        }
      }
      return false;
    },
    [],
  );
  const snapExcept = useCallback<TimelineContextValue["snapExcept"]>(
    (unit, except) => snapExceptRef.current(unit, except),
    [],
  );

  const context = useMemo<TimelineContextValue>(
    () => ({
      scale,
      viewport,
      track,
      addTargets,
      lanes,
      headerWidth,
      trail,
      setLane,
      setLaneClips,
      nextLaneClips,
      focusOnAnotherLane,
      snapExcept,
    }),
    [
      scale,
      addTargets,
      lanes,
      headerWidth,
      trail,
      setLane,
      setLaneClips,
      nextLaneClips,
      focusOnAnotherLane,
      snapExcept,
    ],
  );

  const laned = lanes.length > 0;

  return (
    <section
      {...props}
      ref={ref}
      aria-label={label}
      className={cx("hm-timeline", classNames?.root, className)}
      data-hm-unstyled={unstyledAttribute(unstyled)}
      // With lanes, the layout has rows; their headers sit beside or above them.
      data-hm-lanes={laned ? (beside ? "beside" : "above") : undefined}
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
          {/* Behind the slider, so the lanes scroll under its row. */}
          {laned ? (
            <div
              className="hm-timeline-bar"
              aria-hidden="true"
              ref={(node) => {
                if (node) {
                  setStyle(
                    node,
                    "margin-inline-start",
                    headerWidth > 0 ? `${-(headerWidth + trail)}px` : "",
                  );
                }
              }}
            />
          ) : null}
          {/* Over the slider's row where the headers' column is, so its rail passes under. */}
          {laned && headerWidth > 0 ? (
            <div
              className="hm-timeline-corner"
              aria-hidden="true"
              ref={(node) => {
                if (node) {
                  setStyle(node, "margin-inline-start", `${-(headerWidth + trail)}px`);
                  const cover = node.firstElementChild as HTMLElement;
                  setStyle(cover, "inline-size", `${headerWidth}px`);
                  // Measured from inside the viewport's padding, as a lane's header is.
                  setStyle(cover, "inset-inline-start", `${-(headerWidth + trail)}px`);
                }
              }}
            >
              <div className="hm-timeline-corner-cover" />
            </div>
          ) : null}
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
  /**
   * Whether a layer inside a lane takes the pointer. Inside a lane, a layer
   * lets presses through by default, so they reach a layer written under the
   * lanes; set it for a lane's own layer that handles presses itself. A
   * layer outside the lanes always takes the pointer.
   */
  readonly interactive?: boolean | undefined;
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
  function TimelineLayer({ className, interactive, children, ...props }, ref) {
    // Written outside the lanes of a timeline that has them, it covers them all.
    const lanes = useContext(TimelineContext)?.lanes.length ?? 0;
    const inLane = useContext(TimelineLaneContext) !== undefined;
    const rows = inLane ? 0 : lanes;
    return (
      <div
        {...props}
        ref={(node) => {
          if (node) {
            setStyle(node, "grid-row", rows > 0 ? `2 / span ${rows}` : "");
          }
          if (typeof ref === "function") {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        className={cx("hm-timeline-layer", className)}
        data-hm-interactive={interactive ? "" : undefined}
      >
        {children}
      </div>
    );
  },
);

/**
 * The lanes of the {@link Timeline} around a layer, for one that covers them
 * all, such as a selected range of time: their ids in the order shown, and
 * the lane under a pointer.
 *
 * @public
 */
export interface TimelineLanes {
  /** The lanes' ids, top to bottom. Empty in a timeline without lanes. */
  readonly lanes: readonly string[];
  /** The id of the lane under a pointer, from its `clientY`, if one is. */
  readonly laneAt: (clientY: number) => string | undefined;
}

/**
 * The lanes of the {@link Timeline} around a layer or a part.
 *
 * @public
 */
export function useTimelineLanes(): TimelineLanes {
  const context = useTimelineContext("useTimelineLanes");
  const lanes = context?.lanes;
  const track = context?.track;
  return useMemo(
    () => ({
      lanes: lanes ?? [],
      laneAt: (clientY) => {
        for (const element of track?.current?.querySelectorAll<HTMLElement>(
          ":scope > [data-hm-lane]",
        ) ?? []) {
          const box = element.getBoundingClientRect();
          if (clientY >= box.top && clientY < box.bottom) {
            return element.dataset["hmLane"];
          }
        }
        return undefined;
      },
    }),
    [lanes, track],
  );
}
