import { forwardRef, useEffect, useRef } from "react";
import { cx, type StyleProps, unstyledAttribute } from "../shared/style-props.js";
import { Slider } from "../slider/Slider.js";
import { useTimelineContext } from "./Timeline.js";

/**
 * The parts of a timeline's playhead that `classNames` can target.
 *
 * @public
 */
export type TimelinePlayheadPart = "root" | "slider" | "line";

/**
 * Props of {@link TimelinePlayhead}.
 *
 * @public
 */
export interface TimelinePlayheadProps extends StyleProps<TimelinePlayheadPart> {
  /** The slider's accessible name, such as "Playhead". Required. */
  readonly label: string;
  /** Where the playhead is, in the timeline's units. */
  readonly position: number;
  /** Called with the unit the user moved the playhead to. */
  readonly onPositionChange: (position: number) => void;
  /** The arrow keys' step, in units. Defaults to 1. */
  readonly step?: number | undefined;
  /** The Page Up and Page Down step, in units, such as one second. */
  readonly largeStep?: number | undefined;
  /**
   * Writes a position as text for screen readers, such as "0:12.40",
   * exposed as `aria-valuetext`. Without it, they read the number of units.
   */
  readonly formatValue?: ((position: number) => string) | undefined;
  /**
   * Whether a press on the track, outside the clips and controls, moves the
   * playhead there. Defaults to `true`. Turn it off when a layer of yours
   * handles presses itself, such as one that selects a range by dragging.
   */
  readonly seekOnPress?: boolean | undefined;
  /**
   * Keeps the playhead in view by scrolling, as while playing. Without it,
   * the timeline scrolls only after a zoom.
   */
  readonly following?: boolean | undefined;
}

/** What a press on the track mustn't take: the parts that have their own. */
const OWN_PRESS = 'input, button, a[href], select, textarea, [role="option"], [tabindex]';

/**
 * The playhead of a {@link Timeline}: a slider over the timeline's units,
 * and a line on the track at its position.
 *
 * - **The slider** is a `ui` `Slider` as wide as the track, so its thumb is
 *   the playhead's handle. Arrow keys move by `step`, Page Up and Page Down
 *   by `largeStep`, and Home and End go to the start and the end.
 * - **A press on the track** moves the playhead there, snapping to the
 *   timeline's targets unless Alt is held.
 * - **It's the only part that renders as the playhead moves.** Give it the
 *   position from a component of its own, and nothing else in the timeline
 *   re-renders while playing.
 *
 * @public
 */
export const TimelinePlayhead = /* @__PURE__ */ forwardRef<HTMLInputElement, TimelinePlayheadProps>(
  function TimelinePlayhead(
    {
      label,
      position: rawPosition,
      onPositionChange,
      step = 1,
      largeStep,
      formatValue,
      seekOnPress = true,
      following = false,
      className,
      classNames,
      unstyled,
    },
    ref,
  ) {
    const context = useTimelineContext("TimelinePlayhead");
    const scale = context?.scale;
    const length = scale?.length ?? 0;
    const pixelsPerUnit = scale?.pixelsPerUnit ?? 0;
    const position = Math.min(Math.max(Math.round(rawPosition) || 0, 0), length);

    const latest = useRef({ position, onPositionChange });
    latest.current = { position, onPositionChange };

    // The playhead is a snap target for everything else on the timeline.
    const addTargets = context?.addTargets;
    useEffect(() => addTargets?.(() => [latest.current.position]), [addTargets]);

    // The line's place goes through the CSSOM, as the track's size does,
    // from a ref callback, so it's there in the frame React commits.
    const placeLine = (element: HTMLDivElement): void => {
      element.style.insetInlineStart = `${position * pixelsPerUnit}px`;
    };

    // Scrolling: to keep the playhead in view while following; to bring it
    // back after a zoom, which moves everything under the viewport; and to
    // start with it in view, once the timeline has measured itself.
    const viewport = context?.viewport;
    const lastScale = useRef(0);
    useEffect(() => {
      const element = viewport?.current;
      const first = lastScale.current === 0 && pixelsPerUnit > 0;
      const zoomed = lastScale.current !== pixelsPerUnit && lastScale.current > 0;
      lastScale.current = pixelsPerUnit;
      if (!element || pixelsPerUnit <= 0 || !(following || zoomed || first)) {
        return;
      }
      const at = position * pixelsPerUnit;
      const start = Math.abs(element.scrollLeft);
      const width = element.clientWidth;
      if (zoomed || at < start || at > start + width) {
        // In the middle after a zoom and at the start; a tenth in while
        // following, so there's more ahead of the playhead than behind it.
        const to = Math.max(0, at - (zoomed || first ? width / 2 : width / 10));
        element.scrollLeft = getComputedStyle(element).direction === "rtl" ? -to : to;
      }
    }, [viewport, position, pixelsPerUnit, following]);

    const track = context?.track;
    useEffect(() => {
      const element = track?.current;
      if (!element || !seekOnPress || !scale) {
        return;
      }
      const onPointerDown = (event: PointerEvent): void => {
        if (
          event.button !== 0 ||
          event.defaultPrevented ||
          (event.target as Element).closest(OWN_PRESS)
        ) {
          return;
        }
        const next = scale.unitAt(event.clientX, { snap: !event.altKey });
        if (next !== latest.current.position) {
          latest.current.onPositionChange(next);
        }
      };
      element.addEventListener("pointerdown", onPointerDown);
      return () => element.removeEventListener("pointerdown", onPointerDown);
    }, [track, scale, seekOnPress]);

    return (
      <div
        className={cx("hm-timeline-playhead", classNames?.root, className)}
        data-hm-unstyled={unstyledAttribute(unstyled)}
      >
        <Slider
          ref={ref}
          label={label}
          min={0}
          max={length}
          step={step}
          largeStep={largeStep}
          value={position}
          onValueChange={onPositionChange}
          formatValue={formatValue}
          unstyled={unstyled}
          className={cx("hm-timeline-playhead-slider", classNames?.slider)}
        />
        <div
          ref={(node) => {
            if (node) {
              placeLine(node);
            }
          }}
          className={cx("hm-timeline-playhead-line", classNames?.line)}
          aria-hidden="true"
        />
      </div>
    );
  },
);
