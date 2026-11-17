import { type ChangeEvent, forwardRef, type TextareaHTMLAttributes } from "react";
import { warnInDevelopment } from "../../internal/development.js";
import { useFieldProps } from "../field/field-context.js";
import { cx, type StyleProps, unstyledAttribute } from "../shared/style-props.js";

declare const process: { readonly env: { readonly NODE_ENV?: string } };

/**
 * Props of {@link TextArea}. Native textarea props are passed through, so it
 * works controlled with `value` and `onChange`, or uncontrolled with
 * `defaultValue`.
 *
 * @public
 */
export interface TextAreaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className">,
    StyleProps<"root"> {
  /** Called with the new text as it changes, as well as `onChange`. */
  readonly onValueChange?: ((value: string) => void) | undefined;
  /**
   * The accessible name, such as "Caption". Leave it out inside a `Field`,
   * or when a visible `<label>` points at the field's `id`, or
   * `aria-labelledby` names it.
   */
  readonly label?: string | undefined;
}

/**
 * A multi-line text input, styled like `TextField`, with its tokens. `rows`
 * sets its height, three by default, and the user can drag it taller. Inside
 * a `Field`, it takes the field's label, description and error.
 *
 * Enter adds a line, so it doesn't submit a form. Its value separates lines
 * with `\n`, whatever was pasted.
 *
 * @example
 * ```tsx
 * <Field label={t("text.content")}>
 *   <TextArea value={text} onValueChange={setText} rows={4} />
 * </Field>
 * ```
 *
 * @public
 */
export const TextArea = /* @__PURE__ */ forwardRef<HTMLTextAreaElement, TextAreaProps>(
  function TextArea(
    { rows = 3, onValueChange, onChange, label, className, classNames, unstyled, ...props },
    ref,
  ) {
    const fieldProps = useFieldProps(props, label);
    if (
      label === undefined &&
      !props["aria-label"] &&
      !props["aria-labelledby"] &&
      fieldProps.id === undefined
    ) {
      if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
        warnInDevelopment(
          "TextArea needs an accessible name: pass label, or put it in a Field. Use text from your message catalogue.",
        );
      }
    }

    const handleChange = (event: ChangeEvent<HTMLTextAreaElement>): void => {
      onChange?.(event);
      onValueChange?.(event.currentTarget.value);
    };

    return (
      <textarea
        {...props}
        {...fieldProps}
        ref={ref}
        rows={rows}
        aria-label={label ?? props["aria-label"]}
        // A text field, with its class and tokens, then the area's own layout.
        className={cx("hm-text-field", "hm-text-area", classNames?.root, className)}
        data-hm-unstyled={unstyledAttribute(unstyled)}
        onChange={handleChange}
      />
    );
  },
);
