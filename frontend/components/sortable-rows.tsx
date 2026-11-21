"use client";
import {
  Children,
  createContext,
  useContext,
  useState,
  useTransition,
  type ReactNode,
} from "react";

const RowContext = createContext<{ name: string; move: (by: number) => void } | null>(null);

/** `id` moved to position `to`. */
export function moveTo(order: string[], id: string, to: number) {
  const next = order.filter((x) => x !== id);
  next.splice(to, 0, id);
  return next;
}

/**
 * Rows that reorder by dragging their DragHandle, or with the arrow keys on it.
 * The new order saves as soon as the row is dropped. `children` come in the same order as `ids`.
 */
export function SortableRows({
  ids,
  names,
  save,
  messages,
  children,
}: {
  ids: string[];
  names: string[];
  save: (ids: string[]) => Promise<string | null>;
  messages: Record<string, string>;
  children: ReactNode;
}) {
  const rows = Children.toArray(children);
  const key = ids.join();
  const [order, setOrder] = useState(ids);
  const [shown, setShown] = useState(key);
  const [dragging, setDragging] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<{ error: boolean; text: string } | null>(null);
  // A fresh server order (after a save, or another admin's change) replaces the local one.
  if (shown !== key) {
    setShown(key);
    setOrder(ids);
  }
  const commit = (next: string[]) => {
    if (next.join() === key) return;
    setOrder(next);
    setStatus(null);
    start(async () => {
      const error = await save(next);
      if (error) setOrder(ids); // the server kept its order
      setStatus({ error: !!error, text: messages[error ?? "reordered"] ?? messages.REQUEST_FAILED });
    });
  };
  return (
    <div className={"sortable-rows" + (pending ? " saving" : "")} aria-busy={pending}>
      <p className={"sortable-status" + (status?.error ? " error" : "")} role="status">
        {pending ? "Saving order…" : status?.text}
      </p>
      {order.map((id) => {
        const i = ids.indexOf(id);
        if (i < 0) return null;
        return (
          <RowContext.Provider
            key={id}
            value={{
              name: names[i],
              move: (by) => {
                const to = order.indexOf(id) + by;
                if (to >= 0 && to < order.length) commit(moveTo(order, id, to));
              },
            }}
          >
            <div
              className={"sortable-row" + (dragging === id ? " dragging" : "")}
              onDragStart={(e) => {
                // Only the handle is draggable, so inputs keep normal text selection; show the whole row moving.
                e.dataTransfer.setDragImage(e.currentTarget, 24, 24);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", names[i]);
                setDragging(id);
              }}
              onDragOver={(e) => {
                if (!dragging) return; // a drag from another section or outside the page
                e.preventDefault();
                if (dragging !== id) setOrder((o) => moveTo(o, dragging, o.indexOf(id)));
              }}
              onDrop={(e) => e.preventDefault()}
              onDragEnd={(e) => {
                setDragging(null);
                if (e.dataTransfer.dropEffect === "none") setOrder(ids); // cancelled with Esc or dropped outside
                else commit(order);
              }}
            >
              {rows[i]}
            </div>
          </RowContext.Provider>
        );
      })}
    </div>
  );
}

/** The grip a row is dragged by; arrow keys move the row while it has focus. */
export function DragHandle() {
  const row = useContext(RowContext);
  if (!row) return null;
  return (
    // A span, not a <button>: Firefox never starts a drag from a button.
    <span
      role="button"
      tabIndex={0}
      draggable
      className="drag-handle"
      aria-label={`Reorder ${row.name}`}
      aria-keyshortcuts="ArrowUp ArrowDown"
      title="Drag to reorder, or use the arrow keys"
      onKeyDown={(e) => {
        if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
        e.preventDefault();
        row.move(e.key === "ArrowUp" ? -1 : 1);
        // Moving the row's DOM node drops focus; put it back so the next key press works.
        const handle = e.currentTarget;
        requestAnimationFrame(() => handle.focus());
      }}
    >
      <span aria-hidden="true">⠿</span>
    </span>
  );
}
