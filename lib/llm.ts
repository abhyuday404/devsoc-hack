import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSchemaDescription, getSampleRows, getTableSchemas } from "./csv-db";

const getClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY environment variable is not set. Please add it to your .env.local file.",
    );
  }
  return new GoogleGenerativeAI(apiKey);
};

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-pro-preview-06-05";

export interface GeneratedQuery {
  sql: string;
  explanation: string;
}

export interface ChartConfig {
  chartType: "bar" | "line" | "pie" | "area" | "scatter";
  title: string;
  xKey: string;
  yKeys: string[];
  colors: string[];
  insight: string;
}

export interface QueryAndChartResult {
  query: GeneratedQuery;
  chartConfig: ChartConfig | null;
}

// ---------------------------------------------------------------------------
// Schema context builder — gives the LLM the full picture of all tables,
// columns, types, and sample data so it can write correct SQL.
// ---------------------------------------------------------------------------

async function buildSchemaContext(): Promise<string> {
  const schemaDesc = getSchemaDescription();
  const schemas = getTableSchemas();

  const sampleParts: string[] = [];
  for (const [tableName] of schemas) {
    try {
      const sample = await getSampleRows(tableName, 3);
      if (sample.rows.length > 0) {
        const header = sample.columns.join(" | ");
        const separator = sample.columns.map(() => "---").join(" | ");
        const rows = sample.rows
          .map((row) =>
            row.map((v) => (v === null ? "NULL" : String(v))).join(" | "),
          )
          .join("\n");
        sampleParts.push(
          `Sample data from "${tableName}":\n${header}\n${separator}\n${rows}`,
        );
      }
    } catch {
      // Skip if we can't get sample rows
    }
  }

  return `${schemaDesc}\n\n${sampleParts.join("\n\n")}`;
}

/**
 * Build an explicit, machine-readable list of every valid table and column
 * name in the database. This is injected into the prompt so the LLM has
 * zero ambiguity about what identifiers are valid.
 */
function buildExactNamesList(): string {
  const schemas = getTableSchemas();
  if (schemas.size === 0) return "No tables loaded.";

  const parts: string[] = [];
  for (const [tableName, schema] of schemas) {
    const colList = schema.columns.map((c) => `"${c.name}"`).join(", ");
    parts.push(`TABLE "${tableName}" => columns: [${colList}]`);
  }
  return parts.join("\n");
}

/**
 * Collect every valid table and column name for post-generation validation.
 */
function collectValidIdentifiers(): {
  tables: Set<string>;
  columns: Set<string>;
  tableColumns: Map<string, Set<string>>;
} {
  const schemas = getTableSchemas();
  const tables = new Set<string>();
  const columns = new Set<string>();
  const tableColumns = new Map<string, Set<string>>();

  for (const [tableName, schema] of schemas) {
    tables.add(tableName.toLowerCase());
    const colSet = new Set<string>();
    for (const col of schema.columns) {
      columns.add(col.name.toLowerCase());
      colSet.add(col.name.toLowerCase());
    }
    tableColumns.set(tableName.toLowerCase(), colSet);
  }

  return { tables, columns, tableColumns };
}

// ---------------------------------------------------------------------------
// Gemini API caller
// ---------------------------------------------------------------------------

async function callGemini(
  systemPrompt: string,
  userMessage: string,
  options: {
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
  } = {},
): Promise<string> {
  const { temperature = 0, maxTokens = 1000, jsonMode = false } = options;

  const client = getClient();

  const generationConfig: Record<string, unknown> = {
    temperature,
    maxOutputTokens: maxTokens,
  };

  // When jsonMode is true, tell Gemini to return raw JSON — no markdown fencing
  if (jsonMode) {
    generationConfig.responseMimeType = "application/json";
  }

  const model = client.getGenerativeModel({
    model: MODEL,
    generationConfig,
    systemInstruction: systemPrompt,
  });

  const result = await model.generateContent(userMessage);
  const response = result.response;
  const text = response.text();

  if (!text) {
    throw new Error("Gemini returned an empty response");
  }

  return text;
}

// ---------------------------------------------------------------------------
// JSON extraction helpers
// ---------------------------------------------------------------------------

/**
 * Robustly extract a JSON object from a string that may contain
 * markdown fencing, leading prose, or trailing text.
 */
function extractJson(raw: string): string {
  let str = raw.trim();

  // 1. Strip markdown code fences (```json ... ``` or ``` ... ```)
  const fenceMatch = str.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    str = fenceMatch[1].trim();
  }

  // 2. If it already looks like a JSON object, return as-is
  if (str.startsWith("{") && str.endsWith("}")) {
    return str;
  }

  // 3. Find the outermost { ... } in the string using brace counting
  const startIdx = str.indexOf("{");
  if (startIdx === -1) {
    return str;
  }

  let depth = 0;
  let endIdx = -1;
  for (let i = startIdx; i < str.length; i++) {
    const ch = str[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        endIdx = i;
        break;
      }
    }
  }

  if (endIdx !== -1) {
    return str.substring(startIdx, endIdx + 1);
  }

  return str.substring(startIdx);
}

// ---------------------------------------------------------------------------
// SQL unescape — fix multi-layer JSON-style escaping
// ---------------------------------------------------------------------------

/**
 * Recursively unescape a SQL string that may have multiple layers of
 * JSON-style escaping (\\n → \n → newline, \\\" → \" → ", etc.).
 */
function unescapeSql(sql: string): string {
  let prev = "";
  let current = sql;

  for (let i = 0; i < 5 && current !== prev; i++) {
    prev = current;
    current = current
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\r/g, "\r")
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      .replace(/\\\\/g, "\\");
  }

  return current;
}

// ---------------------------------------------------------------------------
// SQL validation & auto-fix
// ---------------------------------------------------------------------------

/**
 * Levenshtein distance for fuzzy matching column/table names.
 */
function levenshtein(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;
  const dp: number[][] = Array.from({ length: la + 1 }, () =>
    Array(lb + 1).fill(0),
  );
  for (let i = 0; i <= la; i++) dp[i][0] = i;
  for (let j = 0; j <= lb; j++) dp[0][j] = j;
  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[la][lb];
}

/**
 * Find the closest match for a name from a set of valid names.
 * Returns the match if the distance is within the threshold, otherwise null.
 */
function findClosestMatch(
  name: string,
  validNames: Set<string>,
  maxDistance: number = 3,
): string | null {
  const lower = name.toLowerCase();
  // Exact match
  if (validNames.has(lower)) return lower;

  let best: string | null = null;
  let bestDist = Infinity;

  for (const valid of validNames) {
    // Check if it's a substring match (e.g. "revenue" matches "total_revenue")
    if (valid.includes(lower) || lower.includes(valid)) {
      const dist = Math.abs(valid.length - lower.length);
      if (dist < bestDist) {
        bestDist = dist;
        best = valid;
      }
      continue;
    }

    const dist = levenshtein(lower, valid);
    if (dist < bestDist) {
      bestDist = dist;
      best = valid;
    }
  }

  if (best !== null && bestDist <= maxDistance) {
    return best;
  }
  return null;
}

/**
 * Automatically fix common SQLite-incompatible syntax and identifier issues
 * in a generated SQL query. This runs BEFORE the query hits the database.
 */
function validateAndFixSql(sql: string): string {
  let fixed = sql;

  // 1. Replace ILIKE with LOWER() + LIKE
  //    Pattern: "column" ILIKE 'pattern'  →  LOWER("column") LIKE LOWER('pattern')
  fixed = fixed.replace(
    /("?[\w]+"?)\s+ILIKE\s+('(?:[^']|\\')*')/gi,
    (_, col, pattern) => `LOWER(${col}) LIKE LOWER(${pattern})`,
  );
  // Also handle: ILIKE without specific column context
  fixed = fixed.replace(/\bILIKE\b/gi, "LIKE");

  // 2. Replace PostgreSQL-style casts (::type) with CAST()
  fixed = fixed.replace(
    /("?[\w]+"?)::(\w+)/g,
    (_, expr, type) => `CAST(${expr} AS ${type.toUpperCase()})`,
  );

  // 3. Replace NOW() with datetime('now')
  fixed = fixed.replace(/\bNOW\s*\(\s*\)/gi, "datetime('now')");

  // 4. Replace CURRENT_TIMESTAMP function-call style
  //    (CURRENT_TIMESTAMP as keyword is valid in SQLite, but NOW() is not)

  // 5. Replace DATE_TRUNC('period', col) with strftime equivalents
  fixed = fixed.replace(
    /\bDATE_TRUNC\s*\(\s*'(\w+)'\s*,\s*("?[\w]+"?)\s*\)/gi,
    (_, period: string, col: string) => {
      const p = period.toLowerCase();
      switch (p) {
        case "year":
          return `strftime('%Y', ${col})`;
        case "month":
          return `strftime('%Y-%m', ${col})`;
        case "day":
          return `strftime('%Y-%m-%d', ${col})`;
        case "hour":
          return `strftime('%Y-%m-%d %H', ${col})`;
        case "week":
          return `strftime('%Y-%W', ${col})`;
        case "quarter":
          return `((CAST(strftime('%m', ${col}) AS INTEGER) + 2) / 3)`;
        default:
          return `strftime('%Y-%m-%d', ${col})`;
      }
    },
  );

  // 6. Replace EXTRACT(field FROM col) with strftime
  fixed = fixed.replace(
    /\bEXTRACT\s*\(\s*(\w+)\s+FROM\s+("?[\w]+"?)\s*\)/gi,
    (_, field: string, col: string) => {
      const f = field.toLowerCase();
      switch (f) {
        case "year":
          return `CAST(strftime('%Y', ${col}) AS INTEGER)`;
        case "month":
          return `CAST(strftime('%m', ${col}) AS INTEGER)`;
        case "day":
          return `CAST(strftime('%d', ${col}) AS INTEGER)`;
        case "hour":
          return `CAST(strftime('%H', ${col}) AS INTEGER)`;
        case "minute":
          return `CAST(strftime('%M', ${col}) AS INTEGER)`;
        case "dow":
        case "dayofweek":
          return `CAST(strftime('%w', ${col}) AS INTEGER)`;
        default:
          return `strftime('%Y-%m-%d', ${col})`;
      }
    },
  );

  // 7. Replace TO_CHAR(col, format) with strftime
  fixed = fixed.replace(
    /\bTO_CHAR\s*\(\s*("?[\w]+"?)\s*,\s*'([^']*)'\s*\)/gi,
    (_, col: string) => `strftime('%Y-%m-%d', ${col})`,
  );

  // 8. Replace COALESCE with ifnull if only two args (both work in SQLite, but belt-and-suspenders)
  // Actually COALESCE is valid in SQLite, so skip this.

  // 9. Replace LIMIT x OFFSET y (valid in SQLite, but check for OFFSET without LIMIT)
  // Actually this is fine, SQLite supports LIMIT...OFFSET.

  // 10. Replace BOOLEAN literals TRUE/FALSE with 1/0
  fixed = fixed.replace(/\bTRUE\b/gi, "1");
  fixed = fixed.replace(/\bFALSE\b/gi, "0");

  // 11. Replace string concatenation operator || if used with + (SQL Server style)
  // Actually || is correct for SQLite, and + is for numbers. This is fine.

  // 12. Replace REGEXP with LIKE where possible (SQLite doesn't support REGEXP by default)
  // This is tricky to auto-fix perfectly, so we'll leave it and let the retry handle it.

  // 13. Replace ANY/ALL array operators (PostgreSQL)
  // These are rare; let retry handle them.

  // 14. Fix double-semicolons or trailing issues
  fixed = fixed.replace(/;+\s*$/, "");
  fixed = fixed.trim();

  return fixed;
}

/**
 * Fix column and table name references in SQL to match actual DB identifiers.
 * Handles case mismatches and close typos.
 */
function fixIdentifierReferences(sql: string): string {
  const { tables, columns } = collectValidIdentifiers();
  let fixed = sql;

  // Find all double-quoted identifiers and try to fix them
  fixed = fixed.replace(/"([^"]+)"/g, (fullMatch, name: string) => {
    const lower = name.toLowerCase();

    // Check if it's a valid table name
    if (tables.has(lower)) {
      return `"${lower}"`;
    }

    // Check if it's a valid column name
    if (columns.has(lower)) {
      return `"${lower}"`;
    }

    // Try fuzzy match against tables
    const tableMatch = findClosestMatch(name, tables, 2);
    if (tableMatch) {
      return `"${tableMatch}"`;
    }

    // Try fuzzy match against columns
    const colMatch = findClosestMatch(name, columns, 2);
    if (colMatch) {
      return `"${colMatch}"`;
    }

    // Return lowercased version as last resort (column names are always lowercase)
    return `"${lower}"`;
  });

  return fixed;
}

/**
 * Full pre-execution SQL pipeline: unescape, strip fences, fix syntax, fix names.
 */
function preprocessSql(rawSql: string): string {
  let sql = rawSql;

  // Strip markdown fences
  sql = sql
    .replace(/^```(?:sql)?\s*\n?/i, "")
    .replace(/\n?\s*```\s*$/i, "")
    .trim();

  // Unescape JSON artifacts
  sql = unescapeSql(sql);

  // Fix SQLite-incompatible syntax
  sql = validateAndFixSql(sql);

  // Fix identifier references (typos, case issues)
  sql = fixIdentifierReferences(sql);

  return sql;
}

// ---------------------------------------------------------------------------
// SQL Generation
// ---------------------------------------------------------------------------

export async function generateSqlQuery(
  userQuestion: string,
): Promise<GeneratedQuery> {
  const schemaContext = await buildSchemaContext();
  const exactNames = buildExactNamesList();

  const systemPrompt = `You are an expert SQL analyst. You are given a database schema with sample data and a user's question. Your job is to generate a precise SQLite-compatible SQL query that answers the question.

Do not just generate the query based on the prompt — look at the column headers and sample entries carefully.

═══════════════════════════════════════════════════════════════
CRITICAL RULES (violations will cause errors):
═══════════════════════════════════════════════════════════════

1. ONLY generate SELECT or WITH...SELECT statements. Never INSERT, UPDATE, DELETE, DROP, ALTER, or any DDL/DML.

2. ALWAYS double-quote ALL table names AND column names. Example:
   SELECT "column_name" FROM "table_name" WHERE "other_col" > 10

3. Use ONLY the EXACT table and column names listed below. Do NOT invent, guess, or modify any names. Column names are always lowercase.

4. SQLite ONLY — the following are FORBIDDEN and will crash:
   ✗ ILIKE              → use LOWER("col") LIKE LOWER('pattern')
   ✗ NOW()              → use datetime('now')
   ✗ DATE_TRUNC(...)    → use strftime('%Y-%m', "col") etc.
   ✗ EXTRACT(x FROM y)  → use CAST(strftime('%Y', "col") AS INTEGER)
   ✗ TO_CHAR(...)       → use strftime(...)
   ✗ ::type casts       → use CAST("col" AS TYPE)
   ✗ BOOLEAN TRUE/FALSE → use 1 and 0
   ✗ REGEXP             → use LIKE or GLOB
   ✗ STRING_AGG         → use GROUP_CONCAT
   ✗ ARRAY types        → not supported
   ✗ ANY / ALL operators → not supported
   ✗ LATERAL joins      → not supported
   ✗ RETURNING clause   → not supported
   ✗ GENERATE_SERIES    → not supported
   ✗ INTERVAL '1 day'   → use datetime("col", '+1 day')

5. For string matching, use: LOWER("col") LIKE '%pattern%'

6. Use LIMIT to keep result sets reasonable (max 1000 rows). Always add LIMIT unless the user explicitly asks for all rows.

7. If the question is ambiguous, make a reasonable assumption and mention it in your explanation.

8. If the question cannot be answered with the available schema, explain why in the explanation section — but still try to write the closest useful query.

9. For aggregations, always include meaningful aliases: SELECT COUNT(*) AS "count", SUM("amount") AS "total_amount"

10. When doing GROUP BY, include all non-aggregated SELECT columns in the GROUP BY clause.

11. The table names in the user's question may not exactly match the database table names. Use the closest matching table from the schema.

═══════════════════════════════════════════════════════════════
EXACT VALID TABLE AND COLUMN NAMES (use these EXACTLY):
═══════════════════════════════════════════════════════════════
${exactNames}

═══════════════════════════════════════════════════════════════
DATABASE SCHEMA WITH TYPES:
═══════════════════════════════════════════════════════════════
${schemaContext}

═══════════════════════════════════════════════════════════════
RESPONSE FORMAT:
═══════════════════════════════════════════════════════════════
Respond with EXACTLY two sections separated by "---EXPLANATION---".
First write ONLY the raw SQL query (no markdown fencing, no backticks, no comments, no prose).
Then write "---EXPLANATION---" on its own line, followed by a brief explanation.

Example response:
SELECT "col1", "col2" FROM "my_table" WHERE "col1" > 10 ORDER BY "col1" DESC LIMIT 100
---EXPLANATION---
This query selects col1 and col2 from my_table where col1 is greater than 10, ordered descending, limited to 100 rows.`;

  const content = await callGemini(systemPrompt, userQuestion, {
    temperature: 0,
    maxTokens: 1500,
    jsonMode: false,
  });

  try {
    const trimmed = content.trim();

    let sql: string;
    let explanation: string;

    if (trimmed.includes("---EXPLANATION---")) {
      const parts = trimmed.split("---EXPLANATION---");
      sql = parts[0].trim();
      explanation = parts[1]?.trim() || "Query generated successfully.";
    } else {
      // Fallback: try to parse as JSON in case the model still returns JSON
      try {
        const jsonStr = extractJson(trimmed);
        const parsed = JSON.parse(jsonStr);
        sql = parsed.sql || "";
        explanation = parsed.explanation || "Query generated successfully.";
      } catch {
        // Last resort: extract raw SQL from the response
        const sqlMatch = trimmed.match(/(?:SELECT|WITH)[\s\S]+?(?:;|$)/i);
        if (sqlMatch) {
          sql = sqlMatch[0].replace(/;?\s*$/, "").trim();
          explanation = "Query extracted from response.";
        } else {
          throw new Error(
            `Could not extract SQL from LLM response: ${trimmed.substring(0, 300)}`,
          );
        }
      }
    }

    // Run the full preprocessing pipeline
    sql = preprocessSql(sql);

    if (!sql) {
      throw new Error("Generated SQL query is empty.");
    }

    // Safety check: reject non-SELECT queries
    const normalizedSql = sql.toUpperCase().trimStart();
    if (
      !normalizedSql.startsWith("SELECT") &&
      !normalizedSql.startsWith("WITH")
    ) {
      throw new Error(
        "Generated query is not a SELECT/WITH statement. Only read operations are allowed.",
      );
    }

    return { sql, explanation };
  } catch (error) {
    // If all parsing fails, try one more time to extract SQL
    const sqlMatch = content.match(/(?:SELECT|WITH)[\s\S]+?(?:;|$)/i);
    if (sqlMatch) {
      const sql = preprocessSql(sqlMatch[0].replace(/;?\s*$/, "").trim());
      return {
        sql,
        explanation:
          "Query extracted from response (structured parsing failed).",
      };
    }
    throw error;
  }
}

/**
 * Generate a SQL query specifically as a retry, given the original question,
 * the SQL that failed, and the error message. This gives the LLM much richer
 * context to self-correct.
 */
export async function generateSqlQueryRetry(
  userQuestion: string,
  failedSql: string,
  errorMessage: string,
  attemptNumber: number,
): Promise<GeneratedQuery> {
  const schemaContext = await buildSchemaContext();
  const exactNames = buildExactNamesList();

  const systemPrompt = `You are an expert SQL analyst. A previous SQL query FAILED. You must fix it.

═══════════════════════════════════════════════════════════════
THE PREVIOUS QUERY THAT FAILED:
═══════════════════════════════════════════════════════════════
${failedSql}

═══════════════════════════════════════════════════════════════
THE ERROR MESSAGE:
═══════════════════════════════════════════════════════════════
${errorMessage}

═══════════════════════════════════════════════════════════════
COMMON FIXES — apply whichever is relevant:
═══════════════════════════════════════════════════════════════
- "no such column" → The column name is wrong. Check the EXACT column names below and use the correct one. All column names are lowercase.
- "no such table" → The table name is wrong. Check the EXACT table names below.
- "no such function" → You used a function not available in SQLite. Use SQLite equivalents:
  • ILIKE → LOWER("col") LIKE LOWER('pattern')
  • NOW() → datetime('now')
  • DATE_TRUNC → strftime(...)
  • EXTRACT → CAST(strftime(...) AS INTEGER)
  • STRING_AGG → GROUP_CONCAT
  • TO_CHAR → strftime(...)
- "ambiguous column" → Add the table name prefix: "table"."column"
- "GROUP BY" error → Include all non-aggregated columns in GROUP BY
- "REGEXP" → Use LIKE or GLOB instead
- Type cast errors → Use CAST("col" AS TYPE) not ::type

═══════════════════════════════════════════════════════════════
EXACT VALID TABLE AND COLUMN NAMES (use ONLY these):
═══════════════════════════════════════════════════════════════
${exactNames}

═══════════════════════════════════════════════════════════════
DATABASE SCHEMA:
═══════════════════════════════════════════════════════════════
${schemaContext}

═══════════════════════════════════════════════════════════════
RULES:
═══════════════════════════════════════════════════════════════
1. ALWAYS double-quote ALL table and column names.
2. Use ONLY SQLite-compatible functions and syntax.
3. This is retry attempt ${attemptNumber}. Write a CORRECT query this time.

═══════════════════════════════════════════════════════════════
RESPONSE FORMAT:
═══════════════════════════════════════════════════════════════
Respond with EXACTLY two sections separated by "---EXPLANATION---".
First: ONLY the corrected raw SQL (no markdown, no backticks, no comments).
Then: "---EXPLANATION---" on its own line, followed by what you fixed.`;

  const content = await callGemini(systemPrompt, userQuestion, {
    temperature: 0,
    maxTokens: 1500,
    jsonMode: false,
  });

  const trimmed = content.trim();
  let sql: string;
  let explanation: string;

  if (trimmed.includes("---EXPLANATION---")) {
    const parts = trimmed.split("---EXPLANATION---");
    sql = parts[0].trim();
    explanation = parts[1]?.trim() || "Query corrected.";
  } else {
    const sqlMatch = trimmed.match(/(?:SELECT|WITH)[\s\S]+?(?:;|$)/i);
    if (sqlMatch) {
      sql = sqlMatch[0].replace(/;?\s*$/, "").trim();
      explanation = "Corrected query extracted from response.";
    } else {
      throw new Error(
        `Could not extract corrected SQL from retry response: ${trimmed.substring(0, 300)}`,
      );
    }
  }

  sql = preprocessSql(sql);

  if (!sql) {
    throw new Error("Corrected SQL query is empty.");
  }

  const normalizedSql = sql.toUpperCase().trimStart();
  if (
    !normalizedSql.startsWith("SELECT") &&
    !normalizedSql.startsWith("WITH")
  ) {
    throw new Error("Corrected query is not a SELECT/WITH statement.");
  }

  return { sql, explanation };
}

// ---------------------------------------------------------------------------
// Chart config generation
// ---------------------------------------------------------------------------

export async function generateChartConfig(
  userQuestion: string,
  columns: string[],
  rows: (string | number | null)[][],
  sqlExplanation: string,
): Promise<ChartConfig | null> {
  // Don't attempt to chart if there's no data or only one cell
  if (rows.length === 0 || columns.length === 0) return null;
  if (rows.length === 1 && columns.length === 1) return null;

  // Prepare a preview of the data (max 20 rows)
  const previewRows = rows.slice(0, 20);
  const header = columns.join(" | ");
  const separator = columns.map(() => "---").join(" | ");
  const dataPreview = previewRows
    .map((row) => row.map((v) => (v === null ? "NULL" : String(v))).join(" | "))
    .join("\n");

  const systemPrompt = `You are a data visualization expert. Given query results and the user's original question, determine the best chart type and configuration for visualizing the data using Recharts.

AVAILABLE CHART TYPES:
- "bar": For comparing categories or discrete values
- "line": For trends over time or continuous data
- "area": For showing volume/magnitude over time
- "pie": For showing proportions of a whole (use only when there are ≤10 categories and one numeric column)
- "scatter": For showing correlation between two numeric variables

RULES:
1. Only suggest a chart if the data is actually suitable for visualization.
2. xKey must be one of the column names and is typically a categorical or time column.
3. yKeys must be an array of one or more column names that contain numeric data to plot.
4. Provide 1 color hex code per yKey. Use visually distinct, attractive colors.
5. If the data is not suitable for visualization (e.g., a single value, a list of names, etc.), set chartType to null.
6. The "insight" field should be a brief, interesting observation about what the chart reveals.
7. The xKey and yKeys MUST exactly match column names from the results. Column names are case-sensitive — use them exactly as provided.

QUERY RESULTS:
Columns: ${columns.join(", ")}
Row count: ${rows.length}
SQL explanation: ${sqlExplanation}

Data preview:
${header}
${separator}
${dataPreview}

You MUST respond with a JSON object in this exact format:
{
  "chartType": "bar|line|pie|area|scatter|null",
  "title": "Chart title",
  "xKey": "column_name_for_x_axis",
  "yKeys": ["column_name_1", "column_name_2"],
  "colors": ["#4F46E5", "#10B981"],
  "insight": "Brief insight about what the data shows"
}`;

  try {
    const content = await callGemini(systemPrompt, userQuestion, {
      temperature: 0,
      maxTokens: 500,
      jsonMode: true,
    });

    const jsonStr = extractJson(content);
    const parsed = JSON.parse(jsonStr);

    if (
      !parsed.chartType ||
      parsed.chartType === "null" ||
      parsed.chartType === null
    )
      return null;

    // Validate that xKey and yKeys exist in the columns
    if (!columns.includes(parsed.xKey)) {
      // Try case-insensitive match
      const match = columns.find(
        (c) => c.toLowerCase() === parsed.xKey.toLowerCase(),
      );
      if (match) {
        parsed.xKey = match;
      } else {
        return null;
      }
    }

    const validYKeys: string[] = [];
    for (const yKey of parsed.yKeys) {
      if (columns.includes(yKey)) {
        validYKeys.push(yKey);
      } else {
        const match = columns.find(
          (c) => c.toLowerCase() === yKey.toLowerCase(),
        );
        if (match) validYKeys.push(match);
      }
    }

    if (validYKeys.length === 0) return null;

    // Ensure we have enough colors
    const defaultColors = [
      "#4F46E5",
      "#10B981",
      "#F59E0B",
      "#EF4444",
      "#8B5CF6",
      "#EC4899",
      "#06B6D4",
      "#84CC16",
    ];
    const colors = validYKeys.map(
      (_, i) =>
        (parsed.colors && parsed.colors[i]) ||
        defaultColors[i % defaultColors.length],
    );

    return {
      chartType: parsed.chartType as ChartConfig["chartType"],
      title: parsed.title || "Query Results",
      xKey: parsed.xKey,
      yKeys: validYKeys,
      colors,
      insight: parsed.insight || "",
    };
  } catch {
    // If chart generation fails, it's non-critical — just skip the chart
    return null;
  }
}

// ---------------------------------------------------------------------------
// Natural-language answer generation
// ---------------------------------------------------------------------------

export async function generateAnswer(
  userQuestion: string,
  columns: string[],
  rows: (string | number | null)[][],
  sqlExplanation: string,
): Promise<string> {
  // Build a preview of results
  const previewRows = rows.slice(0, 30);
  const header = columns.join(" | ");
  const separator = columns.map(() => "---").join(" | ");
  const dataStr = previewRows
    .map((row) => row.map((v) => (v === null ? "NULL" : String(v))).join(" | "))
    .join("\n");

  const systemPrompt = `You are a helpful data analyst. The user asked a question about their data, and a SQL query was run to get results. Provide a clear, concise natural language answer to the user's question based on the query results.

RULES:
1. Be specific — mention actual numbers, names, values from the results.
2. If the data shows trends, comparisons, or notable outliers, mention them.
3. Keep it to 2-4 sentences unless the question warrants more detail.
4. If there are many rows, summarize the key findings.
5. Use Markdown formatting for readability (bold key numbers, use lists if needed).

SQL Explanation: ${sqlExplanation}
Total result rows: ${rows.length}

Query Results:
${header}
${separator}
${dataStr}${rows.length > 30 ? `\n... and ${rows.length - 30} more rows` : ""}`;

  // NOTE: generateAnswer returns prose, NOT JSON — so jsonMode is false
  const content = await callGemini(systemPrompt, userQuestion, {
    temperature: 0.3,
    maxTokens: 500,
    jsonMode: false,
  });

  return content || "Unable to generate an answer.";
}
