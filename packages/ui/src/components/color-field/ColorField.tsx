import {
  type ChangeEvent,
  type FocusEvent,
  forwardRef,
  type InputHTMLAttributes,
  type KeyboardEvent,
  useId,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { warnInDevelopment } from "../../internal/development.js";
import { useFieldLabelId, useFieldProps } from "../field/field-context.js";
import { useUiText } from "../messages/UiMessagesProvider.js";
import { cx, type StyleProps, unstyledAttribute } from "../shared/style-props.js";

declare const process: { readonly env: { readonly NODE_ENV?: string } };

/**
 * A colour a {@link ColorField} offers as a swatch.
 *
 * @public
 */
export interface ColorSwatch {
  /** The colour, as `#rrggbb` or `#rgb`. */
  readonly value: string;
  /** The swatch's accessible name, such as "Red". Use text from your message catalogue. */
  readonly label: string;
}

/**
 * The parts of a colour field that `classNames` can target.
 *
 * @public
 */
export type ColorFieldPart = "root" | "control" | "preview" | "input" | "swatches" | "swatch";

/**
 * Props of {@link ColorField}. Other props go to the hex input.
 *
 * @public
 */
export interface ColorFieldProps
  extends Omit<
      InputHTMLAttributes<HTMLInputElement>,
      "className" | "type" | "value" | "defaultValue" | "onChange"
    >,
    StyleProps<ColorFieldPart> {
  /** The colour, as `#rrggbb`. With it, the field is controlled. */
  readonly value?: string | undefined;
  /** The first colour of an uncontrolled field. Defaults to `#000000`. */
  readonly defaultValue?: string | undefined;
  /** Called with the new colour, always as lowercase `#rrggbb`. */
  readonly onValueChange?: ((value: string) => void) | undefined;
  /** Colours to pick from, shown under the input. Leave it out for the input alone. */
  readonly swatches?: readonly ColorSwatch[] | undefined;
  /**
   * The accessible name, such as "Fill". Leave it out inside a `Field`, or
   * when a visible `<label>` points at the field's `id`.
   */
  readonly label?: string | undefined;
  /** The word that follows the label in the swatch group's name. Defaults to "swatches". */
  readonly swatchesLabel?: string | undefined;
}

const HEX = /^#?(?:([0-9a-f]{3})|([0-9a-f]{6}))$/i;

/**
 * A colour as lowercase `#rrggbb`, from `#rrggbb`, `#rgb` or either without
 * the `#`; `undefined` for anything else. Its result is the only text that
 * reaches an SVG `fill`.
 */
function parseHex(text: string): string | undefined {
  const match = HEX.exec(text.trim());
  if (!match) {
    return undefined;
  }
  const digits = match[2] ?? (match[1] as string).replace(/./g, "$&$&");
  return `#${digits.toLowerCase()}`;
}

/** A square of one colour, drawn with an SVG fill, which needs no inline style. */
function Fill({ color, className }: { color: string; className: string | undefined }) {
  return (
    <svg
      className={className}
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="1" height="1" fill={color} />
    </svg>
  );
}

/**
 * A colour input: a hex field with a preview of the colour, and optional
 * swatches to pick from. It works with the keyboard alone and doesn't use
 * the browser's own colour picker, which differs between browsers and can't
 * be themed or translated.
 *
 * - **The input** takes `#rrggbb`, `#rgb` or either without the `#`. Typing
 *   doesn't change the value: the text is committed on blur or Enter. Text
 *   that isn't a colour goes back to the last value, and Escape throws the
 *   typing away.
 * - **The swatches** are a radio group: one Tab stop, and the arrow keys move
 *   and select. A swatch is checked while the value is its colour.
 * - **The value** is always lowercase `#rrggbb`. With `name`, forms receive it.
 *
 * @example
 * ```tsx
 * <Field label={t("shape.fill")}>
 *   <ColorField
 *     value={fill}
 *     onValueChange={setFill}
 *     swatches={[
 *       { value: "#d92d20", label: t("colors.red") },
 *       { value: "#1570ef", label: t("colors.blue") },
 *     ]}
 *   />
 * </Field>
 * ```
 *
 * @public
 */
export const ColorField = /* @__PURE__ */ forwardRef<HTMLDivElement, ColorFieldProps>(
  function ColorField(
    {
      value: controlled,
      defaultValue,
      onValueChange,
      swatches,
      label,
      swatchesLabel,
      name,
      form,
      disabled,
      className,
      classNames,
      unstyled,
      onBlur,
      onKeyDown,
      ...props
    },
    ref,
  ) {
    const [uncontrolled, setUncontrolled] = useState(
      () => parseHex(defaultValue ?? "") ?? "#000000",
    );
    // What's typed and not yet committed; null while the field shows the value.
    const [draft, setDraft] = useState<string | null>(null);
    const value = (controlled === undefined ? undefined : parseHex(controlled)) ?? uncontrolled;

    const generated = useId();
    const ownLabelId = `${generated}-label`;
    const swatchesLabelId = `${generated}-swatches`;
    const fieldLabelId = useFieldLabelId();
    const swatchesText = useUiText("colorField.swatches");
    const fieldProps = useFieldProps(props, label);
    if (
      label === undefined &&
      !props["aria-label"] &&
      !props["aria-labelledby"] &&
      fieldProps.id === undefined
    ) {
      if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
        warnInDevelopment(
          "ColorField needs an accessible name: pass label, or put it in a Field. Use text from your message catalogue.",
        );
      }
    }

    const options: { readonly value: string; readonly label: string }[] = [];
    for (const swatch of swatches ?? []) {
      const color = parseHex(swatch.value);
      if (color === undefined) {
        if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
          warnInDevelopment(
            `ColorField skipped the swatch "${swatch.label}": its value isn't a colour such as #1570ef.`,
          );
        }
      } else if (!options.some((option) => option.value === color)) {
        options.push({ value: color, label: swatch.label });
      }
    }
    const tabStop = options.find((option) => option.value === value) ?? options[0];

    const commit = (next: string): void => {
      setDraft(null);
      if (next === value) {
        return;
      }
      if (controlled === undefined) {
        setUncontrolled(next);
      }
      onValueChange?.(next);
    };

    // Commits typed text, or goes back to the value when it isn't a colour.
    const commitDraft = (): void => {
      if (draft === null) {
        return;
      }
      const parsed = parseHex(draft);
      if (parsed === undefined) {
        setDraft(null);
      } else {
        commit(parsed);
      }
    };

    const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
      setDraft(event.currentTarget.value);
    };

    const handleBlur = (event: FocusEvent<HTMLInputElement>): void => {
      commitDraft();
      onBlur?.(event);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
      onKeyDown?.(event);
      // An input method editor uses Enter and Escape while composing.
      if (event.defaultPrevented || event.nativeEvent.isComposing) {
        return;
      }
      if (event.key === "Enter") {
        // Not prevented, so Enter still submits a form, which then has the
        // new value: the commit renders synchronously, as in NumberField.
        flushSync(commitDraft);
      } else if (event.key === "Escape" && draft !== null) {
        // Only the typing goes; a dialog around the field stays open.
        event.preventDefault();
        setDraft(null);
      }
    };

    const handleSwatchKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
      const step =
        event.key === "ArrowRight" || event.key === "ArrowDown"
          ? 1
          : event.key === "ArrowLeft" || event.key === "ArrowUp"
            ? -1
            : 0;
      if (step === 0 || options.length === 0 || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      event.preventDefault();
      const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
      const horizontal = event.key === "ArrowRight" || event.key === "ArrowLeft";
      const direction = rtl && horizontal ? -step : step;
      const focused = options.findIndex(
        (option) => option.value === (event.target as HTMLElement).dataset["hmValue"],
      );
      const next = options[(Math.max(0, focused) + direction + options.length) % options.length];
      if (next) {
        commit(next.value);
        event.currentTarget
          .querySelector<HTMLElement>(`[data-hm-value="${CSS.escape(next.value)}"]`)
          ?.focus();
      }
    };

    // The swatch group's name: the field's label, then "swatches".
    const groupLabelIds = [
      fieldLabelId ?? (label === undefined ? props["aria-labelledby"] : ownLabelId),
      swatchesLabelId,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div
        ref={ref}
        className={cx("hm-color-field", classNames?.root, className)}
        data-hm-unstyled={unstyledAttribute(unstyled)}
      >
        <div className={cx("hm-color-field-control", classNames?.control)}>
          <Fill color={value} className={cx("hm-color-field-preview", classNames?.preview)} />
          <input
            {...props}
            {...fieldProps}
            type="text"
            autoComplete={props.autoComplete ?? "off"}
            autoCapitalize={props.autoCapitalize ?? "off"}
            autoCorrect={props.autoCorrect ?? "off"}
            spellCheck={props.spellCheck ?? false}
            maxLength={props.maxLength ?? 7}
            disabled={disabled}
            value={draft ?? value}
            aria-label={label ?? props["aria-label"]}
            className={cx("hm-text-field", "hm-color-field-input", classNames?.input)}
            data-hm-unstyled={unstyledAttribute(unstyled)}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
          />
        </div>
        {options.length === 0 ? null : (
          <>
            {label === undefined ? null : (
              <span id={ownLabelId} hidden>
                {label}
              </span>
            )}
            <span id={swatchesLabelId} hidden>
              {swatchesLabel ?? swatchesText}
            </span>
            <div
              role="radiogroup"
              aria-labelledby={groupLabelIds}
              aria-disabled={disabled ? true : undefined}
              className={cx("hm-color-field-swatches", classNames?.swatches)}
              onKeyDown={handleSwatchKeyDown}
            >
              {options.map((option) => {
                const checked = option.value === value;
                return (
                  // biome-ignore lint/a11y/useSemanticElements: a native radio can't show its colour without an inline style; buttons with role="radio" are the APG pattern, as in SegmentedControl.
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    aria-label={option.label}
                    disabled={disabled}
                    tabIndex={option === tabStop ? 0 : -1}
                    data-hm-value={option.value}
                    className={cx("hm-color-field-swatch", classNames?.swatch)}
                    onClick={() => commit(option.value)}
                  >
                    <Fill color={option.value} className="hm-color-field-swatch-fill" />
                  </button>
                );
              })}
            </div>
          </>
        )}
        {name === undefined ? null : (
          <input type="hidden" name={name} form={form} disabled={disabled} value={value} />
        )}
      </div>
    );
  },
);
