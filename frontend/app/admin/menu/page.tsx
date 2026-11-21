import { requireStaff } from "@/lib/auth/authorize";
import {
  deleteMenuItemAction,
  deleteMenuSectionAction,
  reorderMenuAction,
  restoreMenuItemAction,
  saveMenuItemAction,
  saveMenuSectionAction,
} from "@/app/actions/orders";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { MenuPhotoPicker } from "@/components/menu-photo-picker";
import { PhotoThumbnailUpload } from "@/components/photo-thumbnail-upload";
import { DragHandle, SortableRows } from "@/components/sortable-rows";
import { menuImage } from "@/lib/menu";
import { getSiteContent, itemPhoto, itemPhotoKey } from "@/lib/site-content";
import {
  getMenu,
  getMenuSections,
  orderMessages,
  peso,
  type MenuRow,
  type MenuSection,
} from "@/lib/orders";
import {
  AddCard,
  colLabel,
  FilterTabs,
  SectionCard,
} from "@/components/admin-ui";
export const dynamic = "force-dynamic";

const ARCHIVED = "archived";

/** The add form: photo on the left, fields in two rows on the right. */
function AddItemForm({ sections, tab }: { sections: MenuSection[]; tab: string }) {
  return (
    <form action={saveMenuItemAction} className="menu-add-form">
      <input type="hidden" name="tab" value={tab} />
      <MenuPhotoPicker />
      <div className="menu-add-fields">
        <label>
          Name
          <input name="name" required maxLength={80} />
        </label>
        <label>
          Section
          <select name="section" defaultValue={(sections.find((s) => s.name === tab) ?? sections[0])?.name}>
            {sections.map((s) => (
              <option key={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <label>
          Price (₱)
          <input name="price" type="number" required min={0} max={100000} step="0.01" />
        </label>
        <label className="menu-add-description">
          Description
          <input name="description" maxLength={500} />
        </label>
        <div className="menu-add-end">
          <label className="edit-check">
            <input name="available" type="checkbox" defaultChecked />
            Available
          </label>
          <button className="button">Add item</button>
        </div>
      </div>
    </form>
  );
}

function ItemForm({
  item,
  photo,
  sections,
  tab,
}: {
  item: MenuRow;
  photo?: string;
  sections: MenuSection[];
  tab: string;
}) {
  return (
    <div className="admin-menu-item">
      <div className="admin-item-photo">
        <PhotoThumbnailUpload
          name={item.name}
          photoKey={itemPhotoKey("menu", item.id)}
          src={photo ?? menuImage(item.name) ?? "/design/dining.jpg"}
          returnTo="/admin/menu"
          canRemove={!!photo}
        />
      </div>
      {/* The form uses display: contents, so its fields and actions sit in the row grid. */}
      <form action={saveMenuItemAction} className="edit-row">
        <input type="hidden" name="id" value={item.id} />
        <input type="hidden" name="tab" value={tab} />
        <label className="edit-wide">
          {colLabel("Name", true)}
          <input name="name" required maxLength={80} defaultValue={item.name} />
        </label>
        <label>
          {colLabel("Section", true)}
          <select name="section" defaultValue={item.section}>
            {sections.map((s) => (
              <option key={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <label>
          {colLabel("Price (₱)", true)}
          <input name="price" type="number" required min={0} max={100000} step="0.01" defaultValue={item.price} />
        </label>
        <label className="menu-description-field">
          {colLabel("Description", true)}
          <input name="description" maxLength={500} defaultValue={item.description} />
        </label>
        <label className="edit-check">
          <input name="available" type="checkbox" defaultChecked={item.available} />
          {colLabel("Available", true)}
        </label>
        <div className="admin-item-actions">
          <DragHandle />
          <button className="button">Save</button>
          <ConfirmDeleteButton
            action={deleteMenuItemAction}
            label="Archive"
            title={`Archive ${item.name}?`}
            message="It leaves the menu, staff ordering and the website. Past orders still show it, and you can restore it from the Archived tab."
          />
        </div>
      </form>
    </div>
  );
}

function SectionRow({ section, tab }: { section?: MenuSection; tab: string }) {
  return (
    <form action={saveMenuSectionAction} className="edit-row">
      {section && <input type="hidden" name="id" value={section.id} />}
      <input type="hidden" name="tab" value={tab} />
      <label>
        {colLabel("Name", !!section)}
        <input name="name" required maxLength={40} defaultValue={section?.name} placeholder={section ? undefined : "New section name"} />
      </label>
      <label>
        {colLabel("Description", !!section)}
        <input name="description" maxLength={200} defaultValue={section?.description} placeholder="Shown on the dining pages" />
      </label>
      <div className="admin-item-actions">
        {section && <DragHandle />}
        <button className="button">{section ? "Save" : "Add section"}</button>
        {section && (
          <>
            <ConfirmDeleteButton
              action={deleteMenuSectionAction}
              title={`Delete the ${section.name} section?`}
              message="Only an empty section can be deleted. Any archived items in it move to the first section."
            />
          </>
        )}
      </div>
    </form>
  );
}

export default async function Menu({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string; tab?: string }>;
}) {
  await requireStaff(true);
  const [{ notice, error, tab: picked = "" }, menu, archived, sections, content] =
    await Promise.all([
      searchParams,
      getMenu(),
      getMenu(true),
      getMenuSections(),
      getSiteContent(),
    ]);
  const message = orderMessages[error ?? notice ?? ""];
  const showArchived = picked === ARCHIVED;
  const shown = sections.find((s) => s.name === picked)?.name;
  const tab = showArchived ? ARCHIVED : (shown ?? "");
  return (
    <>
      <p className="eyebrow">RESTAURANT</p>
      <h1>Menu</h1>
      <p className="intro">
        Prices, sections and order used for staff orders and the dining pages.
        Changing a price never alters orders already saved, and every change
        is recorded in the activity log. Drag a row by its ⠿ handle to
        reorder it.
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
        <AddItemForm sections={sections} tab={tab} />
      </AddCard>
      <AddCard title="Edit sections">
        <SectionCard
          title="Sections"
          count={sections.length}
          head={["Name", "Description", "Actions"]}
          cols="minmax(140px,1fr) minmax(200px,2fr) 250px"
        >
          <SortableRows
            ids={sections.map((s) => s.id)}
            names={sections.map((s) => s.name)}
            save={reorderMenuAction.bind(null, "section")}
            messages={orderMessages}
          >
            {sections.map((s) => (
              <SectionRow key={s.id} section={s} tab={tab} />
            ))}
          </SortableRows>
          <SectionRow tab={tab} />
        </SectionCard>
      </AddCard>
      <FilterTabs
        label="Menu sections"
        tabs={[
          {
            label: "All",
            count: menu.length,
            href: "/admin/menu",
            active: !tab,
          },
          ...sections.map((s) => ({
            label: s.name,
            count: menu.filter((m) => m.section === s.name).length,
            href: "/admin/menu?tab=" + encodeURIComponent(s.name),
            active: shown === s.name,
          })),
          {
            label: "Archived",
            count: archived.length,
            href: "/admin/menu?tab=" + ARCHIVED,
            active: showArchived,
          },
        ]}
      />
      {showArchived ? (
        <SectionCard
          title="Archived"
          count={archived.length}
          head={["Name", "Section", "Price", "Actions"]}
          cols="minmax(160px,1.5fr) minmax(120px,1fr) minmax(90px,.6fr) 260px"
        >
          {archived.map((m) => (
            <form key={m.id} action={restoreMenuItemAction} className="edit-row">
              <input type="hidden" name="id" value={m.id} />
              <input type="hidden" name="archived" value="1" />
              <input type="hidden" name="tab" value={ARCHIVED} />
              <span>{m.name}</span>
              <span>{m.section}</span>
              <span>{peso(m.price)}</span>
              <div className="admin-item-actions">
                <button className="button">Restore</button>
                {/* Past order lines point at the item, so only a never-ordered item can be deleted. */}
                {m.order_items?.[0]?.count ? (
                  <span className="subtle">On past orders, kept for history</span>
                ) : (
                  <ConfirmDeleteButton
                    action={deleteMenuItemAction}
                    label="Delete forever"
                    title={`Delete ${m.name} for good?`}
                    message="It was never ordered, so it can be removed completely. This can't be undone."
                  />
                )}
              </div>
            </form>
          ))}
        </SectionCard>
      ) : (
        sections
          .filter((s) => !shown || s.name === shown)
          .map((section) => {
            const items = menu.filter((m) => m.section === section.name);
            return (
              <SectionCard
                key={section.id}
                title={section.name}
                count={items.length}
                head={["Photo", "Name", "Section", "Price (₱)", "Description", "Available", "Actions"]}
                cols="96px minmax(140px,1.35fr) minmax(110px,.9fr) minmax(96px,.65fr) minmax(160px,1.5fr) auto minmax(230px,auto)"
              >
                <SortableRows
                  ids={items.map((m) => m.id)}
                  names={items.map((m) => m.name)}
                  save={reorderMenuAction.bind(null, "item")}
                  messages={orderMessages}
                >
                  {items.map((m) => (
                    <ItemForm
                      key={m.id}
                      item={m}
                      photo={itemPhoto(content, "menu", m.id)}
                      sections={sections}
                      tab={tab}
                    />
                  ))}
                </SortableRows>
              </SectionCard>
            );
          })
      )}
    </>
  );
}
