import Image from "next/image";
import Link from "next/link";
import { isConfigured } from "@/lib/supabase/config";
import { getFullyBookedNights, getRooms } from "@/lib/reservations/service";
import { RoomTile } from "@/components/room-tile";
import { AvailabilitySearch } from "@/components/availability-search";
import { SetupNotice } from "@/components/setup-notice";
import { ContactDetails } from "@/components/contact-details";
import { getSiteContent, itemPhoto, photo, text } from "@/lib/site-content";
export const dynamic = "force-dynamic";
export default async function Home() {
  const configured = isConfigured();
  const contentLoad = getSiteContent();
  let rooms: Awaited<ReturnType<typeof getRooms>> = [];
  let failed = false;
  let bookedNights: string[] = [];
  if (configured) {
    const [loaded, nights] = await Promise.all([
      getRooms().catch(() => null),
      getFullyBookedNights(),
    ]);
    rooms = loaded ?? [];
    failed = !loaded;
    bookedNights = nights;
  }
  const content = await contentLoad;
  const hero = photo(content, "photo.hero");
  const dining = photo(content, "photo.dining");
  return (
    <div className="homepage">
      <section className="home-hero" aria-labelledby="hero-title">
        <Image
          src={hero}
          alt=""
          fill
          preload
          sizes="100vw"
          className="home-hero-image"
        />
        <div className="home-hero-copy">
          <p className="eyebrow">Cozy Palace Hotel and Restaurant</p>
          <h1 id="hero-title" className="pre-line">
            {text(content, "home.hero.title")}
          </h1>
          <p className="home-hero-lede">{text(content, "home.hero.lede")}</p>
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
          <h2>{text(content, "home.intro.title")}</h2>
          <p>{text(content, "home.intro.body")}</p>
          <Link className="button secondary" href="/about">
            About Cozy Palace
          </Link>
        </div>
        <div className="home-intro-photos">
          <div className="home-intro-photo">
            <Image
              src={hero}
              alt="Cozy Palace at dusk"
              fill
              sizes="(max-width: 760px) 50vw, 25vw"
              style={{ objectPosition: "30% center" }}
            />
          </div>
          <div className="home-intro-photo offset">
            <Image
              src={dining}
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
          <h2 id="rooms-title">{text(content, "home.rooms.title")}</h2>
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
              <RoomTile
                key={room.id}
                room={room}
                index={index}
                photo={itemPhoto(content, "room", room.room_types.id)}
              />
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
            src={dining}
            alt="Tables set in the Cozy Palace restaurant"
            fill
            sizes="(max-width: 760px) 100vw, 55vw"
          />
        </div>
        <div className="home-dining-copy">
          <p className="eyebrow">Dine with us</p>
          <h2 id="dining-title" className="pre-line">
            {text(content, "home.dining.title")}
          </h2>
          <p>{text(content, "home.dining.body")}</p>
          <Link className="button outline-light" href="/dining">
            Explore dining
          </Link>
        </div>
      </section>

      <section className="home-contact" aria-labelledby="contact-title">
        <p className="eyebrow">Contacts</p>
        <h2 id="contact-title">Find and reach us.</h2>
        <ContactDetails content={content} />
        <Link className="button secondary" href="/contact">
          Contact page
        </Link>
      </section>
    </div>
  );
}
