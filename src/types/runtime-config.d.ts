export {};

declare global {
  interface Window {
    RUNTIME_CONFIG?: {
      EnableComments?: boolean;
      RecommendationDataSource?: string;
      // Runtime feature settings are projected by the existing root layout.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [key: string]: any;
    };
  }
}
