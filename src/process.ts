
export class ProcessModule {
  nextTick(cb: () => void) {
    process.nextTick(cb);
  }

  exit(code?: number) {
    process.exit(code);
  }
}
