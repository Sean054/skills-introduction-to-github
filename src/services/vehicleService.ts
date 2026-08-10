import { addDoc, collection, deleteDoc, doc, getDocs, updateDoc, writeBatch } from "firebase/firestore";
import { mockVehicles } from "../data/mockVehicles";
import { db, isFirebaseConfigured } from "../lib/firebase";
import type { ParkingSpot, Vehicle, VehicleLocation, VehicleStatus } from "../types/Vehicle";

export type NewVehicleInput = Omit<Vehicle, "id">;

function toYear(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : new Date().getFullYear();
  }
  return new Date().getFullYear();
}

function toLocation(value: unknown): VehicleLocation {
  // Map old zone names to new ones for backward compatibility
  const nameMap: Record<string, VehicleLocation> = {
    "Front Line": "Front Line",
    "Forester Line": "Forester Line",
    "Crosstrek Side": "Crosstrek Line",
    "Crosstrek Line": "Crosstrek Line",
    "Outback Side": "Outback Line",
    "Outback Line": "Outback Line",
    "Behind Dealership": "Forester Line",
    "Overflow Lot": "Overflow Lot",
    "Dirt Lot": "Dirt Lot",
  };
  if (typeof value === "string" && nameMap[value]) return nameMap[value];
  return "Front Line";
}

function toStatus(value: unknown): VehicleStatus {
  if (value === "Arrived") return "Arrived";
  if (value === "In Service") return "In Service";
  if (value === "Being Detailed") return "Being Detailed";
  if (value === "Ready For Line!") return "Ready For Line!";
  if (value === "On Display") return "On Display";
  if (value === "Sold Pending Removal") return "Sold Pending Removal";
  if (value === "Removed") return "Removed";
  return "In Service";
}

function normalizeVehicle(id: string, raw: Record<string, unknown>): Vehicle {
  return {
    id,
    year: toYear(raw.year),
    make: typeof raw.make === "string" && raw.make.trim() ? raw.make : "Unknown",
    model: typeof raw.model === "string" && raw.model.trim() ? raw.model : "Unknown",
    condition: raw.condition === "New" ? "New" : "Used",
    vinLast8: typeof raw.vinLast8 === "string" ? raw.vinLast8 : "UNKNOWN",

    blockedByVinLast8: Array.isArray(raw.blockedByVinLast8)
    ? raw.blockedByVinLast8.map((vin) => String(vin).toUpperCase())
    : [],

    vehicleType:
      raw.vehicleType === "Certified" || raw.vehicleType === "None"
        ? raw.vehicleType
        : "Wholesale",
    detailType: raw.detailType === "Wash Tub" ? "Wash Tub" : "Subaru Detail",
    hasPictures: typeof raw.hasPictures === "boolean" ? raw.hasPictures : false,
    status: toStatus(raw.status),
    dateAdded: typeof raw.dateAdded === "string" && raw.dateAdded ? raw.dateAdded : new Date().toISOString().slice(0, 10),
    notes: typeof raw.notes === "string" ? raw.notes : "",
    lastLocation: toLocation(raw.lastLocation ?? raw.location),
  };
}

export async function fetchVehicles(): Promise<Vehicle[]> {
  if (!isFirebaseConfigured) {
    return mockVehicles;
  }

  try {
    const snapshot = await getDocs(collection(db, "vehicles"));
    if (snapshot.empty) return [];

    return snapshot.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      return normalizeVehicle(doc.id, data);
    });
  } catch {
    // Safe fallback so the dashboard still works while Firebase is being configured.
    return mockVehicles;
  }
}

export async function createVehicle(input: NewVehicleInput): Promise<Vehicle> {
  if (!isFirebaseConfigured) {
    return {
      id: `local-${Date.now()}`,
      ...input,
    };
  }

  const docRef = await addDoc(collection(db, "vehicles"), input);
  return {
    id: docRef.id,
    ...input,
  };
}

export async function deleteVehicle(id: string): Promise<void> {
  if (!isFirebaseConfigured) {
    return;
  }

  await deleteDoc(doc(db, "vehicles", id));
}

export async function updateVehicle(id: string, input: NewVehicleInput): Promise<Vehicle> {
  if (!isFirebaseConfigured) {
    return { id, ...input };
  }

  await updateDoc(doc(db, "vehicles", id), input as Record<string, unknown>);
  return { id, ...input };
}

// Spot counts per zone — adjust these to match your actual lot
export const spotCounts: Record<VehicleLocation, number> = {
  "Front Line": 46,
  "Forester Line": 20,
  "Crosstrek Line": 20,
  "Outback Line": 30,
  "Overflow Lot": 40,
  "Dirt Lot": 10,
};

// Maps old zone names to new ones for backward compatibility
const legacyZoneMap: Record<string, VehicleLocation> = {
  "Crosstrek Side": "Crosstrek Line",
  "Outback Side": "Outback Line",
  "Behind Dealership": "Forester Line",
};

export async function fetchSpots(): Promise<ParkingSpot[]> {
  if (!isFirebaseConfigured) {
    // Return mock empty spots when Firebase isn't configured
    return Object.entries(spotCounts).flatMap(([lot, count]) =>
      Array.from({ length: count }, (_, i) => ({
        id: `mock-${lot}-${i + 1}`,
        lot: lot as VehicleLocation,
        spotNumber: i + 1,
        vinLast8: null,
      }))
    );
  }

  const snapshot = await getDocs(collection(db, "parkingSpots"));

  // Collect any docs that need their zone name updated in Firebase
  const migrationBatch = writeBatch(db);
  let needsMigration = false;

  const spots = snapshot.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    const rawLot = typeof data.lot === "string" ? data.lot : "Front Line";
    const mappedLot: VehicleLocation = legacyZoneMap[rawLot] ?? (rawLot as VehicleLocation);

    if (legacyZoneMap[rawLot]) {
      migrationBatch.update(doc(db, "parkingSpots", d.id), { lot: mappedLot });
      needsMigration = true;
    }

    return {
      id: d.id,
      lot: mappedLot,
      spotNumber: typeof data.spotNumber === "number" ? data.spotNumber : 0,
      vinLast8: typeof data.vinLast8 === "string" ? data.vinLast8 : null,
    };
  });

  if (needsMigration) {
    try { await migrationBatch.commit(); } catch { /* write may fail if not authenticated */ }
  }
  return spots;
}

export async function initializeSpots(): Promise<ParkingSpot[]> {
  if (!isFirebaseConfigured) return [];

  const batch = writeBatch(db);
  const created: ParkingSpot[] = [];

  for (const [lot, count] of Object.entries(spotCounts)) {
    for (let i = 1; i <= count; i++) {
      const ref = doc(collection(db, "parkingSpots"));
      const spot: Omit<ParkingSpot, "id"> = {
        lot: lot as VehicleLocation,
        spotNumber: i,
        vinLast8: null,
      };
      batch.set(ref, spot);
      created.push({ id: ref.id, ...spot });
    }
  }

  await batch.commit();
  return created;
}

export async function assignSpot(spotId: string, vinLast8: string): Promise<void> {
  if (!isFirebaseConfigured) return;
  await updateDoc(doc(db, "parkingSpots", spotId), { vinLast8: vinLast8.toUpperCase() });
}

export async function clearSpot(spotId: string): Promise<void> {
  if (!isFirebaseConfigured) return;
  await updateDoc(doc(db, "parkingSpots", spotId), { vinLast8: null });
}