import { NextRequest, NextResponse } from "next/server";
import { executeQuery, getTableSchemas } from "@/lib/csv-db";
import {
  generateSqlQuery,
  generateChartConfig,
  generateAnswer,
} from "@/lib/llm";

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
    let queryResult;
    try {
      queryResult = await executeQuery(generatedQuery.sql);
    } catch (error) {
      // If the first query fails, try once more with the error context
      // This gives the LLM a chance to self-correct
      try {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const retryQuery = await generateSqlQuery(
          `${question.trim()}\n\n(Previous SQL attempt failed with error: ${errorMsg}. Please fix the query.)`,
        );
        generatedQuery = retryQuery;
        queryResult = await executeQuery(retryQuery.sql);
      } catch (retryError) {
        return NextResponse.json(
          {
            error: `SQL execution failed: ${
              retryError instanceof Error
                ? retryError.message
                : String(retryError)
            }`,
            sql: generatedQuery.sql,
            explanation: generatedQuery.explanation,
          },
          { status: 422 },
        );
      }
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
      queryResult.columns.forEach((col, i) => {
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
