export type CsvRow = string[];

export type CsvTransactionRow = {
  date: string;
  name: string;
  amount: number;
  currency: string | null;
  type: string | null;
  category: string | null;
};
