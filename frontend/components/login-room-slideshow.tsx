"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const rooms = [
  { name: "Garden Deluxe", image: "/design/rooms/garden-deluxe.jpg" },
  { name: "Family Room", image: "/design/rooms/family-room.jpg" },
  { name: "Palace Suite", image: "/design/rooms/palace-suite.jpg" },
];

export function LoginRoomSlideshow() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActive((current) => (current + 1) % rooms.length);
    }, 5000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <>
      {rooms.map((room, index) => (
        <Image
          key={room.name}
          className={`auth-room-image${index === active ? " active" : ""}`}
          src={room.image}
          alt=""
          fill
          sizes="(max-width: 900px) 0px, 50vw"
          priority={index === 0}
          aria-hidden="true"
        />
      ))}
      <div className="auth-photo-caption">
        <p>Beautiful stays. Memorable tables.</p>
        <p>{rooms[active].name}</p>
      </div>
    </>
  );
}
