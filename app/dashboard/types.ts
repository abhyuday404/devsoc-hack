export type View = "upload" | "data" | "insights" | "profile" | "graphs";

export type Customer = {
  id: string | number;
  name: string;
  email: string;
  phone: string;
  status: string;
};

export type ChatMessage = {
  role: "user" | "ai";
  text: string;
};

export type TableInfo = {
  fileName: string;
  tableName: string;
  columns: { name: string; type: string }[];
  rowCount: number;
};

export type QueryMessage = {
  id: string;
  type: "user" | "assistant" | "error";
  question?: string;
  answer?: string;
  sql?: string;
  explanation?: string;
  columns?: string[];
  data?: Record<string, string | number | null>[];
  rowCount?: number;
  chartConfig?: ChartConfig | null;
  error?: string;
  timestamp: Date;
  loading?: boolean;
};

export type ChartConfig = {
  chartType: "bar" | "line" | "pie" | "area" | "scatter";
  title: string;
  xKey: string;
  yKeys: string[];
  colors: string[];
  insight: string;
};
