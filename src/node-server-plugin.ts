import { SpawnOptions } from 'child_process';
import { Observable } from 'rxjs/Observable';
import { empty } from 'rxjs/observable/empty';
import { _throw } from 'rxjs/observable/throw';
import { timer } from 'rxjs/observable/timer';
import {
  catchError,
  debounceTime,
  delayWhen,
  map,
  retryWhen,
  scan,
  switchMap,
  switchMapTo,
  tap,
  withLatestFrom,
} from 'rxjs/operators';
import { Subject } from 'rxjs/Subject';
import { ChildProcessModule } from './child_process';
import { NodeServerPluginConfig, ScriptPathResolver } from './config';
import { ProcessModule } from './process';

export interface WebpackStats {

  compilation: {
    assets: {
      [assetName: string]: {
        existsAt?: string;
      },
    },
  };

  toString(options: any): string;

  toJson(options: any): any;

}

/**
 * Plugin which starts a node script after compilation has finished.
 *
 * The first emitted asset with extension `.js` will be executed.
 * All standard streams are inherited by the spawned process.
 * If webpack is in watch mode and emits a new compilation the script is stopped and the new bundle
 * started.
 * If webpack is run for a one of compilation, the exit code of the script will be returned.
 * Should the script exit with a code other than 0, the plugin tries to restart it.
 * If the script is not able to stay up for a certain time (default: 10 seconds), the plugin will
 * give up restarting it after some set number of tries (default: 3 times).
 */
// tslint:disable-next-line
export class _NodeServerPlugin {

  /** @internal */
  $onDone = new Subject<WebpackStats>();
  /** @internal */
  $pipeline: Observable<{}>;

  private watchMode: boolean;
  private retries: number;
  private retryDelay: number;
  private minUpTime: number;
  private compilationDebounce: number;
  private killSignal: string;
  private command: string;
  private spawnOptions: SpawnOptions;
  private commandArgs: string[];
  private scriptPathResolver: ScriptPathResolver;

  constructor(private process: ProcessModule,
              private child_process: ChildProcessModule, // tslint:disable-line
              config: NodeServerPluginConfig = {}) {
    this.initFromConfig(config);
    this.setupPipeline();
  }

  initFromConfig({
                   retries, retryDelay, minUpTime, compilationDebounce, killSignal, command, commandArgs,
                   scriptPathResolver, spawnOptions,
                 }: NodeServerPluginConfig): void {
    this.retries             = defaultTo(retries, 3);
    this.retryDelay          = defaultTo(retryDelay, 1);
    this.minUpTime           = defaultTo(minUpTime, 10);
    this.compilationDebounce = defaultTo(compilationDebounce, 300);
    this.killSignal          = defaultTo(killSignal, 'SIGKILL');
    this.command             = defaultTo(command, 'node');
    this.commandArgs         = defaultTo(commandArgs, []);
    this.scriptPathResolver  = defaultTo(scriptPathResolver, getFirstJSTargetBundlePath);

    this.spawnOptions = defaultTo(spawnOptions, {});

    if (this.spawnOptions.stdio === undefined) {
      this.spawnOptions.stdio = 'inherit';
    }
  }

  setupPipeline(): void {
    this.$pipeline = this.$onDone.pipe(
      debounceTime(this.compilationDebounce),
      switchMap((stats: WebpackStats) => this.runScript(stats)),
    );
  }

  apply(compiler) {

    // Register callback to start server when compiler is done.
    compiler.hooks.done.tap('NodeServerPlugin', stats => this.$onDone.next(stats));

    // Detect whether compiler is in watch mode.
    compiler.hooks.run.tap('NodeServerPlugin', () => this.setWatchMode(false));
    compiler.hooks.watchRun.tap('NodeServerPlugin', () => this.setWatchMode(true));

    // tslint:disable-next-line
    this.$pipeline.subscribe(() => {}, code => this.process.exit(code));
  }

  setWatchMode(watch: boolean) {
    this.watchMode = watch;
  }

  runScript(stats: WebpackStats): Observable<{}> {
    const $exitAfterMinUpTime = new Subject<boolean>();

    return this.spawnScript(stats).pipe(
      // After minUpTime notify of a successful try, timer will be canceled when script fails.
      switchMapTo(timer(this.minUpTime * 1000)),
      tap(() => $exitAfterMinUpTime.next(true)),
      retryWhen(errors => errors.pipe(
        // Notify of a failed try
        tap(() => $exitAfterMinUpTime.next(false)),
        this.shouldRetry($exitAfterMinUpTime),
        // Delay next try
        delayWhen(() => timer(this.retryDelay * 1000)),
      )),
      // Process has run out of retries so either do nothing or stop observable by throwing.
      catchError(err => this.watchMode ? empty() : _throw(err)),
    );
  }

  shouldRetry($exitAfterMinUpTime: Observable<boolean>): (errors: Observable<number>) => Observable<[number, boolean]> {
    const hasRetriesLeft = $exitAfterMinUpTime.pipe(
      scan<boolean, number>((retriesLeft, success) => success
        ? this.retries
        : retriesLeft - 1, this.retries,
      ),
      map(retriesLeft => retriesLeft >= 0),
    );

    return errors => errors.pipe(
      withLatestFrom(hasRetriesLeft),
      tap(([err, retry]: [number, boolean]) => {
        if (!this.watchMode || !retry) {
          throw err;
        }
      }),
    );
  }

  spawnScript(stats: WebpackStats): Observable<any> {
    return new Observable(obs => {
      const { command, spawnOptions } = this;

      const scriptPath = this.scriptPathResolver(stats);

      const childProcess = this.child_process.spawn(
        command,
        [...this.commandArgs, scriptPath],
        spawnOptions,
      );

      childProcess.on('close', code => code !== 0 ? obs.error(code) : obs.complete());

      obs.next();

      return () => childProcess.kill(this.killSignal);
    });
  }
}

function defaultTo<T>(value: T | null | undefined, defaultValue: T): T {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  return value;
}

export function getFirstJSTargetBundlePath(stats: WebpackStats): string | undefined {
  const { compilation: { assets } } = stats;
  const targets                     = Object.keys(assets);
  const jsTargets                   = targets.filter(target => target.match(/\.js$/));
  const firstJsTarget               = jsTargets[0];

  if (firstJsTarget !== undefined) {
    return assets[firstJsTarget].existsAt;
  }
}

export class NodeServerPlugin extends _NodeServerPlugin {

  constructor(config: NodeServerPluginConfig = {}) {
    super(new ProcessModule(), new ChildProcessModule(), config);
  }

}
