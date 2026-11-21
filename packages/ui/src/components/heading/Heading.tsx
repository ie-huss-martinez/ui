import {
  createContext,
  forwardRef,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
  useContext,
} from "react";
import { type HeadingLevel, toHeadingLevel } from "../../heading/heading-level.js";
import { cx, type StyleProps, unstyledAttribute } from "../shared/style-props.js";

/**
 * The level a {@link Heading} without a `level` renders at. Internal: hosts
 * and SDKs set it with {@link HeadingLevelProvider}, which checks the level.
 * `Dialog` sets its fixed 3 here directly, so it doesn't ship the check.
 */
export const HeadingLevelContext = /* @__PURE__ */ createContext<HeadingLevel>(2);

/**
 * Props of {@link HeadingLevelProvider}.
 *
 * @public
 */
export interface HeadingLevelProviderProps {
  /**
   * The level of the headings inside, from `2` to `6`. Another value is
   * treated as `2`, with a development warning.
   */
  readonly level: HeadingLevel;
  readonly children?: ReactNode;
}

/**
 * Sets the level of every {@link Heading} inside that doesn't set its own
 * (sdk-core ADR 0058). An editor passes its `headingLevel` to its own parts
 * this way, and nests a level down with `nestedHeadingLevel` from the
 * package's root entry.
 *
 * @example
 * ```tsx
 * <HeadingLevelProvider level={headingLevel}>
 *   <Heading>{messages.t("inspector.title")}</Heading>
 *   <HeadingLevelProvider level={nestedHeadingLevel(headingLevel)}>{details}</HeadingLevelProvider>
 * </HeadingLevelProvider>
 * ```
 *
 * @public
 */
export function HeadingLevelProvider({ level, children }: HeadingLevelProviderProps): ReactElement {
  return (
    <HeadingLevelContext.Provider value={toHeadingLevel(level)}>
      {children}
    </HeadingLevelContext.Provider>
  );
}

/**
 * The level from the closest {@link HeadingLevelProvider}, or `2`.
 *
 * @public
 */
export function useHeadingLevel(): HeadingLevel {
  return useContext(HeadingLevelContext);
}

/**
 * The part of {@link Heading} that `classNames` can style.
 *
 * @public
 */
export type HeadingPart = "root";

/**
 * Props of {@link Heading}.
 *
 * @public
 */
export interface HeadingProps
  extends Omit<HTMLAttributes<HTMLHeadingElement>, "className">,
    StyleProps<HeadingPart> {
  /**
   * The heading's level, from `2` to `6`. Defaults to the closest
   * {@link HeadingLevelProvider}'s, or `2`. Another value is treated as `2`,
   * with a development warning.
   */
  readonly level?: HeadingLevel | undefined;
}

/**
 * A native heading, `<h2>` to `<h6>`, for the visible title of a section in
 * a page `ui` doesn't own (sdk-core ADR 0058). Its level comes from `level`,
 * or from the closest {@link HeadingLevelProvider}, so the host sets one
 * number and the page's outline holds. Give it an `id` and label its
 * section with `aria-labelledby`.
 *
 * It's styled as a title, like a dialog's, through `--hm-heading-font-size`.
 * Inside a {@link Dialog}'s content, headings start at level 3, under the
 * dialog's title.
 *
 * @example
 * ```tsx
 * <section aria-labelledby={titleId}>
 *   <Heading id={titleId}>{messages.t("inspector.title")}</Heading>
 *   …
 * </section>
 * ```
 *
 * @public
 */
export const Heading = /* @__PURE__ */ forwardRef<HTMLHeadingElement, HeadingProps>(
  function Heading({ level, className, classNames, unstyled, ...props }, ref) {
    const contextLevel = useHeadingLevel();
    const Element = `h${level === undefined ? contextLevel : toHeadingLevel(level)}` as const;
    return (
      <Element
        {...props}
        ref={ref}
        className={cx("hm-heading", classNames?.root, className)}
        data-hm-unstyled={unstyledAttribute(unstyled)}
      />
    );
  },
);
