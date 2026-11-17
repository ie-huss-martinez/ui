import {
  createContext,
  type FocusEvent,
  forwardRef,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
} from "react";
import { useAnnounce } from "../announcer/Announcer.js";
import { useUiMessages } from "../messages/UiMessagesProvider.js";
import { cx, type StyleProps, unstyledAttribute } from "../shared/style-props.js";
import { items as focusableItems } from "../toolbar/roving-focus.js";

/**
 * Props of {@link ReorderableList}.
 *
 * @public
 */
export interface ReorderableListProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "className" | "role">,
    StyleProps<"root"> {
  /** The list's accessible name, such as "Layers". Required. */
  readonly label: string;
  /** The selected item's `id`, or `null` for none. */
  readonly selectedId?: string | null | undefined;
  /** Called with an item's `id` when the user selects it. */
  readonly onSelectedChange?: ((id: string) => void) | undefined;
  /**
   * Called when the user moves an item with Alt+↑ or Alt+↓ (Option on
   * macOS), with its `id` and the position it should have, counted from 0.
   * Render the items in the new order, or leave them when the move isn't
   * allowed. Without it, the list doesn't reorder.
   */
  readonly onMove?: ((id: string, toIndex: number) => void) | undefined;
  /**
   * Called when the user presses Delete or Backspace on an item, with its
   * `id`. Render the items without it. Without it, the keys do nothing.
   */
  readonly onRemove?: ((id: string) => void) | undefined;
  /**
   * Whether the list announces a move to screen readers, through the
   * closest `AnnouncerProvider`. Defaults to `true`; pass `false` when you
   * announce it in your own words.
   */
  readonly announceMoves?: boolean | undefined;
  /** The items: {@link ReorderableListItem} elements, in the order shown. */
  readonly children?: ReactNode;
}

/**
 * The parts of a reorderable list's item that `classNames` can target.
 *
 * @public
 */
export type ReorderableListItemPart = "root" | "item" | "control";

/**
 * Props of {@link ReorderableListItem}.
 *
 * @public
 */
export interface ReorderableListItemProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "className" | "role" | "id">,
    StyleProps<ReorderableListItemPart> {
  /** Identifies the item in `selectedId`, `onMove` and `onRemove`. Unique in the list. */
  readonly id: string;
  /**
   * The item's accessible name, such as a layer's name. Start it with the
   * text the item shows, if it shows any.
   */
  readonly label: string;
  /**
   * The item's controls, such as a visibility toggle: one focusable control
   * each, in its own cell. A control that can't act should stay focusable,
   * as `focusableWhenDisabled` makes a button.
   */
  readonly controls?: readonly ReactNode[] | undefined;
  /** What the item shows. */
  readonly children?: ReactNode;
}

interface ListContext {
  readonly selectedId: string | null | undefined;
}

const ReorderableListContext = /* @__PURE__ */ createContext<ListContext | undefined>(undefined);

/** A change asked for from the keyboard, whose focus is restored once it renders. */
interface Pending {
  readonly kind: "move" | "remove";
  readonly id: string;
  /** The item's position when the key was pressed. */
  readonly index: number;
  /** The focused cell's position in its row. */
  readonly cell: number;
  /** The items' ids when the key was pressed. */
  readonly order: string;
}

/** Keys that never act inside text fields, where they edit text. */
function editsText(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      (target instanceof HTMLInputElement &&
        !["button", "checkbox", "radio", "reset", "submit"].includes(target.type)))
  );
}

/** The list's rows, in the order shown. */
function rowsOf(list: HTMLElement): HTMLElement[] {
  return [...list.children].filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && child.getAttribute("role") === "row",
  );
}

/** A row's focus targets: the item's cell, then each cell's control. */
function cellsOf(row: HTMLElement): HTMLElement[] {
  const targets: HTMLElement[] = [];
  for (const cell of row.children) {
    if (!(cell instanceof HTMLElement)) {
      continue;
    }
    if (cell.dataset["hmCell"] === "item") {
      targets.push(cell);
    } else {
      const control = focusableItems(cell)[0];
      if (control) {
        targets.push(control);
      }
    }
  }
  return targets;
}

const idOf = (row: HTMLElement | undefined): string => row?.dataset["hmId"] ?? "";
const orderOf = (rows: HTMLElement[]): string => JSON.stringify(rows.map(idOf));
const selectedRow = (rows: HTMLElement[]): HTMLElement | undefined =>
  rows.find((row) => row.getAttribute("aria-selected") === "true");

/**
 * Makes one cell the list's only Tab stop: `active` when it's a cell, else
 * the cell that already is, else the selected row's item, else the first.
 */
function syncTabStop(list: HTMLElement, active?: Element | null): void {
  const rows = rowsOf(list);
  const all = rows.flatMap(cellsOf);
  const current =
    all.find((cell) => cell === active) ??
    all.find((cell) => cell.dataset["hmTabStop"] !== undefined) ??
    cellsOf(selectedRow(rows) ?? rows[0] ?? list)[0];
  for (const cell of all) {
    const isStop = cell === current;
    // Marks a control the list manages, so it still counts at tabindex -1.
    cell.dataset["hmRoving"] = "";
    cell.tabIndex = isStop ? 0 : -1;
    if (isStop) {
      cell.dataset["hmTabStop"] = "";
    } else {
      delete cell.dataset["hmTabStop"];
    }
  }
}

/**
 * A list whose items the user selects, reorders and removes, with one Tab
 * stop and room for controls in each row (docs/adr/0009). It's a WAI-ARIA
 * grid with one column of rows.
 *
 * - **↑ and ↓** move between rows and select; with Ctrl or ⌘, they move
 *   without selecting. **← and →**, Home and End move between a row's
 *   cells. Ctrl or ⌘ with Home or End goes to the first or last row.
 *   Space or Enter on an item selects it.
 * - **Alt+↑ and Alt+↓** (Option on macOS) move the focused item, through
 *   `onMove`. **Delete and Backspace** remove it, through `onRemove`.
 * - **You own the order.** The list calls `onMove` and `onRemove`, and you
 *   render the result. Focus stays with a moved item, and goes to the next
 *   one after a removal.
 * - **Offer buttons too.** The keys are an addition: also render buttons
 *   that move the selected item, for touch and for people who don't know
 *   the keys, and name the keys on them with `aria-keyshortcuts`.
 *
 * @example
 * ```tsx
 * <ReorderableList
 *   label={t("layers.label")}
 *   selectedId={selected}
 *   onSelectedChange={setSelected}
 *   onMove={(id, toIndex) => session.moveLayer(id, toIndex)}
 *   onRemove={(id) => session.deleteLayer(id)}
 * >
 *   {layers.map((layer) => (
 *     <ReorderableListItem
 *       key={layer.id}
 *       id={layer.id}
 *       label={layer.name}
 *       controls={[
 *         <ToggleButton
 *           key="visible"
 *           variant="quiet"
 *           label={t("layers.visible")}
 *           icon={<VisibleIcon />}
 *           pressed={layer.visible}
 *           onPressedChange={(visible) => session.showLayer(layer.id, visible)}
 *         />,
 *       ]}
 *     >
 *       {layer.name}
 *     </ReorderableListItem>
 *   ))}
 * </ReorderableList>
 * ```
 *
 * @public
 */
export const ReorderableList = /* @__PURE__ */ forwardRef<HTMLDivElement, ReorderableListProps>(
  function ReorderableList(
    {
      label,
      selectedId,
      onSelectedChange,
      onMove,
      onRemove,
      announceMoves = true,
      className,
      classNames,
      unstyled,
      onKeyDown,
      onClick,
      onFocus,
      onBlur,
      children,
      ...props
    },
    ref,
  ) {
    const list = useRef<HTMLDivElement | null>(null);
    const pending = useRef<Pending | undefined>(undefined);
    const lastSelected = useRef(selectedId);
    const announce = useAnnounce();
    const messages = useUiMessages();

    // After every render: one Tab stop, and the focus a move or a removal
    // asked for, once the host has rendered it.
    useEffect(() => {
      const element = list.current;
      if (!element) {
        return;
      }
      const change = pending.current;
      const rows = rowsOf(element);
      if (change && orderOf(rows) !== change.order) {
        pending.current = undefined;
        const index =
          change.kind === "move"
            ? rows.findIndex((row) => idOf(row) === change.id)
            : Math.min(change.index, rows.length - 1);
        const row = rows[index];
        // Only where focus was dropped or is still in the list: never taken
        // from wherever the user has gone since.
        const active = document.activeElement;
        const free = !active || active === document.body || element.contains(active);
        if (row && free) {
          const cells = cellsOf(row);
          const target = cells[change.cell] ?? cells[0];
          syncTabStop(element, target);
          target?.focus();
        }
        if (row && change.kind === "move" && announceMoves) {
          announce(
            messages.t("reorderableList.moved", {
              label: cellsOf(row)[0]?.getAttribute("aria-label") ?? "",
              position: index + 1,
              count: rows.length,
            }),
          );
        }
      }
      // With focus elsewhere, the Tab stop follows a selection made elsewhere,
      // such as on an editor's stage; with focus inside, it stays with focus.
      const inside = element.contains(document.activeElement);
      const reselected = lastSelected.current !== selectedId;
      lastSelected.current = selectedId;
      syncTabStop(
        element,
        inside
          ? document.activeElement
          : reselected
            ? cellsOf(selectedRow(rowsOf(element)) ?? element)[0]
            : null,
      );
    });

    const select = (id: string): void => {
      if (id !== "" && id !== selectedId) {
        onSelectedChange?.(id);
      }
    };

    const focusCell = (row: HTMLElement | undefined, cell: number): void => {
      if (!row || !list.current) {
        return;
      }
      const cells = cellsOf(row);
      const target = cells[cell] ?? cells[0];
      syncTabStop(list.current, target);
      target?.focus();
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
      onKeyDown?.(event);
      // Whatever was asked for before, the user has moved on.
      pending.current = undefined;
      if (
        event.defaultPrevented ||
        event.nativeEvent.isComposing ||
        event.shiftKey ||
        editsText(event.target)
      ) {
        return;
      }
      const element = event.currentTarget;
      const rows = rowsOf(element);
      const index = rows.findIndex((row) => row.contains(event.target as Node));
      const row = rows[index];
      if (!row) {
        return;
      }
      const cells = cellsOf(row);
      const cell = cells.indexOf(event.target as HTMLElement);
      if (cell === -1) {
        return;
      }
      // Ctrl or ⌘ moves without selecting, as in pdf-sdk's thumbnails.
      const quiet = event.ctrlKey || event.metaKey;
      const vertical = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;

      if (event.altKey) {
        // Taken even at the first and last rows, so the page never scrolls.
        if (vertical !== 0 && !quiet && onMove) {
          event.preventDefault();
          const toIndex = index + vertical;
          if (toIndex >= 0 && toIndex < rows.length) {
            pending.current = { kind: "move", id: idOf(row), index, cell, order: orderOf(rows) };
            onMove(idOf(row), toIndex);
          }
        }
        return;
      }

      if (vertical !== 0) {
        event.preventDefault();
        const next = rows[index + vertical];
        if (next) {
          focusCell(next, cell);
          if (!quiet) {
            select(idOf(next));
          }
        }
        return;
      }

      if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        if (quiet) {
          focusCell(event.key === "Home" ? rows[0] : rows[rows.length - 1], cell);
        } else {
          focusCell(row, event.key === "Home" ? 0 : cells.length - 1);
        }
        return;
      }

      if (quiet) {
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const rtl = getComputedStyle(element).direction === "rtl";
        const step = (event.key === "ArrowRight") === rtl ? -1 : 1;
        if (cells[cell + step]) {
          focusCell(row, cell + step);
        }
      } else if ((event.key === "Delete" || event.key === "Backspace") && onRemove) {
        event.preventDefault();
        pending.current = { kind: "remove", id: idOf(row), index, cell, order: orderOf(rows) };
        onRemove(idOf(row));
      } else if ((event.key === " " || event.key === "Enter") && cell === 0) {
        // A control keeps Space and Enter for its own action.
        event.preventDefault();
        select(idOf(row));
      }
    };

    const handleClick = (event: MouseEvent<HTMLDivElement>): void => {
      onClick?.(event);
      const target = event.target as HTMLElement;
      const row = rowsOf(event.currentTarget).find((candidate) => candidate.contains(target));
      // A press on a control only acts on the control.
      if (row && !event.defaultPrevented && target.closest('[data-hm-cell="control"]') === null) {
        select(idOf(row));
      }
    };

    const handleFocus = (event: FocusEvent<HTMLDivElement>): void => {
      onFocus?.(event);
      syncTabStop(event.currentTarget, event.target);
    };

    const handleBlur = (event: FocusEvent<HTMLDivElement>): void => {
      onBlur?.(event);
      // Focus went somewhere else on purpose, so nothing brings it back.
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) {
        pending.current = undefined;
      }
    };

    return (
      // biome-ignore lint/a11y/useSemanticElements: a table can't be a list of rows with one Tab stop; role="grid" on a div is the APG layout grid.
      <div
        {...props}
        ref={(node) => {
          list.current = node;
          if (typeof ref === "function") {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        role="grid"
        aria-label={label}
        className={cx("hm-reorderable-list", classNames?.root, className)}
        data-hm-unstyled={unstyledAttribute(unstyled)}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        onFocus={handleFocus}
        onBlur={handleBlur}
      >
        <ReorderableListContext.Provider value={{ selectedId }}>
          {children}
        </ReorderableListContext.Provider>
      </div>
    );
  },
);

/**
 * An item of a {@link ReorderableList}: a row with the item's content, and a
 * cell for each of its `controls`.
 *
 * @public
 */
export const ReorderableListItem = /* @__PURE__ */ forwardRef<
  HTMLDivElement,
  ReorderableListItemProps
>(function ReorderableListItem(
  { id, label, controls, className, classNames, unstyled, children, ...props },
  ref,
) {
  const selected = useContext(ReorderableListContext)?.selectedId === id;
  return (
    // biome-ignore lint/a11y/useSemanticElements: a row of the APG layout grid; see ReorderableList.
    // biome-ignore lint/a11y/useFocusableInteractive: the row's cells take focus, not the row.
    <div
      {...props}
      ref={ref}
      role="row"
      aria-selected={selected}
      data-hm-id={id}
      className={cx("hm-reorderable-list-row", classNames?.root, className)}
      data-hm-unstyled={unstyledAttribute(unstyled)}
    >
      {/* biome-ignore lint/a11y/useSemanticElements: a cell of the APG layout grid; see ReorderableList. */}
      <div
        role="gridcell"
        aria-label={label}
        // The list keeps one Tab stop; before it runs, the selected item is it.
        tabIndex={selected ? 0 : -1}
        data-hm-cell="item"
        className={cx("hm-reorderable-list-item", classNames?.item)}
      >
        {children}
      </div>
      {controls?.map((control, index) => (
        // biome-ignore lint/a11y/useSemanticElements: a cell of the APG layout grid; see ReorderableList.
        // biome-ignore lint/a11y/useFocusableInteractive: the control inside the cell takes focus, not the cell.
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: an item's controls are static and ordered
          key={index}
          role="gridcell"
          data-hm-cell="control"
          className={cx("hm-reorderable-list-control", classNames?.control)}
        >
          {control}
        </div>
      ))}
    </div>
  );
});
