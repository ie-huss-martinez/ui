import { sequenceOffsets } from "@hussmartinez/sdk-core";
import {
  type FocusEvent,
  forwardRef,
  type KeyboardEvent,
  type MouseEvent,
  memo,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { warnInDevelopment } from "../../internal/development.js";
import { cx, type StyleProps, unstyledAttribute } from "../shared/style-props.js";
import { useTimelineContext } from "./Timeline.js";

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
   * The clip's accessible name, with its place and range, such as
   * "Clip 2 of 5, 0:04.00 to 0:09.20, muted". Use text from your message
   * catalogue.
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
}

/**
 * A clip's edge: its start, or its end.
 *
 * @public
 */
export type TimelineClipEdge = "start" | "end";

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
 *   last. They follow the reading direction. The selection follows focus.
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
      className,
      classNames,
      unstyled,
    },
    ref,
  ) {
    const context = useTimelineContext("TimelineClips");
    const pixelsPerUnit = context?.scale.pixelsPerUnit ?? 0;
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
    const offsets = useMemo(() => sequenceOffsets(clips.map((clip) => clip.length)), [clips]);

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
        const view = viewport.getBoundingClientRect();
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

    // The clips' boundaries are snap targets for the timeline's other parts.
    const addTargets = context?.addTargets;
    const boundaries = useRef(offsets);
    boundaries.current = offsets;
    useEffect(() => addTargets?.(() => boundaries.current), [addTargets]);

    // Widths go through the CSSOM, as the track's does, from a ref callback,
    // so they're there in the frame React commits. Only when the clips or the
    // scale changed: a change of selection sizes nothing.
    const [drag, setDrag] = useState<Drag | null>(null);
    const sized = useRef<{
      clips: readonly TimelineClip[];
      scale: number;
      drag: Drag | null;
    } | null>(null);
    const sizeClips = (element: HTMLDivElement): void => {
      if (
        sized.current?.clips === clips &&
        sized.current.scale === pixelsPerUnit &&
        sized.current.drag === drag
      ) {
        return;
      }
      sized.current = { clips, scale: pixelsPerUnit, drag };
      const elements = element.children;
      for (let index = 0; index < elements.length; index++) {
        const clip = clips[index];
        // A dragged edge shows its clip at the length it would have.
        const length = (clip?.length ?? 0) + (clip && drag?.key === clip.key ? drag.delta : 0);
        (elements[index] as HTMLElement).style.inlineSize =
          pixelsPerUnit > 0 ? `${length * pixelsPerUnit}px` : "";
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
          focusClip(was.key);
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

    const handlePointerDown = (event: PointerEvent<HTMLDivElement>): void => {
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
        boundary: offsets[edge === "start" ? index : index + 1] ?? 0,
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
    const isDragging = drag !== null;
    useEffect(() => {
      if (!isDragging) {
        return;
      }
      const onKeyDown = (event: globalThis.KeyboardEvent): void => {
        if (event.key === "Escape") {
          event.preventDefault();
          dragging.current = null;
          setDrag(null);
        }
      };
      document.addEventListener("keydown", onKeyDown, true);
      return () => document.removeEventListener("keydown", onKeyDown, true);
    }, [isDragging]);

    const select = (keys: Iterable<string>): void => {
      const wanted = new Set(keys);
      const next = clips.filter((clip) => wanted.has(clip.key)).map((clip) => clip.key);
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
      select(next);
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
            onMove(
              selected.has(current.key)
                ? clips.filter((clip) => selected.has(clip.key)).map((clip) => clip.key)
                : [current.key],
              event.key === forward ? 1 : -1,
            );
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
        focusClip(target.key);
        if (event.shiftKey) {
          select(range(to));
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
          select(range(index));
        } else if (event.key === " ") {
          toggle(current.key);
        } else {
          anchor.current = current.key;
          select([current.key]);
        }
      } else if (multiple && mod && !event.shiftKey && event.key.toLowerCase() === "a") {
        event.preventDefault();
        select(clips.map((clip) => clip.key));
      }
    };

    const handleClick = (event: MouseEvent<HTMLDivElement>): void => {
      const element = (event.target as HTMLElement).closest<HTMLElement>("[data-hm-key]");
      const key = element?.dataset["hmKey"];
      const index = clips.findIndex((clip) => clip.key === key);
      if (key === undefined || index === -1 || event.defaultPrevented) {
        return;
      }
      setFocusKey(key);
      if (multiple && event.shiftKey) {
        select(range(index));
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
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={() => endDrag(true)}
        onPointerCancel={() => endDrag(false)}
        onFocus={handleFocus}
        onBlur={handleBlur}
      >
        {clips.map((clip) => (
          <Clip
            key={clip.key}
            clip={clip}
            selected={selected.has(clip.key)}
            tabStop={clip === tabStop}
            clipClass={clipClass}
            contentClass={contentClass}
            edges={onTrim !== undefined}
            dragging={drag?.key === clip.key ? drag.edge : undefined}
          />
        ))}
      </div>
    );
  },
);
