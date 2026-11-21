import { requireStaff } from "@/lib/auth/authorize";
import { deleteMenuItemAction, saveMenuItemAction } from "@/app/actions/orders";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { PhotoThumbnailUpload } from "@/components/photo-thumbnail-upload";
import { menuImage } from "@/lib/menu";
import { getSiteContent, itemPhoto, itemPhotoKey } from "@/lib/site-content";
import {
  getMenu,
  menuSections,
  orderMessages,
  type MenuRow,
} from "@/lib/orders";
import {
  AddCard,
  colLabel,
  FilterTabs,
  SectionCard,
} from "@/components/admin-ui";
export const dynamic = "force-dynamic";

function ItemForm({ item, photo }: { item?: MenuRow; photo?: string }) {
  // Saved rows sit under a shared header; the add form keeps its labels.
  const compact = !!item;
  return (
    <div className={"admin-menu-item" + (item ? "" : " admin-menu-item-create")}>
      {item && (
        <div className="admin-item-photo">
          <PhotoThumbnailUpload
            name={item.name}
            photoKey={itemPhotoKey("menu", item.id)}
            src={photo ?? menuImage(item.name) ?? "/design/dining.jpg"}
            returnTo="/admin/menu"
            canRemove={!!photo}
          />
        </div>
      )}
      {/* The form uses display: contents, so its fields and actions sit in the row grid. */}
      <form action={saveMenuItemAction} className="edit-row">
        {item && <input type="hidden" name="id" value={item.id} />}
        <label className="edit-wide">
          {colLabel("Name", compact)}
          <input name="name" required maxLength={80} defaultValue={item?.name} />
        </label>
        <label>
          {colLabel("Section", compact)}
          <select name="section" defaultValue={item?.section ?? menuSections[0]}>
            {menuSections.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          {colLabel("Price (₱)", compact)}
          <input
            name="price"
            type="number"
            required
            min={0}
            max={100000}
            step="0.01"
            defaultValue={item?.price}
          />
        </label>
        <label className="menu-description-field">
          {colLabel("Description", compact)}
          <input
            name="description"
            maxLength={500}
            defaultValue={item?.description}
          />
        </label>
        <label className="edit-check">
          <input
            name="available"
            type="checkbox"
            defaultChecked={item?.available ?? true}
          />
          {colLabel("Available", compact)}
        </label>
        <div className="admin-item-actions">
          <button className="button">{item ? "Save" : "Add item"}</button>
          {item && (
            <ConfirmDeleteButton
              action={deleteMenuItemAction}
              title={`Delete ${item.name}?`}
              message="Items already used on an order are kept to preserve order history. Mark them unavailable instead."
            />
          )}
        </div>
      </form>
    </div>
  );
}

export default async function Menu({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string; section?: string }>;
}) {
  await requireStaff(true);
  const [{ notice, error, section: picked }, menu, content] = await Promise.all([
    searchParams,
    getMenu(),
    getSiteContent(),
  ]);
  const message = orderMessages[error ?? notice ?? ""];
  const shown = menuSections.find((s) => s === picked);
  return (
    <>
      <p className="eyebrow">RESTAURANT</p>
      <h1>Menu</h1>
      <p className="intro">
        Prices and availability used for staff orders. Changing a price never
        alters orders already saved, and every change is recorded in the
        activity log.
      </p>
      {message && (
        <p
          className={"notice" + (error ? " error" : "")}
          role={error ? "alert" : "status"}
        >
          {message}
        </p>
      )}
      <AddCard title="Add a menu item">
        <div className="admin-menu-create-scroll">
          <ItemForm />
        </div>
      </AddCard>
      <FilterTabs
        label="Menu sections"
        tabs={[
          {
            label: "All",
            count: menu.length,
            href: "/admin/menu",
            active: !shown,
          },
          ...menuSections.map((s) => ({
            label: s,
            count: menu.filter((m) => m.section === s).length,
            href: "/admin/menu?section=" + encodeURIComponent(s),
            active: shown === s,
          })),
        ]}
      />
      {menuSections
        .filter((s) => !shown || s === shown)
        .map((section) => {
          const items = menu.filter((m) => m.section === section);
          return (
            <SectionCard
              key={section}
              title={section}
              count={items.length}
              head={["Photo", "Name", "Section", "Price (₱)", "Description", "Available", "Actions"]}
              cols="96px minmax(140px,1.35fr) minmax(110px,.9fr) minmax(96px,.65fr) minmax(160px,1.5fr) auto minmax(145px,auto)"
            >
              {items.map((m) => (
                <ItemForm
                  key={m.id}
                  item={m}
                  photo={itemPhoto(content, "menu", m.id)}
                />
              ))}
            </SectionCard>
          );
        })}
    </>
  );
}
