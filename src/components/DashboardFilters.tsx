import type { Dispatch, SetStateAction } from "react";
import type { VehicleStatus } from "../types/Vehicle";

type Props = {
  search: string;
  statusFilter: VehicleStatus | "All";
  makeFilter: string;
  modelFilter: string;
  allStatuses: Array<VehicleStatus | "All">;
  allMakes: string[];
  allModels: string[];
  isAdmin: boolean;
  isSaving: boolean;
  onSearchChange: Dispatch<SetStateAction<string>>;
  onStatusChange: Dispatch<SetStateAction<VehicleStatus | "All">>;
  onMakeChange: Dispatch<SetStateAction<string>>;
  onModelChange: Dispatch<SetStateAction<string>>;
  onClearAll: () => void;
  onCleanupRemoved: () => void;
};

export default function DashboardFilters({
  search,
  statusFilter,
  makeFilter,
  modelFilter,
  allStatuses,
  allMakes,
  allModels,
  isAdmin,
  isSaving,
  onSearchChange,
  onStatusChange,
  onMakeChange,
  onModelChange,
  onClearAll,
  onCleanupRemoved,
}: Props) {
  return (
    <>
      <div style={{ marginBottom: "1rem" }}>
        <button
          type="button"
          onClick={onClearAll}
          style={{ padding: "0.5rem 1rem", cursor: "pointer" }}
        >
          Clear All Filters
        </button>
        {isAdmin ? (
          <button
            type="button"
            onClick={onCleanupRemoved}
            disabled={isSaving}
            style={{ padding: "0.5rem 1rem", cursor: "pointer", marginLeft: "0.5rem" }}
          >
            {isSaving ? "Cleaning..." : "Cleanup Removed"}
          </button>
        ) : null}
      </div>

      <section className="toolbar" aria-label="Dashboard filters">
        <label style={{ marginBottom: "1.5rem" }}>
          Search VIN Last 8
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Example: AB12CD34"
            maxLength={8}
          />
        </label>

        <label>
          Filter by Status
          <select
            value={statusFilter}
            onChange={(event) => onStatusChange(event.target.value as VehicleStatus | "All")}
          >
            {allStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>

        <label>
          Filter by Make
          <select
            value={makeFilter}
            onChange={(event) => {
              onMakeChange(event.target.value);
              onModelChange("All");
            }}
          >
            {allMakes.map((make) => (
              <option key={make} value={make}>
                {make}
              </option>
            ))}
          </select>
        </label>

        <label>
          Filter by Model
          <select
            value={modelFilter}
            onChange={(event) => onModelChange(event.target.value)}
          >
            {allModels.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </label>
      </section>
    </>
  );
}
