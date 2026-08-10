export type VehicleType = "Wholesale" | "Certified" | "None";

export type DetailType = "Subaru Detail" | "Wash Tub";

export type VehicleStatus =
  | "Arrived"
  | "In Service"
  | "Being Detailed"
  | "Ready For Line!"
  | "On Display"
  | "Sold Pending Removal"
  | "Removed";

export type VehicleCondition = "New" | "Used";

export interface Vehicle {
    id: string;
    year: number;
    make: string;
    model: string;
    condition: VehicleCondition;
    vinLast8: string;
    blockedByVinLast8: string[];
    vehicleType: VehicleType;
    detailType: DetailType;
    hasPictures: boolean;
    status: VehicleStatus;
    dateAdded: string;   // ISO date string e.g. "2026-06-15"
    notes: string;
    lastLocation: VehicleLocation;  // last known location on the lot
}

export type VehicleLocation = 
| "Front Line"
| "Forester Line"
| "Crosstrek Line"
| "Outback Line"
| "Overflow Lot"
| "Dirt Lot";

export interface ParkingSpot {
  id: string;
  lot: VehicleLocation;
  spotNumber: number;
  vinLast8: string | null;
}
