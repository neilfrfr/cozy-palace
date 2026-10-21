const photos: Record<string, string> = {
  "Garden Deluxe": "/design/rooms/garden-deluxe.jpg",
  "Family Room": "/design/rooms/family-room.jpg",
  "Palace Suite": "/design/rooms/palace-suite.jpg",
};

/** Photo for a room type, or undefined when none has been supplied yet. */
export function roomPhoto(roomTypeName: string): string | undefined {
  return photos[roomTypeName];
}
