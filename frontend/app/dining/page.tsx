import Image from "next/image";
import Link from "next/link";
import "./dining.css";
import { MenuCategories } from "./menu-categories";
import { PageBanner } from "@/components/page-banner";
import { getDiningTables } from "@/lib/inventory/service";
import { isConfigured } from "@/lib/supabase/config";
import { SetupNotice } from "@/components/setup-notice";
import { menu, menuImage, type MenuSection } from "@/lib/menu";
import { getMenu, menuSections, type MenuRow } from "@/lib/orders";
import {
  getSiteContent,
  itemPhoto,
  photo,
  text,
  type SiteContent,
} from "@/lib/site-content";
import { TablePicker } from "@/components/table-picker";
import { createClient } from "@/lib/supabase/server";
import { readRole } from "@/lib/auth/authorize";
import { businessDate } from "@/lib/operations/schema";
import { visitorBookingEnabled } from "@/lib/captcha";

export const dynamic = "force-dynamic";

async function viewerRole() {
  const db = await createClient();
  const { data } = await db.auth.getUser();
  return data.user ? readRole(db, data.user.id) : null;
}
/** Available dishes from the admin menu with their photos; the bundled menu until the database has items. */
function publicMenu(items: MenuRow[], content: SiteContent): MenuSection[] {
  if (!items.length) return menu;
  return menuSections
    .map((title) => ({
      title,
      items: items
        .filter((m) => m.available && m.section === title)
        .map((m) => ({
          name: m.name,
          image: itemPhoto(content, "menu", m.id) ?? menuImage(m.name) ?? "/design/dining.jpg",
        })),
    }))
    .filter((s) => s.items.length);
}

export default async function Dining() {
  const configured = isConfigured();
  const [tables, role, items, content] = configured
    ? await Promise.all([
        getDiningTables(),
        viewerRole(),
        getMenu(),
        getSiteContent(),
      ])
      : [[], null, [], {}];
  return (
    <div className="public-page dining-page">
      <PageBanner
        eyebrow="Dining at Cozy Palace"
        title={text(content, "dining.title")}
        intro={text(content, "dining.intro")}
        image={photo(content, "photo.dining")}
        position="center 40%"
      />

      <div className="dining-booking-wrap" id="table-reservations">
        <TablePicker
          tables={tables}
          today={businessDate()}
          visitor={role === null && visitorBookingEnabled()}
          deferAvailability
          instead={
            role === null ? (
              visitorBookingEnabled() ? undefined : (
                <Link className="button" href="/register?next=/dining">
                  Sign up to book
                </Link>
              )
            ) : role !== "customer" ? (
              <Link className="button" href="/staff/tables">
                Book walk-ins in Table Service
              </Link>
            ) : undefined
          }
        />
      </div>

      <section className="dining-intro" aria-label="Reservation details">
        {!configured && <SetupNotice />}
        {configured && !tables.length && (
          <p className="empty">No restaurant tables are listed yet.</p>
        )}
        <p className="subtle">
          Prototype seating records are fictional. Tables can be booked from
          11:00 to 14:00 and 17:00 to 21:00.
        </p>
      </section>

      <section className="dining-menu" aria-labelledby="menu-title">
        <div className="dining-menu-heading">
          <p className="eyebrow">A taste of Cozy Palace</p>
          <h2 id="menu-title">From Our Kitchen</h2>
        </div>
        <MenuCategories />
        <div className="menu-section" aria-label="Current available dishes">
          {publicMenu(items, content).map((section) => (
            <div key={section.title}>
              <h3>{section.title}</h3>
              <ul className="menu-grid">
                {section.items.map((dish) => (
                  <li className="menu-card" key={dish.name}>
                    <div className="menu-photo"><Image src={dish.image} alt={dish.name} fill sizes="(max-width: 760px) 50vw, 25vw" /></div>
                    <p>{dish.name}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
