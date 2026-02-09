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

/**
 * Robustly extract a JSON object from a string that may contain
 * markdown fencing, leading prose, or trailing text.
 */
function extractJson(raw: string): string {
  let str = raw.trim();

  // 1. Strip markdown code fences (```json ... ``` or ``` ... ```)
  //    Handle cases with extra whitespace, newlines, etc.
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
    // Last resort: return what we have and let JSON.parse throw
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

  // Fallback: return from first { to end
  return str.substring(startIdx);
}

export async function generateSqlQuery(
  userQuestion: string,
): Promise<GeneratedQuery> {
  const schemaContext = await buildSchemaContext();

  const systemPrompt = `You are an expert SQL analyst. You are given a database schema with sample data and a user's question. Your job is to generate a precise SQLite-compatible SQL query that answers the question.
    Do not just generate the query based on the prompt, look at the column headers and an example entry and make proper regex if necessary.

RULES:
1. Only generate SELECT statements. Never generate INSERT, UPDATE, DELETE, DROP, ALTER, or any DDL/DML.
2. Always use double quotes around table and column names (e.g., SELECT "column_name" FROM "table_name").
3. Use SQLite-compatible syntax only (no ILIKE, use LIKE with LOWER() instead; no DATE_TRUNC, use strftime() instead).
4. If the user asks for a summary, top-N, trend, comparison, or aggregation, write the appropriate GROUP BY, ORDER BY, LIMIT, etc.
5. Keep the result set reasonably sized — use LIMIT if appropriate (max 1000 rows).
6. If the question is ambiguous, make a reasonable assumption and mention it in your explanation.
7. If the question cannot be answered with the given schema, explain why.

DATABASE SCHEMA:
${schemaContext}

IMPORTANT: Respond with EXACTLY two sections separated by "---EXPLANATION---". First write ONLY the raw SQL query (no markdown fencing, no backticks, no comments). Then write "---EXPLANATION---" on its own line, followed by a brief explanation.

Example response format:
SELECT "col1", "col2" FROM "my_table" WHERE "col1" > 10 ORDER BY "col1" DESC LIMIT 100
---EXPLANATION---
This query selects col1 and col2 from my_table where col1 is greater than 10, ordered descending, limited to 100 rows.`;

  // Do NOT use jsonMode — it causes Gemini to double-escape quotes and
  // newlines inside the SQL string, producing broken queries like
  //   SELECT \"col\" FROM \"table\"\nWHERE ...
  const content = await callGemini(systemPrompt, userQuestion, {
    temperature: 0,
    maxTokens: 1000,
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
        sql = unescapeSql(parsed.sql || "");
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

    // Strip any markdown code fences that the model might wrap around the SQL
    sql = sql
      .replace(/^```(?:sql)?\s*\n?/i, "")
      .replace(/\n?\s*```\s*$/i, "")
      .trim();

    // Clean up any residual escape sequences (belt-and-suspenders)
    sql = unescapeSql(sql);

    if (!sql) {
      throw new Error("Generated SQL query is empty.");
    }

    // Safety check: reject non-SELECT queries
    const normalizedSql = sql.toUpperCase();
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
      const sql = unescapeSql(sqlMatch[0].replace(/;?\s*$/, "").trim());
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
 * Recursively unescape a SQL string that may have multiple layers of
 * JSON-style escaping (\\n → \n → newline, \\\" → \" → ", etc.).
 */
function unescapeSql(sql: string): string {
  let prev = "";
  let current = sql;

  // Keep replacing until the string stabilises (handles any depth of escaping)
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
