import Image from "next/image";
import Link from "next/link";
import { isConfigured } from "@/lib/supabase/config";
import { getRooms } from "@/lib/reservations/service";
import { RoomCard } from "@/components/room-card";
import { AvailabilitySearch } from "@/components/availability-search";
import { SetupNotice } from "@/components/setup-notice";
export const dynamic = "force-dynamic";
export default async function Home() {
  const configured = isConfigured();
  let rooms: Awaited<ReturnType<typeof getRooms>> = [];
  let failed = false;
  if (configured) {
    try {
      rooms = await getRooms();
    } catch {
      failed = true;
    }
  }
  return (
    <div className="homepage">
      <section className="figma-hero" aria-labelledby="hero-title">
        <Image
          src="/design/hotel-hero.jpg"
          alt=""
          fill
          preload
          sizes="100vw"
          className="hero-image"
        />
        <div className="hero-shade">
          <p className="eyebrow">Cozy Palace Hotel and Restaurant</p>
          <h1 id="hero-title">
            Stay a little.
            <br />
            Savour a lot.
          </h1>
          <div className="hero-copy">
            <p>
              Beautiful stays. Memorable tables.
              <br />
              Your next escape starts here.
            </p>
            <div className="actions">
              <Link className="button gold" href="/rooms">
                Book a Stay
              </Link>
              <Link className="button" href="/dining">
                Explore dining
              </Link>
            </div>
          </div>
        </div>
      </section>
      <div className="home-content">
        <section className="panel visit-search">
          <h2>Plan your visit</h2>
          <AvailabilitySearch configured={configured} />
        </section>
        <section className="section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">YOUR NEXT STAY</p>
              <h2>A room to make your own.</h2>
            </div>
            <Link href="/rooms">Explore rooms →</Link>
          </div>
          {!configured && <SetupNotice />}
          {failed && (
            <p className="notice error" role="alert">
              Rooms could not be loaded. <Link href="/rooms">Try again</Link>.
            </p>
          )}
          <div className="grid">
            {rooms.map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </div>
          {configured && !failed && !rooms.length && (
            <p className="empty">No rooms are published right now.</p>
          )}
          <p className="subtle">
            Prototype inventory and rates are fictional. Not a commercial
            booking offer.
          </p>
        </section>
        <section className="dining-feature">
          <div className="dining-photo">
            <Image
              src="/design/dining.jpg"
              alt="Dining interior from the supplied design"
              fill
              sizes="(max-width: 760px) 100vw, 50vw"
            />
          </div>
          <div className="dining-copy">
            <p className="eyebrow">DINE WITH US</p>
            <h2>
              Good food.
              <br />
              Great company.
            </h2>
            <p>Explore the restaurant seating in our current prototype.</p>
            <Link className="button" href="/dining">
              Explore dining
            </Link>
          </div>
        </section>
        <section className="home-cta">
          <h2>Ready for your next stay?</h2>
          <p>Choose a room and keep your reservation details in one place.</p>
          <div className="actions">
            <Link className="button gold" href="/rooms">
              Explore Rooms
            </Link>
            <Link className="button nav-account" href="/dining">
              Dining
            </Link>
            <Link className="button nav-account" href="/about">
              About
            </Link>
            <Link className="button nav-account" href="/contact">
              Contact
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
