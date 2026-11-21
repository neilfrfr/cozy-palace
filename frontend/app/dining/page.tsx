import Link from "next/link";
import "./dining.css";
import { MenuCategories } from "./menu-categories";
import { PageBanner } from "@/components/page-banner";
import { getDiningTables } from "@/lib/inventory/service";
import { isConfigured } from "@/lib/supabase/config";
import { SetupNotice } from "@/components/setup-notice";
import { getSiteContent, photo, text } from "@/lib/site-content";
import { TablePicker } from "@/components/table-picker";
import { createClient } from "@/lib/supabase/server";
import { readRole } from "@/lib/auth/authorize";
import { businessDate } from "@/lib/operations/schema";
import { visitorBookingEnabled } from "@/lib/captcha";
import { getMenu } from "@/lib/orders";
import { publicDiningMenu } from "@/lib/public-dining-menu";
import { diningMenu } from "./menu-data";

export const dynamic = "force-dynamic";

async function viewerRole() {
  const db = await createClient();
  const { data } = await db.auth.getUser();
  return data.user ? readRole(db, data.user.id) : null;
}
export default async function Dining() {
  const configured = isConfigured();
  const [tables, role, content, menuRows] = configured
    ? await Promise.all([
        getDiningTables(),
        viewerRole(),
        getSiteContent(),
        getMenu(),
      ])
    : [[], null, {}, []];
  const categories = configured
    ? publicDiningMenu(menuRows, content)
    : diningMenu;
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
        {categories.length ? (
          <MenuCategories categories={categories} />
        ) : (
          <p className="empty">No menu items are currently available.</p>
        )}
      </section>
    </div>
  );
}
