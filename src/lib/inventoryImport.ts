import type {
  DetailType,
  VehicleCondition,
  VehicleLocation,
  VehicleStatus,
  VehicleType,
} from "../types/Vehicle";

export const suggestedMakes = [
  "Subaru",
  "Toyota",
  "Honda",
  "Ford",
  "Chevrolet",
  "Nissan",
  "Hyundai",
  "Kia",
  "Mazda",
  "Jeep",
  "GMC",
  "Ram",
  "Volkswagen",
  "BMW",
  "Mercedes-Benz",
  "Audi",
  "Lexus",
  "Acura",
  "Volvo",
  "Mitsubishi",
];

export const suggestedModels = [
  "Outback",
  "Forester",
  "Crosstrek",
  "Ascent",
  "Impreza",
  "Legacy",
  "WRX",
  "BRZ",
  "Camry",
  "Corolla",
  "RAV4",
  "Civic",
  "Accord",
  "CR-V",
  "F-150",
  "Silverado",
  "Altima",
  "Rogue",
  "Tucson",
  "Sportage",
];

export function normalizeVin(value: string): string {
  const trimmed = value.trim().toUpperCase();
  return trimmed.length > 8 ? trimmed.slice(-8) : trimmed;
}

export function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function parseVehicleCondition(value: string): VehicleCondition {
  return value.trim().toLowerCase() === "new" ? "New" : "Used";
}

export function parseVehicleType(value: string): VehicleType {
  const normalized = value.trim().toLowerCase();
  if (normalized === "wholesale") return "Wholesale";
  if (normalized === "certified") return "Certified";
  return "None";
}

export function parseDetailType(value: string): DetailType {
  return value.trim().toLowerCase() === "wash tub" ? "Wash Tub" : "Subaru Detail";
}

export function parseVehicleStatus(value: string): VehicleStatus {
  const normalized = value.trim().toLowerCase();
  if (normalized === "arrived") return "Arrived";
  if (normalized === "being detailed") return "Being Detailed";
  if (normalized === "ready for line!" || normalized === "ready for line") return "Ready For Line!";
  if (normalized === "on display") return "On Display";
  if (normalized === "sold pending removal") return "Sold Pending Removal";
  if (normalized === "removed") return "Removed";
  return "In Service";
}

export function parseVehicleLocation(value: string): VehicleLocation {
  const normalized = value.trim().toLowerCase();
  if (normalized === "front line") return "Front Line";
  if (normalized === "forester line" || normalized === "behind dealership") return "Forester Line";
  if (normalized === "crosstrek line" || normalized === "crosstrek side") return "Crosstrek Line";
  if (normalized === "outback line" || normalized === "outback side") return "Outback Line";
  if (normalized === "overflow lot") return "Overflow Lot";
  if (normalized === "dirt lot") return "Dirt Lot";
  return "Front Line";
}

export function parseBooleanCell(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "yes" || normalized === "1";
}

export function isSoldCell(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "1" ||
    normalized === "sold" ||
    normalized === "y"
  );
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (char === '"') {
      if (inQuotes && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && text[index + 1] === "\n") {
        index += 1;
      }
      row.push(field);
      if (row.some((cell) => cell.trim().length > 0)) {
        rows.push(row);
      }
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((cell) => cell.trim().length > 0)) {
      rows.push(row);
    }
  }

  return rows;
}

function decodeUtf32(bytes: Uint8Array, littleEndian: boolean): string {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let output = "";

  for (let offset = 0; offset + 3 < bytes.length; offset += 4) {
    const codePoint = view.getUint32(offset, littleEndian);
    if (codePoint === 0) continue;
    output += String.fromCodePoint(codePoint);
  }

  return output;
}

function decodeUtf16Be(bytes: Uint8Array): string {
  const swapped = new Uint8Array(bytes.length);
  for (let index = 0; index + 1 < bytes.length; index += 2) {
    swapped[index] = bytes[index + 1];
    swapped[index + 1] = bytes[index];
  }
  return new TextDecoder("utf-16le").decode(swapped);
}

function hasUtf32BePattern(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false;
  return bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 0 && bytes[3] !== 0;
}

function hasUtf32LePattern(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false;
  return bytes[0] !== 0 && bytes[1] === 0 && bytes[2] === 0 && bytes[3] === 0;
}

export async function decodeDelimitedFileText(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length === 0) return "";

  if (
    bytes.length >= 4 &&
    bytes[0] === 0x00 &&
    bytes[1] === 0x00 &&
    bytes[2] === 0xfe &&
    bytes[3] === 0xff
  ) {
    return decodeUtf32(bytes.slice(4), false);
  }

  if (
    bytes.length >= 4 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xfe &&
    bytes[2] === 0x00 &&
    bytes[3] === 0x00
  ) {
    return decodeUtf32(bytes.slice(4), true);
  }

  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return decodeUtf16Be(bytes.slice(2));
  }

  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes.slice(2));
  }

  if (hasUtf32BePattern(bytes)) {
    return decodeUtf32(bytes, false);
  }

  if (hasUtf32LePattern(bytes)) {
    return decodeUtf32(bytes, true);
  }

  return new TextDecoder("utf-8").decode(bytes);
}

export async function parseInventoryFile(file: File): Promise<string[][]> {
  const isExcelFile = /\.(xlsx|xls)$/i.test(file.name);

  if (isExcelFile) {
    const workbook = (await import("xlsx")).read(await file.arrayBuffer(), { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) return [];

    const sheet = workbook.Sheets[firstSheetName];
    const rawRows = (await import("xlsx")).utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
    }) as Array<Array<string | number | boolean>>;

    return rawRows.map((row) => row.map((cell) => String(cell ?? "")));
  }

  return parseCsv(await decodeDelimitedFileText(file));
}
