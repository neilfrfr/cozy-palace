import { PageBanner } from "@/components/page-banner";
import { getDiningTables } from "@/lib/inventory/service";
import { isConfigured } from "@/lib/supabase/config";
import { SetupNotice } from "@/components/setup-notice";
export const dynamic = "force-dynamic";
export default async function Dining() {
  const configured = isConfigured();
  const tables = configured ? await getDiningTables() : [];
  return (
    <div className="public-page">
      <PageBanner
        eyebrow="Dining"
        title="A Place to Gather."
        intro="Explore our current restaurant seating."
        image="/design/dining.jpg"
      />
      <section className="section">
        <h2>Restaurant Tables</h2>
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
          Prototype seating records are fictional. Menu and opening hours have
          not been published.
        </p>
      </section>
    </div>
  );
}
