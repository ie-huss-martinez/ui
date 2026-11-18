import {
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
} from "react";
import { cx, type StyleProps, unstyledAttribute } from "../shared/style-props.js";
import { Toolbar } from "../toolbar/Toolbar.js";
import { setStyle } from "./set-style.js";
import { TimelineLaneContext, useTimelineContext } from "./Timeline.js";

/**
 * The parts of a timeline's lane that `classNames` can target.
 *
 * @public
 */
export type TimelineLanePart = "root" | "header";

/**
 * Props of {@link TimelineLane}.
 *
 * @public
 */
export interface TimelineLaneProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "className" | "role" | "id">,
    StyleProps<TimelineLanePart> {
  /** Identifies the lane: in `useTimelineLanes`, and when a clip moves between lanes. Unique in the timeline. */
  readonly id: string;
  /**
   * The lane's accessible name, with what a user needs to tell it from the
   * others, such as "Track 2, Music, muted". It names the lane's header too.
   */
  readonly label: string;
  /**
   * The lane's controls, such as its name, Mute and Solo toggles and a gain
   * slider, last. The lane renders them in a toolbar that stays in view
   * while the timeline scrolls: one Tab stop, with ← and → between them.
   */
  readonly header?: ReactNode;
  /** The lane's own layers and its clip track, stacked in the order written. */
  readonly children?: ReactNode;
}

/**
 * A lane of a {@link Timeline}: a track of an editor, with its own layers
 * and clip track, and a header that stays in view (docs/adr/0011). Lanes
 * stack downward in the order written, under one playhead.
 *
 * - **It's a group,** named by `label`, holding its header and its clips.
 * - **The header is a toolbar:** one Tab stop a lane, before its clips. The
 *   headers share a column as wide as the widest. Where the timeline is
 *   narrower than 720 pixels, each sits above its lane instead.
 * - **↑ and ↓ on a clip** go to the clip nearest in time on the next lane
 *   that has clips, so nobody tabs through every lane.
 * - **You own the lanes' order:** move one by rendering it elsewhere.
 *
 * A timeline without lanes is one lane with no header, and needs none.
 *
 * @example
 * ```tsx
 * <Timeline label={t("timeline.label")} length={frames}>
 *   <TimelinePlayhead … />
 *   {tracks.map((track) => (
 *     <TimelineLane
 *       key={track.key}
 *       id={track.key}
 *       label={t("track.label", track)}
 *       header={<TrackControls track={track} />}
 *     >
 *       <TimelineLayer><Waveform track={track} /></TimelineLayer>
 *       <TimelineClips label={t("track.clips", track)} clips={…} … />
 *     </TimelineLane>
 *   ))}
 * </Timeline>
 * ```
 *
 * @public
 */
export const TimelineLane = /* @__PURE__ */ forwardRef<HTMLDivElement, TimelineLaneProps>(
  function TimelineLane(
    { id, label, header, className, classNames, unstyled, children, ...props },
    ref,
  ) {
    const context = useTimelineContext("TimelineLane");
    // A lane inside a lane would be a mistake; the outer one's id is ignored.
    useContext(TimelineLaneContext);
    const toolbar = useRef<HTMLDivElement | null>(null);
    const index = context?.lanes.indexOf(id) ?? -1;
    const column = context?.headerWidth ?? 0;
    const trail = context?.trail ?? 0;
    const setLane = context?.setLane;
    const hasHeader = header != null && header !== false;

    // Gone from the timeline only when it unmounts, or takes another id.
    useEffect(() => () => setLane?.(id, null), [id, setLane]);

    return (
      // biome-ignore lint/a11y/useSemanticElements: a fieldset can't be a row of a timeline; a group names the lane for what's in it.
      <div
        {...props}
        ref={(node) => {
          if (node) {
            // The row comes from the lane's place among the lanes; the first row is the playhead's.
            setStyle(node, "grid-row", index >= 0 ? String(index + 2) : "");
            // The lane reaches back over the room the timeline keeps before the
            // first unit, so its header can stay there: a sticky box can't
            // leave the box it's in.
            setStyle(node, "margin-inline-start", column > 0 ? `${-(column + trail)}px` : "");
            // React calls this at every commit: saying the same again changes nothing.
            setLane?.(id, { element: node, toolbar: toolbar.current });
          }
          if (typeof ref === "function") {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        role="group"
        aria-label={label}
        data-hm-lane={id}
        className={cx("hm-timeline-lane", classNames?.root, className)}
        data-hm-unstyled={unstyledAttribute(unstyled)}
      >
        <TimelineLaneContext.Provider value={id}>
          {hasHeader ? (
            <div
              className={cx("hm-timeline-lane-header", classNames?.header)}
              ref={(node) => {
                if (node) {
                  // Beside the lane: as wide as the headers' column, then the
                  // gap the timeline keeps before the first unit.
                  setStyle(node, "inline-size", column > 0 ? `${column}px` : "");
                  setStyle(node, "margin-inline-end", column > 0 ? `${trail}px` : "");
                  // A sticky box's inset is measured from inside the scrolling
                  // box's padding, and the headers' column is that padding.
                  setStyle(node, "inset-inline-start", column > 0 ? `${-(column + trail)}px` : "");
                }
              }}
            >
              <Toolbar ref={toolbar} label={label} className="hm-timeline-lane-toolbar">
                {header}
              </Toolbar>
            </div>
          ) : null}
          {children}
        </TimelineLaneContext.Provider>
      </div>
    );
  },
);
