import Image from "next/image";
import { PageBanner } from "@/components/page-banner";
import { getDiningTables } from "@/lib/inventory/service";
import { isConfigured } from "@/lib/supabase/config";
import { SetupNotice } from "@/components/setup-notice";
import { menu } from "@/lib/menu";
export const dynamic = "force-dynamic";
export default async function Dining() {
  const configured = isConfigured();
  const tables = configured ? await getDiningTables() : [];
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
        <div className="floor-plans">
          <figure>
            <Image
              src="/design/dining/floor-plan.jpg"
              alt="Restaurant floor plan with the bar, booth tables, round tables and an outdoor patio"
              width={1024}
              height={683}
              sizes="(max-width: 760px) 100vw, 50vw"
            />
            <figcaption>Restaurant layout</figcaption>
          </figure>
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
        <h3 className="tables-title">Restaurant Tables</h3>
        <p className="notice">
          Online table reservations are not available yet. The operational state
          below does not indicate availability for a particular date or time.
        </p>
        {!configured && <SetupNotice />}
        <div className="grid">
          {tables.map((table) => (
            <article className="panel" key={table.id}>
              <p className="eyebrow">RESTAURANT</p>
              <h3>Table {table.table_number}</h3>
              <p>Up to {table.capacity} guests</p>
              <span className={"status " + table.operational_state}>
                {table.operational_state.replaceAll("_", " ")}
              </span>
            </article>
          ))}
        </div>
        {configured && !tables.length && (
          <p className="empty">No restaurant tables are listed yet.</p>
        )}
        <p className="subtle">
          Prototype seating records are fictional. Opening hours have not been
          published.
        </p>
      </section>
    </div>
  );
}
