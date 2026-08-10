import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";
import { createVehicle, deleteVehicle, fetchVehicles, updateVehicle } from "./services/vehicleService";
import type { NewVehicleInput } from "./services/vehicleService";
import type { DetailType, Vehicle, VehicleCondition, VehicleLocation, VehicleStatus, VehicleType } from "./types/Vehicle";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import type { AuthError } from "firebase/auth";
import { auth } from "./lib/firebase";
import DashboardFilters from "./components/DashboardFilters";
import StatCard from "./components/Statcard";
import VehicleRow from "./components/VehicleRow";
import VehicleForm, { type VehicleFormState } from "./components/VehicleForm";
import {
  isSoldCell,
  normalizeHeader,
  normalizeVin,
  parseBooleanCell,
  parseDetailType,
  parseInventoryFile,
  parseVehicleCondition,
  parseVehicleLocation,
  parseVehicleStatus,
  parseVehicleType,
  suggestedMakes,
  suggestedModels,
} from "./lib/inventoryImport";

const allStatuses: Array<VehicleStatus | "All"> = [
  "All",
  "Arrived",
  "In Service",
  "Being Detailed",
  "Ready For Line!",
  "Sold Pending Removal",
  "Removed",
];

const allLocations: VehicleLocation[] = [
  "Front Line",
  "Forester Line",
  "Crosstrek Line",
  "Outback Line",
  "Overflow Lot",
  "Dirt Lot",
];
const RISKY_REMOVAL_THRESHOLD = 10;
const SHOW_IMPORT_SYNC_SECTION = false;

function App() {
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [authErrorMessage, setAuthErrorMessage] = useState("");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importFileName, setImportFileName] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [removeMissingOnSync, setRemoveMissingOnSync] = useState(false);
  const [importPreview, setImportPreview] = useState<{
    incomingCount: number;
    addCount: number;
    toAdd: NewVehicleInput[];
    removeCount: number;
    toRemove: Vehicle[];
  } | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | "All">("All");
  const [makeFilter, setMakeFilter] = useState("All");
  const [modelFilter, setModelFilter] = useState("All");
  const [formState, setFormState] = useState<VehicleFormState>({
    year: "",
    make: "",
    model: "",
    vinLast8: "",
    status: "In Service",
    notes: "",
    lastLocation: "Front Line",
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAdmin(user !== null);
      if (user) {
        setAuthErrorMessage("");
        setLoginPassword("");
      }
    });
    return unsubscribe;
  }, []);

  const handleLogin = async () => {
    if (!loginEmail.trim() || !loginPassword) {
      setAuthErrorMessage("Enter email and password.");
      return;
    }

    setAuthErrorMessage("");

    try {
      await signInWithEmailAndPassword(auth, loginEmail.trim(), loginPassword);
      setLoginPassword("");
    } catch (error) {
      const authError = error as AuthError;
      setAuthErrorMessage(`Login failed: ${authError.code}`);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setLoginPassword("");
  };

  useEffect(() => {
    const loadVehicles = async () => {
      const loadedVehicles = await fetchVehicles();
      setVehicles(loadedVehicles);
      setIsLoading(false);
    };
    void loadVehicles();
  }, []);

  // Build a unique sorted list of makes from actual vehicle data.
  // "All" is always first so the filter shows every vehicle by default.
  const allMakes = useMemo(() => {
    const unique = [...new Set(vehicles.map((v) => v.make))].sort();
    return ["All", ...unique];
  }, [vehicles]);

  // Same idea for models — but only shows models that belong to the selected make.
  // If make is "All", show every model.
  const allModels = useMemo(() => {
    const source =
      makeFilter === "All"
        ? vehicles
        : vehicles.filter((v) => v.make === makeFilter);
    const unique = [...new Set(source.map((v) => v.model))].sort();
    return ["All", ...unique];
  }, [vehicles, makeFilter]);

  const filteredVehicles = useMemo(() => {
    return vehicles.filter((vehicle) => {
      const matchesVin = vehicle.vinLast8
        .toLowerCase()
        .includes(search.trim().toLowerCase());
      const matchesStatus =
        statusFilter === "All" ? true : vehicle.status === statusFilter;
      const matchesMake =
        makeFilter === "All" ? true : vehicle.make === makeFilter;
      const matchesModel =
        modelFilter === "All" ? true : vehicle.model === modelFilter;

      return matchesVin && matchesStatus && matchesMake && matchesModel;
    });
  }, [vehicles, search, statusFilter, makeFilter, modelFilter]);

  const statusCounts = useMemo(() => {
    const counts = {
      total: vehicles.length,
      inService: 0,
      beingDetailed: 0,
      readyForLine: 0,
    };

    for (const vehicle of vehicles) {
      if (vehicle.status === "In Service") counts.inService += 1;
      if (vehicle.status === "Being Detailed") counts.beingDetailed += 1;
      if (vehicle.status === "Ready For Line!") counts.readyForLine += 1;
    }

    return counts;
  }, [vehicles]);

  const handleStartEdit = (vehicle: Vehicle) => {
    setEditingVehicleId(vehicle.id);
    setFormState({
      year: String(vehicle.year),
      make: vehicle.make,
      model: vehicle.model,
      vinLast8: vehicle.vinLast8,
      status: vehicle.status,
      notes: vehicle.notes,
      lastLocation: vehicle.lastLocation,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelEdit = () => {
    setEditingVehicleId(null);
    setFormState({
      year: "",
      make: "Subaru",
      model: "",
      vinLast8: "",
      status: "In Service",
      notes: "",
      lastLocation: "Front Line",
    });
  };

  const handleCreateVehicle = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaveError("");
    setSaveSuccess("");

    const year = Number(formState.year);
    const currentYear = new Date().getFullYear() + 1;
    if (!Number.isInteger(year) || year < 1900 || year > currentYear) {
      setSaveError("Year must be a valid 4-digit year.");
      return;
    }

    if (!formState.make.trim()) {
      setSaveError("Make is required.");
      return;
    }

    if (!formState.model.trim()) {
      setSaveError("Model is required.");
      return;
    }

    if (!formState.vinLast8.trim()) {
      setSaveError("VIN Last 8 is required.");
      return;
    }

    const normalizedVin = formState.vinLast8.trim().toUpperCase();
    
    // Check for duplicate VIN (only when adding new vehicles, not when editing)
    if (!editingVehicleId) {
      const isDuplicate = vehicles.some((v) => v.vinLast8 === normalizedVin);
      if (isDuplicate) {
        setSaveError(`VIN ${normalizedVin} already exists in the system.`);
        return;
      }
    }

    const payload = {
      year,
      make: formState.make.trim(),
      model: formState.model.trim(),
      condition: "Used" as VehicleCondition,
      vinLast8: normalizedVin,
      blockedByVinLast8: [],
      vehicleType: "None" as VehicleType,
      detailType: "Subaru Detail" as DetailType,
      hasPictures: false,
      status: formState.status,
      dateAdded: editingVehicleId
        ? vehicles.find((v) => v.id === editingVehicleId)?.dateAdded ?? new Date().toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      notes: formState.notes.trim(),
      lastLocation: formState.lastLocation,
    };

    setIsSaving(true);
    try {
      if (editingVehicleId) {
        const updated = await updateVehicle(editingVehicleId, payload);
        setVehicles((current) =>
          current.map((vehicle) =>
            vehicle.id === editingVehicleId ? updated : vehicle
          )
        );
        setSaveSuccess("Vehicle updated.");
      } else {
        const created = await createVehicle(payload);
        setVehicles((current) => [created, ...current]);
        setSaveSuccess("Vehicle added.");
      }

      handleCancelEdit();
    } catch {
      setSaveError("Could not save vehicle. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkSoldPendingRemoval = async (vehicle: Vehicle) => {
    if (vehicle.status === "Sold Pending Removal" || vehicle.status === "Removed") {
      return;
    }

    const confirmed = window.confirm(
      `Mark ${vehicle.vinLast8} as Sold Pending Removal?`
    );

    if (!confirmed) return;

    try {
      const payload: NewVehicleInput = {
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        condition: vehicle.condition,
        vinLast8: vehicle.vinLast8,
        blockedByVinLast8: vehicle.blockedByVinLast8,
        vehicleType: vehicle.vehicleType,
        detailType: vehicle.detailType,
        hasPictures: vehicle.hasPictures,
        status: "Sold Pending Removal",
        dateAdded: vehicle.dateAdded,
        notes: vehicle.notes,
        lastLocation: vehicle.lastLocation,
      };

      const updated = await updateVehicle(vehicle.id, payload);
      setVehicles((current) =>
        current.map((item) => (item.id === vehicle.id ? updated : item))
      );
      setSaveError("");
      setSaveSuccess(`Vehicle ${vehicle.vinLast8} marked Sold Pending Removal.`);
    } catch {
      setSaveError("Could not update status. Please try again.");
    }
  };

  const handleCleanupRemovedVehicles = async () => {
    const removedVehicles = vehicles.filter((vehicle) => vehicle.status === "Removed");
    if (removedVehicles.length === 0) {
      setSaveError("");
      setSaveSuccess("No vehicles are marked as Removed.");
      return;
    }

    const confirmed = window.confirm(
      `Permanently delete ${removedVehicles.length} Removed vehicle(s)? This cannot be undone.`
    );

    if (!confirmed) return;

    setIsSaving(true);
    try {
      for (const vehicle of removedVehicles) {
        await deleteVehicle(vehicle.id);
      }

      setVehicles((current) => current.filter((vehicle) => vehicle.status !== "Removed"));
      setSaveError("");
      setSaveSuccess(`Deleted ${removedVehicles.length} Removed vehicle(s).`);
    } catch {
      setSaveError("Could not complete cleanup. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleBarcodeScanned = async (vin: string) => {
    try {
      const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${vin}?format=json`);
      const data = await response.json() as { Results: Array<{ Variable: string; Value: string }> };

      if (data.Results.length === 0) {
        alert("VIN not found. Try manually entering.");
        return;
      }

      // Extract data from NHTSA results
      const results = data.Results.reduce((acc: Record<string, string>, item: { Variable: string; Value: string }) => {
        acc[item.Variable] = item.Value;
        return acc;
      }, {});

      // Auto-populate form fields based on decoded VIN data
      setFormState((current) => ({
        ...current,
        year: results["Model Year"] || "",
        make: results["Make"] || "",
        model: results["Model"] || "",
        vinLast8: vin.slice(-8).toUpperCase(),
      }));
    } catch (error) {
      alert("Could not decode VIN. Try manually entering.");
    }
  };

  const handleImportInventoryFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportPreview(null);
    setImportFileName(file.name);
    setSaveError("");
    setSaveSuccess("");

    try {
      const rows = await parseInventoryFile(file);
      if (rows.length < 2) {
        throw new Error("The inventory file appears to be empty.");
      }

      const headers = rows[0].map((header) => normalizeHeader(header));
      const getIndex = (candidates: string[]) => headers.findIndex((header) => candidates.includes(header));

      const vinColumnIndex = getIndex([
        "vin",
        "vinlast8",
        "vinnumber",
        "vehiclevin",
        "fullvin",
        "serialnumber",
      ]);
      const yearColumnIndex = getIndex(["year", "modelyear", "modelyr"]);
      const makeColumnIndex = getIndex(["make", "manufacturer"]);
      const modelColumnIndex = getIndex(["model", "modelname"]);
      const conditionColumnIndex = getIndex(["condition", "vehiclecondition", "newused"]);
      const typeColumnIndex = getIndex(["vehicletype", "type", "inventorytype"]);
      const detailColumnIndex = getIndex(["detailtype", "detail"]);
      const statusColumnIndex = getIndex(["status", "vehiclestatus"]);
      const locationColumnIndex = getIndex(["location", "lot", "lotlocation"]);
      const notesColumnIndex = getIndex(["notes", "note"]);
      const picturesColumnIndex = getIndex(["haspictures", "pictures", "imagecount"]);
      const soldColumnIndex = getIndex(["issold", "sold", "soldflag"]);

      const incomingVins = new Set<string>();
      const existingVins = new Set(vehicles.map((vehicle) => normalizeVin(vehicle.vinLast8)));
      const addedVins = new Set<string>();
      const toAdd: NewVehicleInput[] = [];
      const startRow = vinColumnIndex >= 0 ? 1 : 0;
      const today = new Date().toISOString().slice(0, 10);

      for (let rowIndex = startRow; rowIndex < rows.length; rowIndex += 1) {
        const row = rows[rowIndex];
        if (soldColumnIndex >= 0 && isSoldCell(row[soldColumnIndex] ?? "")) {
          continue;
        }

        const vinValue = vinColumnIndex >= 0 ? row[vinColumnIndex] ?? "" : row[0] ?? "";
        const normalized = normalizeVin(vinValue);
        if (normalized) {
          incomingVins.add(normalized);

          if (!existingVins.has(normalized) && !addedVins.has(normalized)) {
            const parsedYear = Number(yearColumnIndex >= 0 ? row[yearColumnIndex] ?? "" : "");
            const fallbackYear = new Date().getFullYear();
            const year = Number.isInteger(parsedYear) && parsedYear >= 1900 && parsedYear <= fallbackYear + 1
              ? parsedYear
              : fallbackYear;

            const make = (makeColumnIndex >= 0 ? row[makeColumnIndex] ?? "" : "").trim() || "Unknown";
            const model = (modelColumnIndex >= 0 ? row[modelColumnIndex] ?? "" : "").trim() || "Unknown";
            const condition = parseVehicleCondition(conditionColumnIndex >= 0 ? row[conditionColumnIndex] ?? "" : "");
            const vehicleType = parseVehicleType(typeColumnIndex >= 0 ? row[typeColumnIndex] ?? "" : "");
            const detailType = parseDetailType(detailColumnIndex >= 0 ? row[detailColumnIndex] ?? "" : "");
            const status = parseVehicleStatus(statusColumnIndex >= 0 ? row[statusColumnIndex] ?? "" : "");
            const lastLocation = parseVehicleLocation(locationColumnIndex >= 0 ? row[locationColumnIndex] ?? "" : "");
            const notes = (notesColumnIndex >= 0 ? row[notesColumnIndex] ?? "" : "").trim();

            let hasPictures = false;
            if (picturesColumnIndex >= 0) {
              const value = row[picturesColumnIndex] ?? "";
              hasPictures = /^\d+$/.test(value.trim()) ? Number(value) > 0 : parseBooleanCell(value);
            }

            toAdd.push({
              year,
              make,
              model,
              condition,
              vinLast8: normalized,
              blockedByVinLast8: [],
              vehicleType,
              detailType,
              hasPictures,
              status,
              dateAdded: today,
              notes,
              lastLocation,
            });

            addedVins.add(normalized);
          }
        }
      }

      if (incomingVins.size === 0) {
        throw new Error("No VINs were found in the selected file.");
      }

      const toRemove = vehicles.filter((vehicle) => {
        const currentKey = normalizeVin(vehicle.vinLast8);
        return !incomingVins.has(currentKey);
      });

      setImportPreview({
        incomingCount: incomingVins.size,
        addCount: toAdd.length,
        toAdd,
        removeCount: toRemove.length,
        toRemove,
      });
      setSaveSuccess(`Preview ready. ${toAdd.length} to add, ${toRemove.length} missing from file.`);
    } catch {
      setSaveError("Could not read the file. Please use a CSV or Excel export with a VIN column.");
    } finally {
      event.target.value = "";
    }
  };

  const handleApplyImportSync = async () => {
    if (!importPreview) return;

    const isRiskyImport =
      removeMissingOnSync &&
      importPreview.addCount === 0 &&
      importPreview.removeCount >= RISKY_REMOVAL_THRESHOLD;

    if (isRiskyImport) {
      setSaveError(
        `Safety stop: this file adds 0 vehicles and would remove ${importPreview.removeCount}. Review the file before applying.`
      );
      return;
    }

    const removalMessage = removeMissingOnSync ? ` and remove ${importPreview.removeCount}` : "";
    const confirmed = window.confirm(
      `Add ${importPreview.addCount} vehicle(s)${removalMessage}?`
    );

    if (!confirmed) return;

    if (removeMissingOnSync && importPreview.removeCount === vehicles.length && vehicles.length > 0) {
      const fullDeleteConfirmed = window.confirm(
        "Warning: this will remove every current vehicle. Continue?"
      );
      if (!fullDeleteConfirmed) return;
    }

    setIsImporting(true);
    setSaveError("");
    setSaveSuccess("");

    try {
      for (const newVehicle of importPreview.toAdd) {
        await createVehicle(newVehicle);
      }

      if (removeMissingOnSync) {
        for (const vehicle of importPreview.toRemove) {
          await deleteVehicle(vehicle.id);
        }
      }

      const refreshedVehicles = await fetchVehicles();
      setVehicles(refreshedVehicles);
      setImportPreview(null);
      const removedText = removeMissingOnSync ? ` Removed ${importPreview.removeCount}.` : "";
      setSaveSuccess(`Sync complete. Added ${importPreview.addCount}.${removedText}`);
    } catch {
      setSaveError("Inventory sync failed. Please try again.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="page-shell">
      <header className="hero">
        <p className="eyebrow">Dealership Operations</p>
        <h1>Subaru Vehicle Inventory Dashboard</h1>
        <p className="subtitle"></p>
        {isAdmin ? (
          <button type="button" onClick={handleLogout}>Sign Out</button>
        ) : (
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="email"
              placeholder="Admin email"
              value={loginEmail}
              onChange={(event) => setLoginEmail(event.target.value)}
              style={{ minWidth: "220px" }}
            />
            <input
              type="password"
              placeholder="Password"
              value={loginPassword}
              onChange={(event) => setLoginPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleLogin();
                }
              }}
              style={{ minWidth: "180px" }}
            />
            <button type="button" onClick={() => void handleLogin()}>Admin Login</button>
          </div>
        )}
        {!isAdmin && authErrorMessage ? (
          <p className="form-message error" style={{ marginTop: "0.5rem" }}>
            {authErrorMessage}
          </p>
        ) : null}
      </header>

      <section className="stat-grid" aria-label="Inventory summary cards">
        <StatCard label="Total" value={statusCounts.total} tone="total" />
        <StatCard
          label="In Service"
          value={statusCounts.inService}
          tone="service"
        />
        <StatCard
          label="Being Detailed"
          value={statusCounts.beingDetailed}
          tone="detail"
        />
        <StatCard
          label="Ready For Line"
          value={statusCounts.readyForLine}
          tone="ready"
        />
      </section>

      {isAdmin ? (
        <VehicleForm
          editingVehicleId={editingVehicleId}
          formState={formState}
          isSaving={isSaving}
          saveError={saveError}
          saveSuccess={saveSuccess}
          allStatuses={allStatuses}
          allLocations={allLocations}
          suggestedMakes={suggestedMakes}
          suggestedModels={suggestedModels}
          setFormState={setFormState}
          onSubmit={handleCreateVehicle}
          onCancelEdit={handleCancelEdit}
          onBarcodeScanned={handleBarcodeScanned}
        />
      ) : null}

      {isAdmin && SHOW_IMPORT_SYNC_SECTION ? (
        <section className="create-vehicle" aria-label="Inventory sync" style={{ marginTop: "1rem" }}>
          <h2>Admin Inventory Sync</h2>
          <p style={{ marginTop: 0, color: "var(--muted)" }}>
            Upload a CSV or Excel export from your source inventory. This can add missing vehicles back into your dashboard.
          </p>
          <label htmlFor="inventory-sync-upload" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontWeight: 600 }}>
            Upload inventory file
            <div>
              <span
                style={{
                  display: "inline-block",
                  padding: "0.7rem 1rem",
                  borderRadius: "0.7rem",
                  background: "var(--accent)",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                  Choose CSV or Excel File
              </span>
            </div>
            <input
              id="inventory-sync-upload"
              type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={handleImportInventoryFile}
              style={{ position: "absolute", left: "-9999px" }}
            />
              {importFileName ? <span style={{ fontWeight: 400, color: "var(--muted)" }}>Selected file: {importFileName}</span> : null}
          </label>

          <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontWeight: 400, marginTop: "0.5rem" }}>
            <input
              type="checkbox"
              checked={removeMissingOnSync}
              onChange={(event) => setRemoveMissingOnSync(event.target.checked)}
            />
            Also remove vehicles that are missing from the file (destructive)
          </label>

          {importPreview ? (
            <div style={{ marginTop: "0.75rem", padding: "0.9rem 1rem", border: "1px solid var(--line)", borderRadius: "0.75rem", background: "var(--warning-soft)" }}>
              <strong>{importPreview.addCount} vehicle(s) will be added</strong>
              <p style={{ margin: "0.35rem 0 0" }}>
                Imported {importPreview.incomingCount} VIN(s) from the file.
              </p>
              <p style={{ margin: "0.35rem 0 0", fontSize: "0.9rem" }}>
                {importPreview.removeCount} current vehicle(s) are missing from the file.
              </p>
              {importPreview.toAdd.length > 0 ? (
                <p style={{ margin: "0.35rem 0 0", fontSize: "0.9rem" }}>
                  Example adds: {importPreview.toAdd.slice(0, 5).map((vehicle) => vehicle.vinLast8).join(", ")}
                </p>
              ) : null}
              {removeMissingOnSync && importPreview.toRemove.length > 0 ? (
                <p style={{ margin: "0.35rem 0 0", fontSize: "0.9rem" }}>
                  Example removals: {importPreview.toRemove.slice(0, 5).map((vehicle) => vehicle.vinLast8).join(", ")}
                </p>
              ) : null}
              {removeMissingOnSync && importPreview.addCount === 0 && importPreview.removeCount >= RISKY_REMOVAL_THRESHOLD ? (
                <p style={{ margin: "0.35rem 0 0", color: "var(--danger)", fontWeight: 600 }}>
                  Safety stop: 0 adds and {importPreview.removeCount} removals detected. Check VIN column mapping before apply.
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => void handleApplyImportSync()}
                disabled={
                  isImporting ||
                  (removeMissingOnSync &&
                    importPreview.addCount === 0 &&
                    importPreview.removeCount >= RISKY_REMOVAL_THRESHOLD)
                }
                style={{ marginTop: "0.75rem" }}
              >
                {isImporting ? "Syncing..." : "Apply Import"}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      <DashboardFilters
        search={search}
        statusFilter={statusFilter}
        makeFilter={makeFilter}
        modelFilter={modelFilter}
        allStatuses={allStatuses}
        allMakes={allMakes}
        allModels={allModels}
        isAdmin={isAdmin}
        isSaving={isSaving}
        onSearchChange={setSearch}
        onStatusChange={setStatusFilter}
        onMakeChange={setMakeFilter}
        onModelChange={setModelFilter}
        onClearAll={() => {
          setSearch("");
          setStatusFilter("All");
          setMakeFilter("All");
          setModelFilter("All");
        }}
        onCleanupRemoved={() => void handleCleanupRemovedVehicles()}
      />

      <section className="table-wrap" aria-label="Vehicle inventory table">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", paddingBottom: "1rem", paddingLeft: "1rem", paddingRight: "1rem", borderBottom: "1px solid var(--line)" }}>
          <h2 style={{ margin: 0 }}>Vehicles</h2>
          <span style={{ fontSize: "0.9rem", color: "var(--muted)"}}>
            Showing {filteredVehicles.length} of {vehicles.length}
          </span>
        </div>
        <table>
          <thead>
            <tr>
              <th>VIN Last 8</th>
              <th>Vehicle</th>
              <th>Status</th>
              <th>Last Location</th>
              <th>Days on Lot</th>
              <th>Notes</th>
              {isAdmin && <th>Action</th>}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={isAdmin ? 7 : 6} className="empty-row">
                  Loading vehicles...
                </td>
              </tr>
            ) : null}
            {filteredVehicles.map((vehicle) => (
              <VehicleRow
                key={vehicle.id}
                vehicle={vehicle}
                onMarkSoldPendingRemoval={handleMarkSoldPendingRemoval}
                onEdit={handleStartEdit}
                isAdmin={isAdmin}
              />
            ))}
            {!isLoading && filteredVehicles.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 7 : 6} className="empty-row">
                  No vehicles match this filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
export default App;


