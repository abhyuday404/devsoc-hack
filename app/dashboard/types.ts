export type View = "upload" | "data" | "insights" | "profile";

export type Customer = {
  id: number;
  name: string;
  email: string;
  phone: string;
  status: string;
};

export type ChatMessage = {
  role: "user" | "ai";
  text: string;
};
