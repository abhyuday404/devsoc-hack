import { NextRequest, NextResponse } from "next/server";
import { executeQuery, getTableSchemas } from "@/lib/csv-db";

const SAFE_SELECT_ALL_REGEX =
  /^SELECT\s+\*\s+FROM\s+"?([A-Za-z_][A-Za-z0-9_]*)"?\s*;?\s*$/i;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const sql = body?.sql;

    if (!sql || typeof sql !== "string") {
      return NextResponse.json(
        { error: "Please provide a SQL query." },
        { status: 400 },
      );
    }

    const trimmedSql = sql.trim();
    const match = trimmedSql.match(SAFE_SELECT_ALL_REGEX);
    if (!match) {
      return NextResponse.json(
        { error: "Only SELECT * FROM <table> queries are allowed." },
        { status: 400 },
      );
    }

    const tableName = match[1].toLowerCase();
    const schemas = getTableSchemas();
    if (!schemas.has(tableName)) {
      return NextResponse.json(
        { error: `Table "${tableName}" is not loaded.` },
        { status: 404 },
      );
    }

    const queryResult = await executeQuery(`SELECT * FROM "${tableName}";`);
    const data = queryResult.rows.map((row) => {
      const obj: Record<string, string | number | null> = {};
      queryResult.columns.forEach((col, i) => {
        obj[col] = row[i];
      });
      return obj;
    });

    return NextResponse.json({
      success: true,
      sql: `SELECT * FROM "${tableName}";`,
      columns: queryResult.columns,
      data,
      rowCount: queryResult.rows.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: `SQL processing failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      },
      { status: 500 },
    );
  }
}
