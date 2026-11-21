import { requireStaff } from "@/lib/auth/authorize";
import { getAdminRooms } from "@/lib/inventory/service";
import { getMenu } from "@/lib/orders";
import { menuImage } from "@/lib/menu";
import { roomPhoto } from "@/lib/room-photos";
import {
  getSiteContent,
  itemPhoto,
  itemPhotoKey,
  photo,
  siteMessages,
  sitePhotos,
  siteText,
  text,
  type PhotoKey,
  type TextKey,
} from "@/lib/site-content";
import { saveSiteTextAction, restoreSiteDefaultsAction } from "./actions";
import { FilterTabs } from "@/components/admin-ui";
import { PhotoThumbnailUpload } from "@/components/photo-thumbnail-upload";
export const dynamic = "force-dynamic";

function PhotoForm({ name, photoKey, src, removable = false }: { name: string; photoKey: string; src?: string; removable?: boolean }) {
  return <article className="photo-card"><span className="photo-card-name">{name}</span><PhotoThumbnailUpload name={name} photoKey={photoKey} src={src ?? "/design/hotel-hero.jpg"} canRemove={removable} /></article>;
}
export default async function Website({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string; tab?: string }>;
}) {
  await requireStaff(true);
  const [{ notice, error, tab }, content, rooms, menu] = await Promise.all([
    searchParams,
    getSiteContent(),
    getAdminRooms(),
    getMenu(),
  ]);
  const types = [
    ...new Map(rooms.map((r) => [r.room_types.id, r.room_types])).values(),
  ];
  const photos = tab === "photos";
  const textKeys = Object.keys(siteText) as TextKey[];
  // "Contact: email" belongs to the Contact group.
  const page = (key: TextKey) => siteText[key][0].split(": ")[0];
  const railGroups = photos
    ? [
        { label: "Site photos", count: Object.keys(sitePhotos).length, id: "site-photos" },
        { label: "Room photos", count: types.length, id: "room-photos" },
        { label: "Menu item photos", count: menu.length, id: "menu-photos" },
      ]
    : [...new Set(textKeys.map(page))].map((label) => ({
        label,
        count: textKeys.filter((key) => page(key) === label).length,
        id: "website-" + label.toLowerCase(),
      }));
  const message =
    siteMessages[error ?? notice ?? ""] ??
    (error ? siteMessages.REQUEST_FAILED : null);
  return (
    <>
      <p className="eyebrow">PUBLIC WEBSITE</p>
      <h1>Website</h1>
      <p className="intro">
        Text and photos shown on the public pages. Clear a text field to go back
        to the original wording. Photos must be JPEG, PNG or WebP, up to 5 MB.
      </p>
      {message && (
        <p
          className={"notice" + (error ? " error" : "")}
          role={error ? "alert" : "status"}
        >
          {message}
        </p>
      )}
      <div className="website-editor-layout">
      <aside className="website-section-rail"><p className="eyebrow">PAGE SECTIONS</p>{railGroups.map((group) => <a key={group.id} href={"#" + group.id}>{group.label}<small>{group.count} {photos ? "photos" : "fields"}</small></a>)}</aside>
      <div className="website-editor-main">
      <div className="website-editor-toolbar"><FilterTabs
        label="Website sections"
        tabs={[
          {
            label: "Text",
            count: textKeys.length,
            href: "/admin/website",
            active: !photos,
          },
          {
            label: "Photos",
            count: Object.keys(sitePhotos).length + types.length + menu.length,
            href: "/admin/website?tab=photos",
            active: photos,
          },
        ]}
      />{photos && <form action={restoreSiteDefaultsAction}><button className="button secondary" type="submit">Restore photo defaults</button></form>}</div>
      {/* One form for all text: saving sends every field, and a missing one would reset to the original. */}
      {!photos && (
        <form action={saveSiteTextAction} className="site-text">
          {[...new Set(textKeys.map(page))].map((group) => (
            <section key={group} id={"website-" + group.toLowerCase()} className="panel-card site-text-group">
              <header className="site-text-group-heading"><h2>{group}</h2><span className="website-field-count">{textKeys.filter((key) => page(key) === group).length} fields</span></header>
              {textKeys
                .filter((key) => page(key) === group)
                .map((key) => (
                  <label key={key}>
                    {siteText[key][0].split(": ").slice(1).join(": ") ||
                      siteText[key][0]}
                    <textarea
                      name={key}
                      maxLength={2000}
                      rows={/text|subtitle|lede|hours/i.test(siteText[key][0]) ? 5 : 1}
                      defaultValue={text(content, key)}
                    />
                  </label>
                ))}
            </section>
          ))}
          <div className="site-text-save">
            <span className="subtle">
              Saves every text field. Clear one to restore the original wording.
            </span>
            <button className="button">Save text</button>
          </div>
        </form>
      )}
      {photos && (
        <>
          <section className="photo-section" id="site-photos">
            <h2>Site photos</h2>
            <div className="photo-grid">
              {(Object.keys(sitePhotos) as PhotoKey[]).map((key) => (
                <PhotoForm
                  key={key}
                  name={sitePhotos[key][0]}
                  photoKey={key}
                  src={photo(content, key)}
                  removable={!!content[key]}
                />
              ))}
            </div>
          </section>
          <section className="photo-section" id="room-photos">
            <h2>Room photos</h2>
            <div className="photo-grid">
              {types.map(
                (t) =>
                  t.id && (
                    <PhotoForm
                      key={t.id}
                      name={t.name}
                      photoKey={itemPhotoKey("room", t.id)}
                      removable={!!itemPhoto(content, "room", t.id)}
                      src={
                        itemPhoto(content, "room", t.id) ?? roomPhoto(t.name)
                      }
                    />
                  ),
              )}
            </div>
            {!types.length && (
              <p className="empty">No rooms have been added.</p>
            )}
          </section>
          <section className="photo-section" id="menu-photos">
            <h2>Menu item photos</h2>
            <div className="photo-grid">
              {menu.map((m) => (
                <PhotoForm
                  key={m.id}
                  name={m.name}
                  photoKey={itemPhotoKey("menu", m.id)}
                  removable={!!itemPhoto(content, "menu", m.id)}
                  src={itemPhoto(content, "menu", m.id) ?? menuImage(m.name)}
                />
              ))}
            </div>
            {!menu.length && (
              <p className="empty">No menu items have been added.</p>
            )}
          </section>
        </>
      )}
      </div></div>
    </>
  );
}
