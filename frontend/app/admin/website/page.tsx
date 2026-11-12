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
    <form action={uploadSitePhotoAction} className="inline-form">
      <input type="hidden" name="key" value={photoKey} />
      <Image
        src={src ?? "/design/hotel-hero.jpg"}
        alt={src ? name : ""}
        width={96}
        height={64}
        style={{ objectFit: "cover" }}
      />
      <label>
        {name}
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
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  await requireStaff(true);
  const [{ notice, error }, content, rooms, menu] = await Promise.all([
    searchParams,
    getSiteContent(),
    getAdminRooms(),
    getMenu(),
  ]);
  const types = [
    ...new Map(rooms.map((r) => [r.room_types.id, r.room_types])).values(),
  ];
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
      <h2>Text</h2>
      <form action={saveSiteTextAction} className="panel">
        {(Object.keys(siteText) as TextKey[]).map((key) => (
          <label key={key}>
            {siteText[key][0]}
            <textarea
              name={key}
              maxLength={2000}
              rows={2}
              defaultValue={text(content, key)}
            />
          </label>
        ))}
        <button className="button">Save text</button>
      </form>
      <h2>Site photos</h2>
      {(Object.keys(sitePhotos) as PhotoKey[]).map((key) => (
        <PhotoForm
          key={key}
          name={sitePhotos[key][0]}
          photoKey={key}
          src={photo(content, key)}
        />
      ))}
      <h2>Room photos</h2>
      {types.map(
        (t) =>
          t.id && (
            <PhotoForm
              key={t.id}
              name={t.name}
              photoKey={itemPhotoKey("room", t.id)}
              src={itemPhoto(content, "room", t.id) ?? roomPhoto(t.name)}
            />
          ),
      )}
      {!types.length && <p className="empty">No rooms have been added.</p>}
      <h2>Menu item photos</h2>
      {menu.map((m) => (
        <PhotoForm
          key={m.id}
          name={m.name}
          photoKey={itemPhotoKey("menu", m.id)}
          src={itemPhoto(content, "menu", m.id) ?? menuImage(m.name)}
        />
      ))}
      {!menu.length && <p className="empty">No menu items have been added.</p>}
    </>
  );
}
