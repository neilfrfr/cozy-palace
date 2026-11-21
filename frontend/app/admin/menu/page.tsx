import { requireStaff } from "@/lib/auth/authorize";
import {
  deleteMenuItemAction,
  deleteMenuSectionAction,
  moveMenuDownAction,
  moveMenuUpAction,
  restoreMenuItemAction,
  saveMenuItemAction,
  saveMenuSectionAction,
} from "@/app/actions/orders";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { PhotoThumbnailUpload } from "@/components/photo-thumbnail-upload";
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

/** Up/down buttons; they submit the surrounding form's id. */
function MoveButtons({ name, first, last }: { name: string; first: boolean; last: boolean }) {
  return (
    <>
      <button className="button secondary" formAction={moveMenuUpAction} formNoValidate disabled={first} aria-label={`Move ${name} up`}>↑</button>
      <button className="button secondary" formAction={moveMenuDownAction} formNoValidate disabled={last} aria-label={`Move ${name} down`}>↓</button>
    </>
  );
}

function ItemForm({
  item,
  photo,
  sections,
  tab,
  first = false,
  last = false,
}: {
  item?: MenuRow;
  photo?: string;
  sections: MenuSection[];
  tab: string;
  first?: boolean;
  last?: boolean;
}) {
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
        <input type="hidden" name="tab" value={tab} />
        <label className="edit-wide">
          {colLabel("Name", compact)}
          <input name="name" required maxLength={80} defaultValue={item?.name} />
        </label>
        <label>
          {colLabel("Section", compact)}
          <select name="section" defaultValue={item?.section ?? (sections.find((s) => s.name === tab) ?? sections[0])?.name}>
            {sections.map((s) => (
              <option key={s.id}>{s.name}</option>
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
        <label className="edit-check">
          <input
            name="on_website"
            type="checkbox"
            defaultChecked={item?.on_website ?? true}
          />
          {colLabel("On website", compact)}
        </label>
        <div className="admin-item-actions">
          <button className="button">{item ? "Save" : "Add item"}</button>
          {item && (
            <>
              <MoveButtons name={item.name} first={first} last={last} />
              <ConfirmDeleteButton
                action={deleteMenuItemAction}
                label="Archive"
                title={`Archive ${item.name}?`}
                message="It leaves the menu, staff ordering and the website. Past orders still show it, and you can restore it from the Archived tab."
              />
            </>
          )}
        </div>
      </form>
    </div>
  );
}

function SectionRow({
  section,
  tab,
  first = false,
  last = false,
}: {
  section?: MenuSection;
  tab: string;
  first?: boolean;
  last?: boolean;
}) {
  return (
    <form action={saveMenuSectionAction} className="edit-row">
      {section && <input type="hidden" name="id" value={section.id} />}
      <input type="hidden" name="kind" value="section" />
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
        <button className="button">{section ? "Save" : "Add section"}</button>
        {section && (
          <>
            <MoveButtons name={section.name} first={first} last={last} />
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
        Untick <strong>On website</strong> to keep an item orderable by staff
        but off the public menu. Changing a price never alters orders already
        saved, and every change is recorded in the activity log.
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
          <ItemForm sections={sections} tab={tab} />
        </div>
      </AddCard>
      <AddCard title="Edit sections">
        <SectionCard
          title="Sections"
          count={sections.length}
          head={["Name", "Description", "Actions"]}
          cols="minmax(140px,1fr) minmax(200px,2fr) auto"
        >
          {sections.map((s, i) => (
            <SectionRow
              key={s.id}
              section={s}
              tab={tab}
              first={i === 0}
              last={i === sections.length - 1}
            />
          ))}
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
          cols="minmax(160px,1.5fr) minmax(120px,1fr) minmax(90px,.6fr) auto"
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
                <ConfirmDeleteButton
                  action={deleteMenuItemAction}
                  label="Delete forever"
                  title={`Delete ${m.name} for good?`}
                  message="This can't be undone. Items on past orders can't be deleted and stay archived."
                />
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
                head={["Photo", "Name", "Section", "Price (₱)", "Description", "Available", "On website", "Actions"]}
                cols="96px minmax(140px,1.35fr) minmax(110px,.9fr) minmax(96px,.65fr) minmax(160px,1.5fr) auto auto minmax(230px,auto)"
              >
                {items.map((m, i) => (
                  <ItemForm
                    key={m.id}
                    item={m}
                    photo={itemPhoto(content, "menu", m.id)}
                    sections={sections}
                    tab={tab}
                    first={i === 0}
                    last={i === items.length - 1}
                  />
                ))}
              </SectionCard>
            );
          })
      )}
    </>
  );
}
