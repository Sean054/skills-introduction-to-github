export function daysOnLot(dateAdded: string): number {
  const added = new Date(dateAdded).getTime();
  const today = new Date().getTime();
  return Math.floor((today - added) / (1000 * 60 * 60 * 24));
}
