import { NextRequest, NextResponse } from "next/server";
import { executeQuery, getTableSchemas } from "@/lib/csv-db";
import {
  generateSqlQuery,
  generateSqlQueryRetry,
  generateChartConfig,
  generateAnswer,
} from "@/lib/llm";

const MAX_RETRIES = 2;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question } = body;

    if (!question || typeof question !== "string" || question.trim() === "") {
      return NextResponse.json(
        { error: "Please provide a question about your data." },
        { status: 400 },
      );
    }

    // Check that we have tables loaded
    const schemas = getTableSchemas();
    if (schemas.size === 0) {
      return NextResponse.json(
        {
          error:
            "No data loaded. Please upload one or more CSV files before asking questions.",
        },
        { status: 400 },
      );
    }

    // Step 1: Generate SQL query from the user's question via LLM
    let generatedQuery;
    try {
      generatedQuery = await generateSqlQuery(question.trim());
    } catch (error) {
      return NextResponse.json(
        {
          error: `Failed to generate SQL query: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
        { status: 422 },
      );
    }

    // Step 2: Execute the generated SQL query against the in-memory database
    // If it fails, retry up to MAX_RETRIES times using the dedicated retry
    // function which gives the LLM the failed SQL + error message for
    // much better self-correction.
    let queryResult;
    let lastError: string | null = null;

    try {
      queryResult = await executeQuery(generatedQuery.sql);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);

      // Retry loop with progressively richer context
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const retryQuery = await generateSqlQueryRetry(
            question.trim(),
            generatedQuery.sql,
            lastError,
            attempt,
          );
          generatedQuery = retryQuery;
          queryResult = await executeQuery(retryQuery.sql);
          lastError = null; // Clear error on success
          break;
        } catch (retryError) {
          lastError =
            retryError instanceof Error
              ? retryError.message
              : String(retryError);

          // If this was the last retry, we'll fall through to the error response below
          if (attempt === MAX_RETRIES) {
            return NextResponse.json(
              {
                error: `SQL execution failed after ${MAX_RETRIES + 1} attempts. Last error: ${lastError}`,
                sql: generatedQuery.sql,
                explanation: generatedQuery.explanation,
              },
              { status: 422 },
            );
          }
        }
      }
    }

    // Safety check — shouldn't happen but guards against unexpected flow
    if (!queryResult) {
      return NextResponse.json(
        {
          error: "Query execution produced no result.",
          sql: generatedQuery.sql,
          explanation: generatedQuery.explanation,
        },
        { status: 422 },
      );
    }

    // Step 3: Generate a natural language answer from the results
    let answer;
    try {
      answer = await generateAnswer(
        question.trim(),
        queryResult.columns,
        queryResult.rows,
        generatedQuery.explanation,
      );
    } catch {
      answer = "Query executed successfully. See the results below.";
    }

    // Step 4: Generate chart configuration if the data is visualizable
    let chartConfig = null;
    try {
      chartConfig = await generateChartConfig(
        question.trim(),
        queryResult.columns,
        queryResult.rows,
        generatedQuery.explanation,
      );
    } catch {
      // Chart generation is non-critical; if it fails we just skip it
      chartConfig = null;
    }

    // Convert rows to array-of-objects for easier frontend consumption
    const data = queryResult.rows.map((row) => {
      const obj: Record<string, string | number | null> = {};
      queryResult.columns.forEach((col: string, i: number) => {
        obj[col] = row[i];
      });
      return obj;
    });

    return NextResponse.json({
      success: true,
      question: question.trim(),
      sql: generatedQuery.sql,
      explanation: generatedQuery.explanation,
      answer,
      columns: queryResult.columns,
      data,
      rowCount: queryResult.rows.length,
      chartConfig,
    });
  } catch (error) {
    console.error("Query error:", error);
    return NextResponse.json(
      {
        error: `Query processing failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      },
      { status: 500 },
    );
  }
}
