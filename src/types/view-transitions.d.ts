export {};

declare global {
  interface TMViewTransition {
    readonly ready: Promise<void>;
    readonly updateCallbackDone: Promise<void>;
    readonly finished: Promise<void>;
    skipTransition(): void;
  }

  interface Document {
    startViewTransition?: (
      update: () => void | Promise<void>
    ) => TMViewTransition;
  }
}
