import Image from "next/image";
import Link from "next/link";
import { isConfigured } from "@/lib/supabase/config";
import { getFullyBookedNights, getRooms } from "@/lib/reservations/service";
import { RoomTile } from "@/components/room-tile";
import { AvailabilitySearch } from "@/components/availability-search";
import { SetupNotice } from "@/components/setup-notice";
export const dynamic = "force-dynamic";
export default async function Home() {
  const configured = isConfigured();
  let rooms: Awaited<ReturnType<typeof getRooms>> = [];
  let failed = false;
  let bookedNights: string[] = [];
  if (configured) {
    try {
      rooms = await getRooms();
    } catch {
      failed = true;
    }
    bookedNights = await getFullyBookedNights();
  }
  return (
    <div className="homepage">
      <section className="home-hero" aria-labelledby="hero-title">
        <Image
          src="/design/hotel-hero.jpg"
          alt=""
          fill
          preload
          sizes="100vw"
          className="home-hero-image"
        />
        <div className="home-hero-copy">
          <p className="eyebrow">Cozy Palace Hotel and Restaurant</p>
          <h1 id="hero-title">
            Stay a little.
            <br />
            Savour a lot.
          </h1>
          <p className="home-hero-lede">
            Beautiful stays. Memorable tables. Your next escape starts here.
          </p>
          <div className="actions">
            <Link className="button gold" href="/rooms">
              Book a Stay
            </Link>
            <Link className="button outline-light" href="/dining">
              Explore dining
            </Link>
          </div>
        </div>
      </section>

      <section className="home-booking" aria-label="Check room availability">
        <AvailabilitySearch
          configured={configured}
          variant="bar"
          bookedNights={bookedNights}
        />
      </section>

      <section className="home-intro">
        <div className="home-intro-copy">
          <h2>Rooms to rest in. Tables to linger at.</h2>
          <p>
            Choose your dates, send a reservation request, and follow it from
            request to arrival. Then see where you can eat while you are here.
          </p>
          <Link className="button secondary" href="/about">
            About Cozy Palace
          </Link>
        </div>
        <div className="home-intro-photos">
          <div className="home-intro-photo">
            <Image
              src="/design/hotel-hero.jpg"
              alt="Cozy Palace at dusk"
              fill
              sizes="(max-width: 760px) 50vw, 25vw"
              style={{ objectPosition: "30% center" }}
            />
          </div>
          <div className="home-intro-photo offset">
            <Image
              src="/design/dining.jpg"
              alt="The Cozy Palace dining room"
              fill
              sizes="(max-width: 760px) 50vw, 25vw"
            />
          </div>
        </div>
      </section>

      <section className="home-rooms" aria-labelledby="rooms-title">
        <div className="home-section-head">
          <p className="eyebrow">Your next stay</p>
          <h2 id="rooms-title">A room to make your own.</h2>
        </div>
        <div className="home-section-notices">
          {!configured && <SetupNotice />}
          {failed && (
            <p className="notice error" role="alert">
              Rooms could not be loaded. <Link href="/rooms">Try again</Link>.
            </p>
          )}
          {configured && !failed && !rooms.length && (
            <p className="empty">No rooms are published right now.</p>
          )}
        </div>
        {rooms.length > 0 && (
          <div className="room-tiles">
            {rooms.slice(0, 4).map((room, index) => (
              <RoomTile key={room.id} room={room} index={index} />
            ))}
          </div>
        )}
        <div className="home-rooms-foot">
          <Link className="button secondary" href="/rooms">
            Explore rooms
          </Link>
          <p className="subtle">
            Prototype inventory and rates are fictional. Not a commercial
            booking offer.
          </p>
        </div>
      </section>

      <section className="home-dining" aria-labelledby="dining-title">
        <div className="home-dining-photo">
          <Image
            src="/design/dining.jpg"
            alt="Tables set in the Cozy Palace restaurant"
            fill
            sizes="(max-width: 760px) 100vw, 55vw"
          />
        </div>
        <div className="home-dining-copy">
          <p className="eyebrow">Dine with us</p>
          <h2 id="dining-title">
            Good food.
            <br />
            Great company.
          </h2>
          <p>
            See the restaurant seating before you arrive. Online table
            reservations are coming later.
          </p>
          <Link className="button outline-light" href="/dining">
            Explore dining
          </Link>
        </div>
      </section>
    </div>
  );
}
