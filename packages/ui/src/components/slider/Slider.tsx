import {
  type ChangeEvent,
  type FocusEvent,
  forwardRef,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { warnInDevelopment } from "../../internal/development.js";
import { useFieldProps } from "../field/field-context.js";
import { decimals, roundTo } from "../shared/number.js";
import { cx, type StyleProps, unstyledAttribute } from "../shared/style-props.js";

declare const process: { readonly env: { readonly NODE_ENV?: string } };

/**
 * Props of {@link Slider}. Native input props are passed through.
 *
 * @public
 */
export interface SliderProps
  extends Omit<
      InputHTMLAttributes<HTMLInputElement>,
      | "className"
      | "type"
      | "value"
      | "defaultValue"
      | "min"
      | "max"
      | "step"
      | "onChange"
      | "aria-valuetext"
    >,
    StyleProps<"root"> {
  /** The value, when you control it. Leave it out to let the slider keep its own. */
  readonly value?: number | undefined;
  /** The starting value, when the slider keeps its own. Defaults to `min`. */
  readonly defaultValue?: number | undefined;
  /** Called with the new value as it changes, by pointer or keyboard. */
  readonly onValueChange?: ((value: number) => void) | undefined;
  /**
   * Called once when a gesture that changed the value ends, with the value
   * it ended on: when the pointer is let go, when the last key held is let
   * go, or when the slider loses focus first. Use it for what should happen
   * once per gesture, such as an undo step, and `onValueChange` for what
   * follows the value as it moves. A gesture that leaves the value where it
   * was calls nothing.
   */
  readonly onValueCommit?: ((value: number) => void) | undefined;
  /** Defaults to 0. */
  readonly min?: number | undefined;
  /** Defaults to 100. */
  readonly max?: number | undefined;
  /** The arrow keys' step, and the values the slider snaps to. Defaults to 1. */
  readonly step?: number | undefined;
  /**
   * The Page Up and Page Down step. Defaults to a tenth of the range, rounded
   * to a whole number of steps.
   */
  readonly largeStep?: number | undefined;
  /**
   * Writes the value as text for screen readers, such as "−6 dB" or "1:05",
   * exposed as `aria-valuetext`. Without it, they read the number. Format
   * for the user's locale, as `Intl.NumberFormat` does.
   */
  readonly formatValue?: ((value: number) => string) | undefined;
  /**
   * The accessible name, such as "Volume". Leave it out inside a `Field`,
   * or when a visible `<label>` points at the slider's `id`, or
   * `aria-labelledby` names it.
   */
  readonly label?: string | undefined;
}

/** Keeps a value in range and on a step from `min`, as the native input does. */
function snap(value: number, min: number, max: number, step: number): number {
  const precision = Math.max(decimals(min), decimals(step));
  // Rounds away float error, such as 3 × 0.1 = 0.30000000000000004, before
  // any comparison, so it can't look like an overshoot.
  const round = (n: number): number => roundTo(n, precision);
  const upper = Math.max(min, max);
  const stepped = round(step > 0 ? min + Math.round((value - min) / step) * step : value);
  // A step that doesn't divide the range can overshoot the top; step back.
  const inRange = stepped > upper && step > 0 ? round(stepped - step) : stepped;
  return Math.min(Math.max(inRange, min), upper);
}

/**
 * A slider for a value in a range, such as volume or zoom, on the native
 * `<input type="range">`.
 *
 * Arrow keys move by `step`, Page Up and Page Down by `largeStep`, and Home
 * and End to the ends. In right-to-left text, the slider is mirrored and the
 * left and right arrows follow it, in every browser. `formatValue` gives
 * screen readers the value as text.
 *
 * `onValueChange` follows the value as it moves; `onValueCommit` is called
 * once when the gesture ends, for what should happen once, such as an undo
 * step: a drag let go, a key let go after one press or a held repeat, or
 * focus leaving first.
 *
 * Inside a `Toolbar`, the slider keeps the arrow keys, Home and End, so
 * they can't move focus past it: put it last in the toolbar. Tab still
 * leaves the toolbar.
 *
 * It has no filled part of the track, because one would need an inline
 * style, which a strict Content Security Policy blocks.
 *
 * @example
 * ```tsx
 * <Slider
 *   label={messages.t("player.volume")}
 *   min={-60}
 *   max={0}
 *   value={gain}
 *   onValueChange={setGain}
 *   formatValue={(db) => messages.t("player.decibels", { db })}
 * />
 * ```
 *
 * @public
 */
export const Slider = /* @__PURE__ */ forwardRef<HTMLInputElement, SliderProps>(function Slider(
  {
    value: controlled,
    defaultValue,
    onValueChange,
    onValueCommit,
    min = 0,
    max = 100,
    step = 1,
    largeStep,
    formatValue,
    label,
    className,
    classNames,
    unstyled,
    onKeyDown,
    onKeyUp,
    onPointerDown,
    onBlur,
    ...props
  },
  ref,
) {
  const [uncontrolled, setUncontrolled] = useState(() => snap(defaultValue ?? min, min, max, step));
  const value = snap(controlled ?? uncontrolled, min, max, step);

  const fieldProps = useFieldProps(props, label);

  if (
    label === undefined &&
    !props["aria-label"] &&
    !props["aria-labelledby"] &&
    fieldProps.id === undefined
  ) {
    if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
      warnInDevelopment(
        "Slider needs an accessible name: pass label, or point a visible <label> at its id. Use text from your message catalogue.",
      );
    }
  }

  // A gesture's changes, until it ends: the last value given, if any. It
  // ends on events, never on a timer, so a slow machine commits as often as
  // a fast one.
  const pending = useRef<number | null>(null);
  // Step keys held down now. A held key repeats its keydown, and lets go once.
  const held = useRef(new Set<string>());
  const commitRef = useRef(onValueCommit);
  commitRef.current = onValueCommit;
  const commit = (): void => {
    const last = pending.current;
    pending.current = null;
    if (last !== null) {
      commitRef.current?.(last);
    }
  };

  const change = (next: number): void => {
    const snapped = snap(next, min, max, step);
    if (snapped === value) {
      return;
    }
    if (controlled === undefined) {
      setUncontrolled(snapped);
    }
    pending.current = snapped;
    onValueChange?.(snapped);
  };

  // A pointer gesture ends when the pointer is let go, wherever it is by
  // then: the thumb can be dragged off the slider. The input's own `change`
  // event, which every engine fires on release and when assistive
  // technology sets the value, ends it too.
  const input = useRef<HTMLInputElement | null>(null);
  const commitLater = useRef(commit);
  commitLater.current = commit;
  useEffect(() => {
    const element = input.current;
    if (!element) {
      return;
    }
    const onCommit = (): void => commitLater.current();
    element.addEventListener("change", onCommit);
    return () => element.removeEventListener("change", onCommit);
  }, []);
  const handlePointerDown = (event: PointerEvent<HTMLInputElement>): void => {
    onPointerDown?.(event);
    const release = (): void => {
      window.removeEventListener("pointerup", release, true);
      window.removeEventListener("pointercancel", release, true);
      commitLater.current();
    };
    window.addEventListener("pointerup", release, true);
    window.addEventListener("pointercancel", release, true);
  };

  const handleKeyUp = (event: KeyboardEvent<HTMLInputElement>): void => {
    onKeyUp?.(event);
    if (held.current.delete(event.key) && held.current.size === 0) {
      commit();
    }
  };

  // Focus leaving mid-gesture ends it: a key let go elsewhere isn't seen.
  const handleBlur = (event: FocusEvent<HTMLInputElement>): void => {
    onBlur?.(event);
    held.current.clear();
    commit();
  };

  // Pointer changes come from the native input.
  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    change(event.currentTarget.valueAsNumber);
  };

  // Keys are handled here rather than by the browser, so every engine does
  // the same: WebKit doesn't mirror the arrow keys in right-to-left text.
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    onKeyDown?.(event);
    // Alt and Meta combinations stay with the browser and the system.
    if (event.defaultPrevented || event.altKey || event.metaKey) {
      return;
    }
    const large = largeStep ?? Math.max(step, Math.round((max - min) / 10 / step) * step);
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const targets: Record<string, number> = {
      ArrowUp: value + step,
      ArrowDown: value - step,
      ArrowRight: rtl ? value - step : value + step,
      ArrowLeft: rtl ? value + step : value - step,
      PageUp: value + large,
      PageDown: value - large,
      Home: min,
      End: max,
    };
    const next = targets[event.key];
    if (next === undefined) {
      return;
    }
    event.preventDefault();
    held.current.add(event.key);
    change(next);
  };

  return (
    <input
      {...props}
      {...fieldProps}
      ref={(node) => {
        input.current = node;
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      }}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      aria-label={label ?? props["aria-label"]}
      aria-valuetext={formatValue?.(value)}
      className={cx("hm-slider", classNames?.root, className)}
      data-hm-unstyled={unstyledAttribute(unstyled)}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onPointerDown={handlePointerDown}
      onBlur={handleBlur}
    />
  );
});
