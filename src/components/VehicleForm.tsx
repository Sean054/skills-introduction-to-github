import type { Dispatch, FormEvent, SetStateAction } from "react";
import type { VehicleLocation, VehicleStatus } from "../types/Vehicle";

export type VehicleFormState = {
  year: string;
  make: string;
  model: string;
  vinLast8: string;
  status: VehicleStatus;
  notes: string;
  lastLocation: VehicleLocation;
};

type Props = {
  editingVehicleId: string | null;
  formState: VehicleFormState;
  isSaving: boolean;
  saveError: string;
  saveSuccess: string;
  allStatuses: Array<VehicleStatus | "All">;
  allLocations: VehicleLocation[];
  suggestedMakes: string[];
  suggestedModels: string[];
  setFormState: Dispatch<SetStateAction<VehicleFormState>>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancelEdit: () => void;
  onBarcodeScanned: (vin: string) => void;
};

export default function VehicleForm({
  editingVehicleId,
  formState,
  isSaving,
  saveError,
  saveSuccess,
  allStatuses,
  allLocations,
  suggestedMakes,
  suggestedModels,
  setFormState,
  onSubmit,
  onCancelEdit,
  onBarcodeScanned,
}: Props) {
  return (
    <section className="create-vehicle" aria-label="Add a vehicle">
      <h2>{editingVehicleId ? "Edit Vehicle" : "Add Vehicle"}</h2>
      <form className="create-vehicle-form" onSubmit={onSubmit}>
        <label>
          Year
          <input
            type="text"
            inputMode="numeric"
            value={formState.year}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                year: event.target.value.replace(/\D/g, "").slice(0, 4),
              }))
            }
            placeholder="Example: 2024"
          />
        </label>

        <label>
          VIN Last 8 (or Full VIN)
          <input
            type="text"
            placeholder="Type or scan VIN here..."
            maxLength={17}
            value={formState.vinLast8}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                vinLast8: event.target.value,
              }))
            }
            onKeyDown={(event) => {
              if (event.key === "Enter" && formState.vinLast8.trim()) {
                const vin = formState.vinLast8.slice(-8).toUpperCase();
                onBarcodeScanned(vin);
              }
            }}
          />
        </label>

        <label>
          Make
          <input
            list="make-suggestions"
            value={formState.make}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                make: event.target.value,
              }))
            }
            placeholder="Example: Subaru"
          />
          <datalist id="make-suggestions">
            {suggestedMakes.map((make) => (
              <option key={make} value={make} />
            ))}
          </datalist>
        </label>

        <label>
          Model
          <input
            list="model-suggestions"
            value={formState.model}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                model: event.target.value,
              }))
            }
            placeholder="Example: Outback"
          />
          <datalist id="model-suggestions">
            {suggestedModels.map((model) => (
              <option key={model} value={model} />
            ))}
          </datalist>
        </label>

        <label>
          Status
          <select
            value={formState.status}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                status: event.target.value as VehicleStatus,
              }))
            }
          >
            {allStatuses
              .filter((status) => status !== "All")
              .map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
          </select>
        </label>

        <label>
          Last Location
          <select
            value={formState.lastLocation}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                lastLocation: event.target.value as VehicleLocation,
              }))
            }
          >
            {allLocations.map((location) => (
              <option key={location} value={location}>
                {location}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" disabled={isSaving}>
          {isSaving ? "Saving..." : editingVehicleId ? "Update Vehicle" : "Add Vehicle"}
        </button>

        {editingVehicleId ? (
          <button type="button" onClick={onCancelEdit}>
            Cancel Edit
          </button>
        ) : null}

        <label className="notes-row">
          Notes
          <textarea
            value={formState.notes}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                notes: event.target.value,
              }))
            }
            placeholder="Any notes about this vehicle (optional)"
            rows={2}
          />
        </label>
      </form>

      {saveError ? <p className="form-message error">{saveError}</p> : null}
      {saveSuccess ? <p className="form-message success">{saveSuccess}</p> : null}
    </section>
  );
}
