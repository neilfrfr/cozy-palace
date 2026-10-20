import Image from "next/image";
import { getDiningTables } from "@/lib/inventory/service";
import { isConfigured } from "@/lib/supabase/config";
import { SetupNotice } from "@/components/setup-notice";
export const dynamic = "force-dynamic";
export default async function Dining() {
  const configured = isConfigured();
  const tables = configured ? await getDiningTables() : [];
  return (
    <>
      <p className="eyebrow">COZY PALACE · DINING</p>
      <h1>A Place to Gather.</h1>
      <p className="intro">Explore our current restaurant seating.</p>
      <div className="dining-banner">
        <Image
          src="/design/dining.jpg"
          alt="Dining interior from the supplied design"
          fill
          loading="eager"
          sizes="100vw"
        />
      </div>
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
    </>
  );
}
