export type Transaction = {
  id: number;
  date: string;
  description: string;
  amount: number;
  currency: string | null;
  type: string;
  category: string;
  created_at?: string;
};

export type TransactionInput = {
  date: string;
  description: string;
  amount: number | string;
  currency?: string | null;
  type?: string | null;
  category?: string | null;
};
