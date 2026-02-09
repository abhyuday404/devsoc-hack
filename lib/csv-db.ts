import initSqlJs, { Database, SqlJsStatic } from "sql.js";
import Papa from "papaparse";
import path from "path";
import fs from "fs";

// ---------------------------------------------------------------------------
// Persist singleton state on globalThis so it survives Next.js hot reloads
// and is shared across all API routes within the same Node.js process.
// ---------------------------------------------------------------------------

interface DbGlobal {
  __sqlJs?: SqlJsStatic | null;
  __sqlDb?: Database | null;
  __tableSchemas?: Map<
    string,
    { columns: { name: string; type: string }[]; rowCount: number }
  >;
}

const g = globalThis as unknown as DbGlobal;

function getSqlSingleton(): SqlJsStatic | null {
  return g.__sqlJs ?? null;
}
function setSqlSingleton(val: SqlJsStatic | null) {
  g.__sqlJs = val;
}

function getDbSingleton(): Database | null {
  return g.__sqlDb ?? null;
}
function setDbSingleton(val: Database | null) {
  g.__sqlDb = val;
}

function getTableSchemasMap(): Map<
  string,
  { columns: { name: string; type: string }[]; rowCount: number }
> {
  if (!g.__tableSchemas) {
    g.__tableSchemas = new Map();
  }
  return g.__tableSchemas;
}

// ---------------------------------------------------------------------------
// Initialisation helpers
// ---------------------------------------------------------------------------

async function getSqlJs(): Promise<SqlJsStatic> {
  let SQL = getSqlSingleton();
  if (!SQL) {
    // Locate the WASM binary from node_modules so sql.js can load it
    const wasmPath = path.join(
      process.cwd(),
      "node_modules",
      "sql.js",
      "dist",
      "sql-wasm.wasm",
    );
    const wasmBinary = fs.readFileSync(wasmPath);

    SQL = await initSqlJs({
      wasmBinary,
    });
    setSqlSingleton(SQL);
  }
  return SQL;
}

export async function getDb(): Promise<Database> {
  let db = getDbSingleton();
  if (!db) {
    const sqlJs = await getSqlJs();
    db = new sqlJs.Database();
    setDbSingleton(db);
  }
  return db;
}

export function resetDb(): void {
  const db = getDbSingleton();
  if (db) {
    db.close();
    setDbSingleton(null);
  }
  getTableSchemasMap().clear();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitizeColumnName(name: string): string {
  // Remove BOM, trim whitespace, replace non-alphanumeric with underscores
  let cleaned = name.replace(/[\ufeff\u200b]/g, "").trim();
  cleaned = cleaned.replace(/[^a-zA-Z0-9_]/g, "_");
  // Ensure it doesn't start with a digit
  if (/^[0-9]/.test(cleaned)) {
    cleaned = "_" + cleaned;
  }
  // Fallback for empty names
  if (!cleaned) {
    cleaned = "column";
  }
  return cleaned.toLowerCase();
}

function inferSqlType(values: string[]): string {
  // Sample up to 100 non-empty values to infer type
  const samples = values
    .filter((v) => v !== null && v !== undefined && v.trim() !== "")
    .slice(0, 100);

  if (samples.length === 0) return "TEXT";

  let allInteger = true;
  let allNumeric = true;

  for (const val of samples) {
    const trimmed = val.trim();
    if (allInteger && !/^-?\d+$/.test(trimmed)) {
      allInteger = false;
    }
    if (allNumeric && isNaN(Number(trimmed))) {
      allNumeric = false;
    }
    if (!allInteger && !allNumeric) break;
  }

  if (allInteger) return "INTEGER";
  if (allNumeric) return "REAL";
  return "TEXT";
}

export function sanitizeTableName(fileName: string): string {
  let name = fileName.replace(/\.csv$/i, "");
  name = name.replace(/[^a-zA-Z0-9_]/g, "_");
  if (/^[0-9]/.test(name)) {
    name = "t_" + name;
  }
  if (!name) {
    name = "uploaded_data";
  }
  return name.toLowerCase();
}

// ---------------------------------------------------------------------------
// CSV → SQLite loader
// ---------------------------------------------------------------------------

export async function loadCsvIntoDb(
  csvContent: string,
  tableName: string,
): Promise<{
  tableName: string;
  columns: { name: string; type: string }[];
  rowCount: number;
}> {
  const database = await getDb();
  const tableSchemas = getTableSchemasMap();

  // Parse CSV
  const parsed = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false, // Keep everything as strings for controlled type inference
  });

  if (parsed.errors.length > 0) {
    const criticalErrors = parsed.errors.filter(
      (e) => e.type !== "FieldMismatch",
    );
    if (criticalErrors.length > 0) {
      throw new Error(
        `CSV parsing errors: ${criticalErrors.map((e) => e.message).join(", ")}`,
      );
    }
  }

  const rawHeaders = parsed.meta.fields;
  if (!rawHeaders || rawHeaders.length === 0) {
    throw new Error("CSV has no headers");
  }

  const rows = parsed.data as Record<string, string>[];
  if (rows.length === 0) {
    throw new Error("CSV has no data rows");
  }

  // Sanitize column names and handle duplicates
  const columnNameMap: Map<string, string> = new Map();
  const usedNames = new Set<string>();

  for (const rawHeader of rawHeaders) {
    const sanitized = sanitizeColumnName(rawHeader);
    let finalName = sanitized;
    let counter = 1;
    while (usedNames.has(finalName)) {
      finalName = `${sanitized}_${counter}`;
      counter++;
    }
    usedNames.add(finalName);
    columnNameMap.set(rawHeader, finalName);
  }

  // Infer types for each column
  const columns: { name: string; type: string; rawName: string }[] = [];
  for (const rawHeader of rawHeaders) {
    const sanitizedName = columnNameMap.get(rawHeader)!;
    const columnValues = rows.map((row) => row[rawHeader] as string);
    const sqlType = inferSqlType(columnValues);
    columns.push({ name: sanitizedName, type: sqlType, rawName: rawHeader });
  }

  // Drop table if it already exists
  database.run(`DROP TABLE IF EXISTS "${tableName}"`);

  // Create table
  const columnDefs = columns
    .map((col) => `"${col.name}" ${col.type}`)
    .join(", ");
  const createSql = `CREATE TABLE "${tableName}" (${columnDefs})`;
  database.run(createSql);

  // Insert rows in batches using prepared statements
  const placeholders = columns.map(() => "?").join(", ");
  const insertSql = `INSERT INTO "${tableName}" VALUES (${placeholders})`;

  database.run("BEGIN TRANSACTION");
  try {
    const stmt = database.prepare(insertSql);
    for (const row of rows) {
      const values = columns.map((col) => {
        const rawVal = row[col.rawName];
        if (rawVal === null || rawVal === undefined || rawVal.trim() === "") {
          return null;
        }
        if (col.type === "INTEGER") {
          const parsed = parseInt(rawVal, 10);
          return isNaN(parsed) ? null : parsed;
        }
        if (col.type === "REAL") {
          const parsed = parseFloat(rawVal);
          return isNaN(parsed) ? null : parsed;
        }
        return rawVal.trim();
      });
      stmt.run(values);
    }
    stmt.free();
    database.run("COMMIT");
  } catch (error) {
    database.run("ROLLBACK");
    throw error;
  }

  const schema = {
    columns: columns.map((c) => ({ name: c.name, type: c.type })),
    rowCount: rows.length,
  };

  tableSchemas.set(tableName, schema);

  return {
    tableName,
    columns: schema.columns,
    rowCount: schema.rowCount,
  };
}

// ---------------------------------------------------------------------------
// Schema introspection
// ---------------------------------------------------------------------------

export function getTableSchemas(): Map<
  string,
  { columns: { name: string; type: string }[]; rowCount: number }
> {
  return getTableSchemasMap();
}

export function getSchemaDescription(): string {
  const tableSchemas = getTableSchemasMap();
  if (tableSchemas.size === 0) {
    return "No tables loaded.";
  }

  const parts: string[] = [];
  for (const [tableName, schema] of tableSchemas) {
    const colDescs = schema.columns
      .map((c) => `  "${c.name}" ${c.type}`)
      .join(",\n");
    parts.push(`Table "${tableName}" (${schema.rowCount} rows):\n${colDescs}`);
  }
  return parts.join("\n\n");
}

// ---------------------------------------------------------------------------
// Query execution
// ---------------------------------------------------------------------------

export async function executeQuery(
  sql: string,
): Promise<{ columns: string[]; rows: (string | number | null)[][] }> {
  const database = await getDb();
  try {
    const results = database.exec(sql);
    if (results.length === 0) {
      return { columns: [], rows: [] };
    }
    const first = results[0];
    return {
      columns: first.columns,
      rows: first.values as (string | number | null)[][],
    };
  } catch (error) {
    throw new Error(
      `SQL execution error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function getSampleRows(
  tableName: string,
  limit: number = 5,
): Promise<{ columns: string[]; rows: (string | number | null)[][] }> {
  return executeQuery(`SELECT * FROM "${tableName}" LIMIT ${limit}`);
}
