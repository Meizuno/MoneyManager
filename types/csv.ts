export type CsvRow = string[];

export type CsvTransactionRow = {
  date: string;
  description: string;
  amount: number;
  currency: string | null;
  type: string | null;
  category: string | null;
};
