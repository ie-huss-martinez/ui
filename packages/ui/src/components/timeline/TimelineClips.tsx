import { sequenceOffsets } from "@hussmartinez/sdk-core";
import {
  type FocusEvent,
  forwardRef,
  type KeyboardEvent,
  type MouseEvent,
  memo,
  type PointerEvent,
  type ReactNode,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { warnInDevelopment } from "../../internal/development.js";
import { cx, type StyleProps, unstyledAttribute } from "../shared/style-props.js";
import { setStyle } from "./set-style.js";
import { type LaneClips, TimelineLaneContext, useTimelineContext } from "./Timeline.js";

declare const process: { readonly env: { readonly NODE_ENV?: string } };

/**
 * A clip on a {@link TimelineClips} track.
 *
 * @public
 */
export interface TimelineClip {
  /** Identifies the clip in `selectedKeys`. Unique on the track. */
  readonly key: string;
  /** The clip's length, in the timeline's units: a whole number, at least 1. */
  readonly length: number;
  /**
   * The unit the clip starts on, for a track with room between its clips.
   * Give it to every clip of the track, in time order and without overlap,
   * or to none: without it, each clip starts where the one before ends.
   */
  readonly at?: number | undefined;
  /**
   * The clip's accessible name, with its place and range, such as
   * "Clip 2 of 5, 0:04.00 to 0:09.20, muted". Use text from your message
   * catalogue. When `content` shows text, start the name with that text, so
   * what's seen is in what's heard (WCAG 2.5.3).
   */
  readonly label: string;
  /** What the clip shows, such as its name or a thumbnail. It's cut off where the clip ends. */
  readonly content?: ReactNode;
  /** `data-*` attributes for the clip, for your own states, such as `data-muted`. */
  readonly attributes?: Readonly<Record<`data-${string}`, string | undefined>> | undefined;
}

/**
 * The parts of a clip track that `classNames` can target.
 *
 * @public
 */
export type TimelineClipsPart = "root" | "clip" | "content";

/**
 * What a {@link TimelineClips} ref gives.
 *
 * @public
 */
export interface TimelineClipsHandle {
  /** Moves focus to a clip, and scrolls it into view. Returns whether it's on the track. */
  focusClip(key: string): boolean;
}

/**
 * Props of {@link TimelineClips}.
 *
 * @public
 */
export interface TimelineClipsProps extends StyleProps<TimelineClipsPart> {
  /** The track's accessible name, such as "Clips". Required. */
  readonly label: string;
  /** The clips, in the order they play. */
  readonly clips: readonly TimelineClip[];
  /**
   * `single`, the default, keeps one clip selected: the focused one.
   * `multiple` adds Shift to extend the selection, Ctrl or ⌘ to move
   * without changing it, and Space to add or remove the focused clip.
   */
  readonly selectionMode?: "single" | "multiple" | undefined;
  /** The selected clips' keys. */
  readonly selectedKeys: readonly string[];
  /** Called with the new selection, in the clips' order. */
  readonly onSelectedKeysChange: (keys: readonly string[]) => void;
  /**
   * Called when the user moves clips with Alt+← or Alt+→ (Option on macOS),
   * with the keys to move, in order, and `-1` for earlier or `1` for later.
   * They're the selected clips when the focused one is selected, and the
   * focused clip otherwise. Render the clips in the new order, or leave them
   * when the move isn't allowed. The keys are taken at the first and last
   * clips too, and without `onMove`, so the browser never goes back instead.
   */
  readonly onMove?: ((keys: readonly string[], direction: -1 | 1) => void) | undefined;
  /**
   * Called when the user changes a clip's length at one edge, by dragging
   * the edge or with Alt+`[` and Alt+`]`, with the change in units:
   * positive makes the clip longer at that edge, negative shorter. A drag
   * calls it once, when it ends. With it, each clip has edges to drag.
   */
  readonly onTrim?: ((key: string, edge: TimelineClipEdge, delta: number) => void) | undefined;
  /**
   * Called for `[` and `]` on a focused clip: set its start or its end to
   * the playhead. You know where the playhead is.
   */
  readonly onTrimToPlayhead?: ((key: string, edge: TimelineClipEdge) => void) | undefined;
  /** What Alt+`[` and Alt+`]` change an edge by, in units. Defaults to 1. */
  readonly trimStep?: number | undefined;
  /**
   * How far an edge can go, as `onTrim`'s `delta`, such as up to its
   * source's end. A drag stops there. Without it, a clip can shrink to one
   * unit and grow without limit.
   */
  readonly trimLimits?:
    | ((key: string, edge: TimelineClipEdge) => { readonly min?: number; readonly max?: number })
    | undefined;
  /**
   * Called when the user moves clips to the lane above (`-1`) or below
   * (`1`) with Alt+↑ or Alt+↓ (Option on macOS), with the same keys as
   * `onMove`. Render them on that lane, at the same time, or leave them when
   * they can't go there. In a lane, the keys are taken with or without it,
   * so the page never scrolls instead.
   */
  readonly onMoveLane?: ((keys: readonly string[], direction: -1 | 1) => void) | undefined;
  /**
   * Called once, when the user lets go of a clip dragged along time or to
   * another lane, with the keys that moved and where: `by` units, and the
   * `lane` it's over when that's another one. Render the clips there. With
   * it, a clip can be dragged, with a mouse or a pen; on a touch screen a
   * drag scrolls, and clips move with your buttons.
   */
  readonly onDrop?: ((keys: readonly string[], drop: TimelineClipDrop) => void) | undefined;
  /**
   * Asked as a clip is dragged: whether it may be dropped there. Where it
   * may not, the clip shows it and letting go reports nothing: a place where
   * it would overlap another clip, or a lane that doesn't take it.
   */
  readonly canDrop?: ((keys: readonly string[], drop: TimelineClipDrop) => boolean) | undefined;
  /**
   * What a drag takes hold of: the whole `clip`, the default, or only its
   * `title`, the strip that shows its `content`. With `title`, a press on
   * the rest of the clip passes to the layer under it, for an editor where
   * dragging across a track selects a range of time.
   */
  readonly moveHandle?: "clip" | "title" | undefined;
}

/**
 * Where a dragged clip was dropped.
 *
 * @public
 */
export interface TimelineClipDrop {
  /** How far along time, in units: negative for earlier. */
  readonly by: number;
  /** The `id` of the lane it's over, when that isn't the lane it came from. */
  readonly lane?: string | undefined;
}

/** A clip being dragged by its body, and where it is now. */
interface Move {
  readonly key: string;
  readonly by: number;
  readonly lane: string | undefined;
  /** How far down the page its lane is from the clip's own, in CSS pixels. */
  readonly down: number;
  readonly refused: boolean;
}

/**
 * A clip's edge: its start, or its end.
 *
 * @public
 */
export type TimelineClipEdge = "start" | "end";

/** How far a pointer moves, in CSS pixels, before a press on a clip is a drag. */
const DRAG_AFTER = 4;
/** How close to an end of the view a dragged clip scrolls the timeline, and how fast, in CSS pixels. */
const EDGE = 32;
const SCROLL = 12;

/** An edge being dragged, and how far it has gone, as `onTrim`'s `delta`. */
interface Drag {
  readonly key: string;
  readonly edge: TimelineClipEdge;
  readonly delta: number;
}

interface ClipProps {
  readonly clip: TimelineClip;
  readonly selected: boolean;
  readonly tabStop: boolean;
  readonly clipClass: string | undefined;
  readonly contentClass: string | undefined;
  /** Whether the clip has edges to drag. */
  readonly edges: boolean;
  /** The edge of this clip being dragged, if one is. */
  readonly dragging: TimelineClipEdge | undefined;
  /** Whether the clip runs past the timeline's length. */
  readonly pastEnd: boolean;
  /** Whether the clip is being dragged, and whether it may be dropped where it is. */
  readonly moving: "allowed" | "refused" | undefined;
}

/** One option. Memoised, so a change of selection renders only the clips it changes. */
const Clip = /* @__PURE__ */ memo(function Clip({
  clip,
  selected,
  tabStop,
  clipClass,
  contentClass,
  edges,
  dragging,
  pastEnd,
  moving,
}: ClipProps) {
  return (
    <div
      {...clip.attributes}
      role="option"
      aria-selected={selected}
      aria-label={clip.label}
      tabIndex={tabStop ? 0 : -1}
      data-hm-key={clip.key}
      data-hm-dragging={dragging}
      data-hm-past-end={pastEnd ? "" : undefined}
      data-hm-moving={moving}
      className={clipClass}
    >
      {clip.content == null ? null : <span className={contentClass}>{clip.content}</span>}
      {/* For a pointer only: the keys and the host's buttons are the other ways. */}
      {edges ? (
        <>
          <span className="hm-timeline-clip-edge" data-hm-edge="start" aria-hidden="true" />
          <span className="hm-timeline-clip-edge" data-hm-edge="end" aria-hidden="true" />
        </>
      ) : null}
    </div>
  );
});

/**
 * The clip track of a {@link Timeline}: a horizontal listbox with one Tab
 * stop, each clip as wide as its length at the timeline's zoom
 * (docs/adr/0011).
 *
 * - **← and →** move between clips, and Home and End go to the first and
 *   last. They follow the reading direction. With `selectionMode="single"`,
 *   the selection follows focus however it arrives: arrows, Tab, a click, or
 *   your own `focus()` or `focusClip`. Ctrl or ⌘ with an arrow moves focus
 *   without selecting.
 * - **With `selectionMode="multiple"`,** Shift extends the selection from
 *   the last clip chosen; Ctrl or ⌘ moves focus without changing it; Space
 *   adds or removes the focused clip, and Shift+Space selects up to it;
 *   Ctrl or ⌘+A selects every clip. A click selects, a Shift-click
 *   extends, and a Ctrl- or ⌘-click adds or removes.
 * - **Clips are data.** Give each a `label` that says its place and range,
 *   since a screen reader can't see where it is on the track.
 * - **When the focused clip goes,** focus moves to the clip that took its
 *   place, or the one before, or the playhead, if focus was on the track.
 *
 * The clips' boundaries are snap targets for the rest of the timeline.
 *
 * @example
 * ```tsx
 * <TimelineClips
 *   label={t("timeline.clips")}
 *   selectionMode="multiple"
 *   clips={plan.clips.map((clip, index) => ({
 *     key: clip.key,
 *     length: framesOf(clip),
 *     label: t("timeline.clip", { index: index + 1, count: plan.clips.length, … }),
 *     content: clip.name,
 *   }))}
 *   selectedKeys={selected}
 *   onSelectedKeysChange={setSelected}
 * />
 * ```
 *
 * @public
 */
export const TimelineClips = /* @__PURE__ */ forwardRef<TimelineClipsHandle, TimelineClipsProps>(
  function TimelineClips(
    {
      label,
      clips: given,
      selectionMode = "single",
      selectedKeys,
      onSelectedKeysChange,
      onMove,
      onTrim,
      onTrimToPlayhead,
      trimStep = 1,
      trimLimits,
      onMoveLane,
      onDrop,
      canDrop,
      moveHandle = "clip",
      className,
      classNames,
      unstyled,
    },
    ref,
  ) {
    const context = useTimelineContext("TimelineClips");
    const pixelsPerUnit = context?.scale.pixelsPerUnit ?? 0;
    // Without a timeline around it, nothing is past the end.
    const timelineLength = context?.scale.length ?? Number.POSITIVE_INFINITY;
    const multiple = selectionMode === "multiple";

    // A clip has a whole, positive length (sdk-core ADR 0042); others are left out.
    const clips = useMemo(() => {
      const valid = given.filter((clip) => Number.isSafeInteger(clip.length) && clip.length > 0);
      if (valid.length !== given.length) {
        if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
          warnInDevelopment(
            "TimelineClips left out a clip whose length isn't a whole number of at least 1.",
          );
        }
      }
      return valid;
    }, [given]);
    // Where each clip starts. Back to back, each starts where the one before
    // ends (sdk-core's offsets); positioned, where its `at` says.
    const starts = useMemo(() => {
      const placed = clips.filter((clip) => clip.at !== undefined).length;
      if (placed === 0) {
        return sequenceOffsets(clips.map((clip) => clip.length)).slice(0, clips.length);
      }
      let end = 0;
      let mistake: string | undefined;
      if (placed !== clips.length) {
        mistake = "gives some clips `at` and not others: give it to every clip, or to none";
      }
      const result = clips.map((clip) => {
        const valid = clip.at !== undefined && Number.isSafeInteger(clip.at) && clip.at >= 0;
        const start = valid ? (clip.at as number) : end;
        if (clip.at !== undefined && !valid) {
          mistake ??= "has a clip whose `at` isn't a whole number of at least 0";
        } else if (start < end) {
          mistake ??= "has clips that overlap or aren't in time order";
        }
        end = Math.max(end, start + clip.length);
        return start;
      });
      if (mistake) {
        if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
          warnInDevelopment(`TimelineClips ${mistake}.`);
        }
      }
      return result;
    }, [clips]);
    const positioned = clips.some((clip) => clip.at !== undefined);

    const list = useRef<HTMLDivElement | null>(null);
    const [focusKey, setFocusKey] = useState<string | null>(null);
    // The clip a Shift selection extends from.
    const anchor = useRef<string | null>(null);
    // Whether focus was last seen on the track, and where.
    const held = useRef<{ readonly key: string; readonly index: number } | null>(null);
    // Whether the last key asked the host to move clips.
    const moved = useRef(false);

    const selected = useMemo(() => new Set(selectedKeys), [selectedKeys]);
    const tabStop =
      clips.find((clip) => clip.key === focusKey) ??
      clips.find((clip) => selected.has(clip.key)) ??
      clips[0];

    const option = (key: string): HTMLElement | null => {
      for (const element of list.current?.children ?? []) {
        if ((element as HTMLElement).dataset["hmKey"] === key) {
          return element as HTMLElement;
        }
      }
      return null;
    };

    /** Focuses a clip, and scrolls the timeline so it's in view. */
    const focusClip = (key: string): boolean => {
      const element = option(key);
      if (!element) {
        return false;
      }
      setFocusKey(key);
      element.focus({ preventScroll: true });
      const viewport = context?.viewport.current;
      if (viewport) {
        const box = element.getBoundingClientRect();
        const bounds = viewport.getBoundingClientRect();
        // The lanes' headers cover the start of the view.
        const header = context?.headerWidth ?? 0;
        const rtl = getComputedStyle(viewport).direction === "rtl";
        const view = {
          left: bounds.left + (rtl ? 0 : header),
          right: bounds.right - (rtl ? header : 0),
        };
        if (box.left < view.left) {
          viewport.scrollLeft -= view.left - box.left;
        } else if (box.right > view.right) {
          // A clip wider than the view shows its start.
          viewport.scrollLeft += Math.min(box.right - view.right, box.left - view.left);
        }
      }
      return true;
    };
    useImperativeHandle(ref, () => ({ focusClip }));

    // In single selection, the selection follows focus however it arrives:
    // Tab, a click, a host's `focus()` or `focusClip`. The track's own moves
    // that mustn't select, such as Ctrl or ⌘ with an arrow, focus quietly.
    // Focusing is synchronous, so the flag only covers that one call.
    const quiet = useRef(false);
    const focusQuietly = (key: string): boolean => {
      quiet.current = true;
      try {
        return focusClip(key);
      } finally {
        quiet.current = false;
      }
    };

    // What the other lanes need of this one, for ↑ and ↓ between them.
    const laneId = useContext(TimelineLaneContext);
    const forLanes = useRef<LaneClips>({
      any: () => false,
      focus: () => false,
      focusNearest: () => undefined,
    });
    forLanes.current = {
      any: () => clips.length > 0,
      // A clip that moved here from another lane keeps its selection as it was.
      focus: (key) => clips.some((clip) => clip.key === key) && focusQuietly(key),
      focusNearest: (unit, andSelect) => {
        let nearest: TimelineClip | undefined;
        let distance = Number.POSITIVE_INFINITY;
        clips.forEach((clip, index) => {
          const start = starts[index] ?? 0;
          const end = start + clip.length;
          const away = unit < start ? start - unit : unit >= end ? unit - end + 1 : 0;
          if (away < distance) {
            nearest = clip;
            distance = away;
          }
        });
        if (nearest && focusQuietly(nearest.key) && andSelect) {
          anchor.current = nearest.key;
          select([nearest.key]);
        }
      },
    };
    const setLaneClips = context?.setLaneClips;
    useEffect(() => {
      if (laneId === undefined || !setLaneClips) {
        return;
      }
      setLaneClips(laneId, {
        any: () => forLanes.current.any(),
        focus: (key) => forLanes.current.focus(key),
        focusNearest: (unit, andSelect) => forLanes.current.focusNearest(unit, andSelect),
      });
      return () => setLaneClips(laneId, null);
    }, [laneId, setLaneClips]);

    // The clips' boundaries are snap targets for the timeline's other parts.
    const addTargets = context?.addTargets;
    // Every clip's start and end, on this lane: another lane's clip snaps to them.
    const edges = useMemo(
      () => [
        ...new Set(
          clips.flatMap((clip, index) => [starts[index] ?? 0, (starts[index] ?? 0) + clip.length]),
        ),
      ],
      [clips, starts],
    );
    const boundaries = useRef(edges);
    boundaries.current = edges;
    useEffect(() => addTargets?.(() => boundaries.current), [addTargets]);

    // Widths go through the CSSOM, as the track's does, from a ref callback,
    // so they're there in the frame React commits. Only when the clips or the
    // scale changed: a change of selection sizes nothing.
    const [drag, setDrag] = useState<Drag | null>(null);
    const [move, setMove] = useState<Move | null>(null);
    const sized = useRef<{
      clips: readonly TimelineClip[];
      scale: number;
      drag: Drag | null;
      move: Move | null;
    } | null>(null);
    const sizeClips = (element: HTMLDivElement): void => {
      if (
        sized.current?.clips === clips &&
        sized.current.scale === pixelsPerUnit &&
        sized.current.drag === drag &&
        sized.current.move === move
      ) {
        return;
      }
      sized.current = { clips, scale: pixelsPerUnit, drag, move };
      const rtl = move ? getComputedStyle(element).direction === "rtl" : false;
      const elements = element.children;
      // Where the clip before ended, as drawn: a clip's margin is the room
      // between that and its own start, which is nothing back to back.
      let end = 0;
      for (let index = 0; index < elements.length; index++) {
        const clip = clips[index];
        const node = elements[index] as HTMLElement;
        let start = starts[index] ?? end;
        let length = clip?.length ?? 0;
        // A dragged edge shows its clip as it would be: longer or shorter,
        // and on a positioned track with its other edge held still.
        if (clip && drag?.key === clip.key) {
          length += drag.delta;
          if (drag.edge === "start" && positioned) {
            start -= drag.delta;
          }
        }
        if (!positioned) {
          start = end;
        }
        const measured = pixelsPerUnit > 0;
        setStyle(node, "inline-size", measured ? `${length * pixelsPerUnit}px` : "");
        setStyle(
          node,
          "margin-inline-start",
          measured && start !== end ? `${(start - end) * pixelsPerUnit}px` : "",
        );
        // A clip dragged by its body follows the pointer, along time and down
        // or up to the lane it's over, without leaving its place in the track.
        setStyle(
          node,
          "translate",
          clip && move?.key === clip.key
            ? `${move.by * pixelsPerUnit * (rtl ? -1 : 1)}px ${move.down}px`
            : "",
        );
        end = start + length;
      }
    };

    // When the clip that held focus is gone, and focus with it, focus goes
    // to the clip that took its place, or the one before, or the playhead.
    // Never from elsewhere: only when nothing has focus.
    useEffect(() => {
      const was = held.current;
      if (!was) {
        return;
      }
      if (clips.some((clip) => clip.key === was.key)) {
        // After a move, the browser may have dropped focus from the clip as
        // React put it in its new place: it goes back, if nothing else has it.
        const active = document.activeElement;
        if (moved.current && (!active || active === document.body)) {
          focusQuietly(was.key);
        }
        moved.current = false;
        return;
      }
      moved.current = false;
      held.current = null;
      const active = document.activeElement;
      if (active && active !== document.body) {
        return;
      }
      // Moved to another lane rather than removed: focus goes with it.
      if (laneId !== undefined && context?.focusOnAnotherLane(laneId, was.key)) {
        return;
      }
      const next = clips[Math.min(was.index, clips.length - 1)];
      if (next) {
        focusClip(next.key);
      } else {
        context?.track.current?.querySelector<HTMLElement>(".hm-timeline-playhead-slider")?.focus();
      }
    });

    // An edge being dragged: where it started, and what bounds it.
    const dragging = useRef<{
      readonly pointerId: number;
      readonly x: number;
      readonly key: string;
      readonly edge: TimelineClipEdge;
      readonly boundary: number;
      readonly min: number;
      readonly max: number;
      /** How far the edge has gone; kept here too, for the moment the drag ends. */
      delta: number;
    } | null>(null);

    /** What moves with a clip: the timeline's whole selection when the clip is in it. */
    const movingWith = (key: string): string[] => {
      if (!selected.has(key)) {
        return [key];
      }
      const own = new Set(clips.map((clip) => clip.key));
      return [
        ...clips.filter((clip) => selected.has(clip.key)).map((clip) => clip.key),
        // The selection is the timeline's: other lanes' clips move with it.
        ...selectedKeys.filter((other) => !own.has(other)),
      ];
    };

    // A clip pressed, and then dragged by its body: where it started, and
    // where the pointer has taken it.
    const moving = useRef<{
      readonly pointerId: number;
      readonly element: HTMLElement;
      readonly key: string;
      readonly keys: readonly string[];
      readonly x: number;
      readonly y: number;
      /** The unit under the pointer when it went down. */
      readonly unit: number;
      readonly start: number;
      readonly length: number;
      /** Whether the pointer has gone far enough to be a drag, not a click. */
      started: boolean;
      lastX: number;
      lastY: number;
      alt: boolean;
      by: number;
      lane: string | undefined;
      refused: boolean;
      frame: number;
    } | null>(null);
    // A drag ends with a click on the clip, which mustn't change the selection.
    const dragged = useRef(false);

    /** Where a dragged clip is now, from where the pointer is. */
    const follow = (): void => {
      const at = moving.current;
      const scale = context?.scale;
      if (!at || !scale || !list.current) {
        return;
      }
      let start = Math.max(0, at.start + scale.unitAt(at.lastX) - at.unit);
      if (!at.alt) {
        // Its start or its end snaps, whichever has less far to go, and not
        // to where the clip itself was.
        const own = [at.start, at.start + at.length];
        const byStart = (context?.snapExcept(start, own) ?? start) - start;
        const end = start + at.length;
        const byEnd = (context?.snapExcept(end, own) ?? end) - end;
        const nudge =
          byStart !== 0 && (byEnd === 0 || Math.abs(byStart) <= Math.abs(byEnd)) ? byStart : byEnd;
        start = Math.max(0, start + nudge);
      }
      const by = start - at.start;
      // The lane under the pointer, when the track is in one.
      let lane: string | undefined;
      let down = 0;
      const ownLane = list.current.closest<HTMLElement>("[data-hm-lane]");
      if (ownLane) {
        for (const other of context?.track.current?.querySelectorAll<HTMLElement>(
          ":scope > [data-hm-lane]",
        ) ?? []) {
          const box = other.getBoundingClientRect();
          if (at.lastY >= box.top && at.lastY < box.bottom && other !== ownLane) {
            lane = other.dataset["hmLane"];
            down = box.top - ownLane.getBoundingClientRect().top;
          }
        }
      }
      const refused = canDrop ? !canDrop(at.keys, { by, lane }) : false;
      at.by = by;
      at.lane = lane;
      at.refused = refused;
      setMove((current) =>
        current &&
        current.by === by &&
        current.lane === lane &&
        current.down === down &&
        current.refused === refused
          ? current
          : { key: at.key, by, lane, down, refused },
      );
    };

    /** Scrolls the timeline while a dragged clip is held near either end of the view. */
    const scrollAtEdges = (): void => {
      const at = moving.current;
      const viewport = context?.viewport.current;
      if (!at?.started || !viewport) {
        return;
      }
      const box = viewport.getBoundingClientRect();
      const header = context?.headerWidth ?? 0;
      const rtl = getComputedStyle(viewport).direction === "rtl";
      const left = box.left + (rtl ? 0 : header);
      const right = box.right - (rtl ? header : 0);
      const step = at.lastX < left + EDGE ? -SCROLL : at.lastX > right - EDGE ? SCROLL : 0;
      if (step !== 0) {
        const before = viewport.scrollLeft;
        viewport.scrollLeft += step;
        if (viewport.scrollLeft !== before) {
          follow();
        }
      }
      at.frame = requestAnimationFrame(scrollAtEdges);
    };

    const endMove = (commit: boolean): void => {
      const at = moving.current;
      moving.current = null;
      if (!at) {
        return;
      }
      cancelAnimationFrame(at.frame);
      if (!at.started) {
        return;
      }
      dragged.current = true;
      setMove(null);
      if (commit && !at.refused && (at.by !== 0 || at.lane !== undefined)) {
        // Focus goes with the clip, to another lane too.
        held.current ??= { key: at.key, index: clips.findIndex((clip) => clip.key === at.key) };
        moved.current = true;
        onDrop?.(at.keys, { by: at.by, lane: at.lane });
      }
    };

    const handlePointerDown = (event: PointerEvent<HTMLDivElement>): void => {
      const pressed = (event.target as HTMLElement).closest<HTMLElement>("[data-hm-key]");
      const pressedClip = clips.find((clip) => clip.key === pressed?.dataset["hmKey"]);
      if (
        onDrop &&
        pressed &&
        pressedClip &&
        event.button === 0 &&
        // A finger dragged across the clips scrolls the timeline.
        event.pointerType !== "touch" &&
        pixelsPerUnit > 0 &&
        !(event.target as HTMLElement).closest("[data-hm-edge]") &&
        (moveHandle === "clip" ||
          (event.target as HTMLElement).closest(".hm-timeline-clip-content") !== null)
      ) {
        const index = clips.indexOf(pressedClip);
        moving.current = {
          pointerId: event.pointerId,
          element: pressed,
          key: pressedClip.key,
          keys: movingWith(pressedClip.key),
          x: event.clientX,
          y: event.clientY,
          unit: context?.scale.unitAt(event.clientX) ?? 0,
          start: starts[index] ?? 0,
          length: pressedClip.length,
          started: false,
          lastX: event.clientX,
          lastY: event.clientY,
          alt: event.altKey,
          by: 0,
          lane: undefined,
          refused: false,
          frame: 0,
        };
        return;
      }
      const handle = (event.target as HTMLElement).closest<HTMLElement>("[data-hm-edge]");
      const key = handle?.closest<HTMLElement>("[data-hm-key]")?.dataset["hmKey"];
      const index = clips.findIndex((clip) => clip.key === key);
      const clip = clips[index];
      if (!handle || !clip || !onTrim || event.button !== 0 || pixelsPerUnit <= 0) {
        return;
      }
      const edge: TimelineClipEdge = handle.dataset["hmEdge"] === "start" ? "start" : "end";
      const limits = trimLimits?.(clip.key, edge);
      dragging.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        key: clip.key,
        edge,
        boundary: (starts[index] ?? 0) + (edge === "start" ? 0 : clip.length),
        // Never shorter than one unit.
        min: Math.max(limits?.min ?? Number.NEGATIVE_INFINITY, 1 - clip.length),
        max: limits?.max ?? Number.POSITIVE_INFINITY,
        delta: 0,
      };
      try {
        handle.setPointerCapture(event.pointerId);
      } catch {
        // The pointer is up already; its events still arrive here.
      }
      setDrag({ key: clip.key, edge, delta: 0 });
    };

    const handlePointerMove = (event: PointerEvent<HTMLDivElement>): void => {
      const at = moving.current;
      if (at && event.pointerId === at.pointerId) {
        at.lastX = event.clientX;
        at.lastY = event.clientY;
        at.alt = event.altKey;
        if (!at.started) {
          // A few pixels of movement, so a click with a shaky hand still selects.
          if (Math.hypot(event.clientX - at.x, event.clientY - at.y) < DRAG_AFTER) {
            return;
          }
          at.started = true;
          try {
            at.element.setPointerCapture(event.pointerId);
          } catch {
            // The pointer is up already; its events still arrive here.
          }
          at.frame = requestAnimationFrame(scrollAtEdges);
        }
        follow();
        return;
      }
      const start = dragging.current;
      if (!start || event.pointerId !== start.pointerId || pixelsPerUnit <= 0) {
        return;
      }
      const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
      const along = rtl ? start.x - event.clientX : event.clientX - start.x;
      const to = Math.max(0, start.boundary + Math.round(along / pixelsPerUnit));
      // Alt turns snapping off for this drag.
      const snapped = event.altKey ? to : (context?.scale.snap(to) ?? to);
      // The start's edge makes the clip longer as it moves earlier.
      const change = start.edge === "start" ? start.boundary - snapped : snapped - start.boundary;
      const delta = Math.min(Math.max(change, start.min), start.max);
      start.delta = delta;
      setDrag((current) => (current && current.delta !== delta ? { ...current, delta } : current));
    };

    const endDrag = (commit: boolean): void => {
      const start = dragging.current;
      dragging.current = null;
      setDrag(null);
      if (commit && start && start.delta !== 0) {
        onTrim?.(start.key, start.edge, start.delta);
      }
    };

    // Escape cancels a drag, wherever focus is.
    const isDragging = drag !== null || move !== null;
    useEffect(() => {
      if (!isDragging) {
        return;
      }
      const onKeyDown = (event: globalThis.KeyboardEvent): void => {
        if (event.key === "Escape") {
          event.preventDefault();
          dragging.current = null;
          setDrag(null);
          if (moving.current) {
            cancelAnimationFrame(moving.current.frame);
            // The pointer is still down: what it does until it's let go is
            // nothing, and the click that follows isn't a choice of clip.
            moving.current = null;
            dragged.current = true;
            setMove(null);
          }
        }
      };
      document.addEventListener("keydown", onKeyDown, true);
      return () => document.removeEventListener("keydown", onKeyDown, true);
    }, [isDragging]);

    // `selectedKeys` is the whole timeline's selection, which every lane is
    // given. A plain selection replaces it; adding, removing and extending
    // keep the other lanes' clips. With one lane there are no others.
    const select = (keys: Iterable<string>, keepOthers = false): void => {
      const wanted = new Set(keys);
      const own = new Set(clips.map((clip) => clip.key));
      const next = clips.filter((clip) => wanted.has(clip.key)).map((clip) => clip.key);
      if (keepOthers) {
        next.push(...selectedKeys.filter((key) => !own.has(key)));
      }
      if (next.length !== selectedKeys.length || next.some((key, i) => key !== selectedKeys[i])) {
        onSelectedKeysChange(next);
      }
    };

    /** The keys from the anchor to a clip, in either order. */
    const range = (to: number): string[] => {
      const from = Math.max(
        0,
        clips.findIndex((clip) => clip.key === anchor.current),
      );
      return clips.slice(Math.min(from, to), Math.max(from, to) + 1).map((clip) => clip.key);
    };

    const toggle = (key: string): void => {
      const next = new Set(selected);
      if (!next.delete(key)) {
        next.add(key);
      }
      anchor.current = key;
      select(next, true);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
      if (event.defaultPrevented || event.nativeEvent.isComposing) {
        return;
      }
      const key = (event.target as HTMLElement).dataset["hmKey"];
      const index = clips.findIndex((clip) => clip.key === key);
      const current = clips[index];
      if (!current) {
        return;
      }
      const mod = event.ctrlKey || event.metaKey;
      const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
      const forward = rtl ? "ArrowLeft" : "ArrowRight";
      const backward = rtl ? "ArrowRight" : "ArrowLeft";
      // By position, not character: Alt changes what the brackets type on
      // Apple's layouts, and other layouts put them elsewhere.
      const edge: TimelineClipEdge | undefined =
        event.code === "BracketLeft" ? "start" : event.code === "BracketRight" ? "end" : undefined;

      if (event.altKey) {
        if (mod) {
          return;
        }
        if ((event.key === forward || event.key === backward) && !event.shiftKey) {
          // Always taken in the track, at its ends and without onMove too:
          // unprevented, Alt with an arrow is the browser's Back or Forward.
          event.preventDefault();
          if (onMove) {
            moved.current = true;
            onMove(movingWith(current.key), event.key === forward ? 1 : -1);
          }
        } else if (
          (event.key === "ArrowUp" || event.key === "ArrowDown") &&
          !event.shiftKey &&
          laneId !== undefined
        ) {
          // To the lane above or below. Taken on every clip in a lane, with
          // or without onMoveLane: unprevented, it scrolls the page.
          event.preventDefault();
          if (onMoveLane) {
            moved.current = true;
            onMoveLane(movingWith(current.key), event.key === "ArrowDown" ? 1 : -1);
          }
        } else if (edge && onTrim) {
          // Inward, which shortens the clip; with Shift, outward.
          event.preventDefault();
          onTrim(current.key, edge, event.shiftKey ? trimStep : -trimStep);
        }
        return;
      }
      if (edge && !mod && !event.shiftKey) {
        if (onTrimToPlayhead) {
          event.preventDefault();
          onTrimToPlayhead(current.key, edge);
        }
        return;
      }

      // Between lanes: to the clip nearest in time on the next lane with
      // clips. Taken on every clip of a timeline with several lanes, at the
      // top and bottom too, so the page doesn't scroll instead.
      if ((event.key === "ArrowUp" || event.key === "ArrowDown") && laneId !== undefined) {
        if (event.shiftKey || (context?.lanes.length ?? 0) < 2) {
          return;
        }
        event.preventDefault();
        const middle = (starts[index] ?? 0) + current.length / 2;
        context
          ?.nextLaneClips(laneId, event.key === "ArrowDown" ? 1 : -1)
          ?.focusNearest(middle, !mod);
        return;
      }

      let to: number | undefined;
      if (event.key === forward) {
        to = Math.min(index + 1, clips.length - 1);
      } else if (event.key === backward) {
        to = Math.max(index - 1, 0);
      } else if (event.key === "Home") {
        to = 0;
      } else if (event.key === "End") {
        to = clips.length - 1;
      }
      const target = to === undefined ? undefined : clips[to];
      if (to !== undefined && target) {
        // With Shift and Ctrl or ⌘ together, the key isn't the track's.
        if (event.shiftKey && (mod || !multiple)) {
          return;
        }
        event.preventDefault();
        focusQuietly(target.key);
        if (event.shiftKey) {
          select(range(to), true);
        } else if (!mod) {
          anchor.current = target.key;
          select([target.key]);
        }
        return;
      }

      if (event.key === " " || (event.key === "Enter" && !mod && !event.shiftKey)) {
        event.preventDefault();
        if (!multiple) {
          select([current.key]);
        } else if (event.shiftKey) {
          select(range(index), true);
        } else if (event.key === " ") {
          toggle(current.key);
        } else {
          anchor.current = current.key;
          select([current.key]);
        }
      } else if (multiple && mod && !event.shiftKey && event.key.toLowerCase() === "a") {
        event.preventDefault();
        select(
          clips.map((clip) => clip.key),
          true,
        );
      }
    };

    const handleClick = (event: MouseEvent<HTMLDivElement>): void => {
      const element = (event.target as HTMLElement).closest<HTMLElement>("[data-hm-key]");
      const key = element?.dataset["hmKey"];
      const index = clips.findIndex((clip) => clip.key === key);
      if (key === undefined || index === -1 || event.defaultPrevented) {
        return;
      }
      // The click that ends a drag isn't a choice of clip.
      if (dragged.current) {
        dragged.current = false;
        return;
      }
      setFocusKey(key);
      if (multiple && event.shiftKey) {
        select(range(index), true);
      } else if (multiple && (event.ctrlKey || event.metaKey)) {
        toggle(key);
      } else {
        anchor.current = key;
        select([key]);
      }
    };

    const handleFocus = (event: FocusEvent<HTMLDivElement>): void => {
      const key = (event.target as HTMLElement).dataset["hmKey"];
      const index = clips.findIndex((clip) => clip.key === key);
      if (key !== undefined && index !== -1) {
        held.current = { key, index };
        setFocusKey(key);
        anchor.current ??= key;
        // Only on a real focus, and only when the selection would change, so
        // a controlled host can't loop.
        if (
          !multiple &&
          !quiet.current &&
          !(selectedKeys.length === 1 && selectedKeys[0] === key)
        ) {
          anchor.current = key;
          select([key]);
        }
      }
    };

    const handleBlur = (event: FocusEvent<HTMLDivElement>): void => {
      if (event.relatedTarget) {
        // Focus went somewhere on purpose, inside the track or out of it.
        if (!event.currentTarget.contains(event.relatedTarget)) {
          held.current = null;
        }
        return;
      }
      // With nowhere to go, either the user left the page's controls, or the
      // clip was removed: only then is it gone from the track a moment later.
      const target = event.target;
      queueMicrotask(() => {
        if (target.isConnected) {
          held.current = null;
        }
      });
    };

    const clipClass = cx("hm-timeline-clip", classNames?.clip);
    const contentClass = cx("hm-timeline-clip-content", classNames?.content);

    return (
      <div
        ref={(node) => {
          list.current = node;
          if (node) {
            sizeClips(node);
          }
        }}
        role="listbox"
        aria-label={label}
        aria-orientation="horizontal"
        aria-multiselectable={multiple ? true : undefined}
        className={cx("hm-timeline-clips", classNames?.root, className)}
        data-hm-unstyled={unstyledAttribute(unstyled)}
        // Until the timeline has measured itself, the clips share the track equally.
        data-hm-measured={pixelsPerUnit > 0 ? "" : undefined}
        // What a drag takes hold of, when clips can be dragged.
        data-hm-move-handle={onDrop ? moveHandle : undefined}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={() => {
          endDrag(true);
          endMove(true);
        }}
        onPointerCancel={() => {
          endDrag(false);
          endMove(false);
        }}
        onFocus={handleFocus}
        onBlur={handleBlur}
      >
        {clips.map((clip, index) => (
          <Clip
            key={clip.key}
            clip={clip}
            selected={selected.has(clip.key)}
            tabStop={clip === tabStop}
            clipClass={clipClass}
            contentClass={contentClass}
            edges={onTrim !== undefined}
            dragging={drag?.key === clip.key ? drag.edge : undefined}
            pastEnd={(starts[index] ?? 0) + clip.length > timelineLength}
            moving={move?.key === clip.key ? (move.refused ? "refused" : "allowed") : undefined}
          />
        ))}
      </div>
    );
  },
);
