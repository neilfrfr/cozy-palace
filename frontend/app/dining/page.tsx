import Link from "next/link";
import Image from "next/image";
import { PageBanner } from "@/components/page-banner";
import { getDiningTables } from "@/lib/inventory/service";
import { isConfigured } from "@/lib/supabase/config";
import { SetupNotice } from "@/components/setup-notice";
import { menu } from "@/lib/menu";
import { TablePicker } from "@/components/table-picker";
import { createClient } from "@/lib/supabase/server";
import { readRole } from "@/lib/auth/authorize";
import { businessDate } from "@/lib/operations/schema";
export const dynamic = "force-dynamic";
async function viewerRole() {
  const db = await createClient();
  const { data } = await db.auth.getUser();
  return data.user ? readRole(db, data.user.id) : null;
}
export default async function Dining() {
  const configured = isConfigured();
  const [tables, role] = configured
    ? await Promise.all([getDiningTables(), viewerRole()])
    : [[], null];
  return (
    <div className="public-page">
      <PageBanner
        eyebrow="Dining"
        title="A Place to Gather."
        intro="Explore our menu and restaurant seating."
        image="/design/dining.jpg"
      />
      <section className="section dining-menu" aria-labelledby="menu-title">
        <p className="eyebrow">Menu</p>
        <h2 id="menu-title">From Our Kitchen</h2>
        {menu.map((section) => (
          <div className="menu-section" key={section.title}>
            <h3>{section.title}</h3>
            <ul className="menu-grid">
              {section.items.map((dish) => (
                <li className="menu-card" key={dish.name}>
                  <div className="menu-photo">
                    <Image
                      src={dish.image}
                      alt={dish.name}
                      fill
                      sizes="(max-width: 760px) 50vw, 25vw"
                    />
                  </div>
                  <p>{dish.name}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
      <section className="section" aria-labelledby="seating-title">
        <p className="eyebrow">Table reservations</p>
        <h2 id="seating-title">Restaurant Seating</h2>
        <p className="intro">
          Pick a date, time and table. Each booking holds your table for two
          hours, and our staff confirm your request before you arrive.
        </p>
        {!configured && <SetupNotice />}
        <TablePicker
          tables={tables}
          today={businessDate()}
          instead={
            role === null ? (
              <Link className="button" href="/login?next=/dining">
                Sign in to book
              </Link>
            ) : role !== "customer" ? (
              <Link className="button" href="/staff/tables">
                Book walk-ins in Table Service
              </Link>
            ) : undefined
          }
        />
        <div className="floor-plans">
          <figure>
            <Image
              src="/design/dining/floor-plan-annotated.jpg"
              alt="Seating plan showing 40 indoor seats and 18 patio seats"
              width={735}
              height={490}
              sizes="(max-width: 760px) 100vw, 50vw"
            />
            <figcaption>
              Seating plan: 40 indoor seats and 18 on the patio, 58 in total.
            </figcaption>
          </figure>
        </div>
        {configured && !tables.length && (
          <p className="empty">No restaurant tables are listed yet.</p>
        )}
        <p className="subtle">
          Prototype seating records are fictional. Tables can be booked from
          11:00 to 14:00 and 17:00 to 21:00.
        </p>
      </section>
    </div>
  );
}
