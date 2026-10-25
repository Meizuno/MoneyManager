// What a page tells the layout about itself, through definePageMeta.
declare module "#app" {
  interface PageMeta {
    /**
     * The page is about a span of time: on a phone the layout puts its
     * PeriodPicker in the header. "all" offers All time as well as months
     * and years.
     */
    period?: "month" | "all";
  }
}

export {};
