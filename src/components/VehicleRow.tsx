import type { Vehicle, VehicleStatus } from "../types/Vehicle";
import { daysOnLot } from "../lib/dateUtils";

type Props = {
  vehicle: Vehicle;
  onMarkSoldPendingRemoval: (vehicle: Vehicle) => Promise<void>;
  onEdit: (vehicle: Vehicle) => void;
  isAdmin: boolean;
};

export default function VehicleRow({
  vehicle,
  onMarkSoldPendingRemoval,
  onEdit,
  isAdmin,
}: Props) {
  return (
    <tr>
      <td>{vehicle.vinLast8}</td>
      <td>{vehicle.year} {vehicle.make} {vehicle.model}</td>
      <td>
        <span className={`status-pill ${toStatusClass(vehicle.status)}`}>
          {vehicle.status}
        </span>
      </td>
      <td>{vehicle.lastLocation}</td>
      <td>
        <span className={daysOnLot(vehicle.dateAdded) > 30 ? "days-on-lot over-10" : ""}>
          {daysOnLot(vehicle.dateAdded)}d
        </span>
      </td>
      <td className="note-cell" title={vehicle.notes || "-"}>{vehicle.notes || "-"}</td>
      {isAdmin && (
        <td>
          <>
            <button
              type="button"
              className="access-button"
              onClick={() => onEdit(vehicle)}
            >
              Edit
            </button>
            <button
              type="button"
              className="delete-button"
              onClick={() => void onMarkSoldPendingRemoval(vehicle)}
              disabled={vehicle.status === "Sold Pending Removal" || vehicle.status === "Removed"}
            >
              Mark Sold Pending
            </button>
          </>
        </td>
      )}
    </tr>
  );
}

function toStatusClass(status: VehicleStatus): string {
  if (status === "Ready For Line!" || status === "On Display") return "ready";
  if (status === "Being Detailed") return "detail";
  if (status === "Sold Pending Removal" || status === "Removed") return "service";
  return "service";
}
