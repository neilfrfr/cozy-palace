import Image from "next/image";
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
import { saveSiteTextAction, uploadSitePhotoAction } from "./actions";
import { FilterTabs } from "@/components/admin-ui";
export const dynamic = "force-dynamic";

function PhotoForm({
  name,
  photoKey,
  src,
}: {
  name: string;
  photoKey: string;
  src?: string;
}) {
  return (
    <form action={uploadSitePhotoAction} className="photo-card">
      <input type="hidden" name="key" value={photoKey} />
      <Image
        src={src ?? "/design/hotel-hero.jpg"}
        alt={src ? name : ""}
        width={240}
        height={150}
      />
      <label>
        <span className="photo-card-name">{name}</span>
        <input
          name="file"
          type="file"
          required
          accept="image/jpeg,image/png,image/webp"
        />
      </label>
      <button className="button">Upload</button>
    </form>
  );
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
      <FilterTabs
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
      />
      {/* One form for all text: saving sends every field, and a missing one would reset to the original. */}
      {!photos && (
        <form action={saveSiteTextAction} className="site-text">
          {[...new Set(textKeys.map(page))].map((group) => (
            <fieldset key={group} className="panel-card site-text-group">
              <legend>{group}</legend>
              {textKeys
                .filter((key) => page(key) === group)
                .map((key) => (
                  <label key={key}>
                    {siteText[key][0].split(": ").slice(1).join(": ") ||
                      siteText[key][0]}
                    <textarea
                      name={key}
                      maxLength={2000}
                      rows={2}
                      defaultValue={text(content, key)}
                    />
                  </label>
                ))}
            </fieldset>
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
          <section className="photo-section">
            <h2>Site photos</h2>
            <div className="photo-grid">
              {(Object.keys(sitePhotos) as PhotoKey[]).map((key) => (
                <PhotoForm
                  key={key}
                  name={sitePhotos[key][0]}
                  photoKey={key}
                  src={photo(content, key)}
                />
              ))}
            </div>
          </section>
          <section className="photo-section">
            <h2>Room photos</h2>
            <div className="photo-grid">
              {types.map(
                (t) =>
                  t.id && (
                    <PhotoForm
                      key={t.id}
                      name={t.name}
                      photoKey={itemPhotoKey("room", t.id)}
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
          <section className="photo-section">
            <h2>Menu item photos</h2>
            <div className="photo-grid">
              {menu.map((m) => (
                <PhotoForm
                  key={m.id}
                  name={m.name}
                  photoKey={itemPhotoKey("menu", m.id)}
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
    </>
  );
}
