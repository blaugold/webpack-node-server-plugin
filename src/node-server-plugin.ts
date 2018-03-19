import { Observable, Subject } from '@reactivex/rxjs';
import { ChildProcessModule } from './child_process';
import { NodeServerPluginConfig } from './config';
import { ProcessModule } from './process';

export interface WebpackStats {

  compilation: {
    assets: {
      [assetName: string]: {
        existsAt?: string;
      }
    }
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
  $pipeline: Observable<void>;

  private watchMode: boolean;
  private retries: number;
  private retryDelay: number;
  private minUpTime: number;
  private compilationDebounce: number;

  constructor(private process: ProcessModule,
              private child_process: ChildProcessModule, // tslint:disable-line
              config: NodeServerPluginConfig = {}) {
    this.initFromConfig(config);
    this.setupPipeline();
  }

  initFromConfig(config: any): void {
    this.retries             = defaultTo(config.retries, 3);
    this.retryDelay          = defaultTo(config.retryDelay, 1);
    this.minUpTime           = defaultTo(config.minUpTime, 10);
    this.compilationDebounce = defaultTo(config.compilationDebounce, 300);
  }

  setupPipeline(): void {
    this.$pipeline = this.$onDone
      .debounceTime(this.compilationDebounce)
      .map(getFirstJSTargetBundlePath)

      // Do nothing if compilation produced no executable.
      .filter(bundlePath => !!bundlePath)
      .switchMap<string, void>(bundlePath => this.runScript(bundlePath));
  }

  apply(compiler) {

    // Register callback to start server when compiler is done.
    compiler.plugin('done', stats => this.$onDone.next(stats));

    // Detect whether compiler is in watch mode.
    compiler.plugin('run', (_, cb) => {
      this.setWatchMode(false);
      cb();
    });
    compiler.plugin('watch-run', (_, cb) => {
      this.setWatchMode(true);
      cb();
    });

    // tslint:disable-next-line
    this.$pipeline.subscribe(() => {}, code => this.process.exit(code));
  }

  setWatchMode(watch: boolean) {
    this.watchMode = watch;
  }

  runScript(scriptPath: string): Observable<void> {
    const $exitAfterMinUpTime = new Subject();

    return this.spawnScript(scriptPath)
    // After minUpTime notify of a successful try, timer will be canceled when script fails.
      .switchMapTo(Observable.timer(this.minUpTime * 1000))
      .do(() => $exitAfterMinUpTime.next(true))
      .retryWhen(errors => errors
        // Notify of a failed try
          .do(() => $exitAfterMinUpTime.next(false))
          .let(this.shouldRetry($exitAfterMinUpTime))

          // Delay next try
          .delayWhen(() => Observable.timer(this.retryDelay * 1000))
      )
      // Process has run out of retries so either do nothing or stop observable by throwing.
      .catch<any, void>(err => this.watchMode ? Observable.empty() : Observable.throw(err));
  }

  shouldRetry($exitAfterMinUpTime: Observable<boolean>): (errors: Observable<number>) => Observable<void> {
    const hasRetriesLeft = $exitAfterMinUpTime
      .scan((retriesLeft, success) => success ? this.retries : retriesLeft - 1, this.retries)
      .map(retriesLeft => retriesLeft >= 0);

    return errors => errors
      .withLatestFrom(hasRetriesLeft)
      // Throw if not in watch mode or no retries left.
      .do(([err, retry]) => {
        if (!this.watchMode || !retry) {
          throw err;
        }
      })
      .mapTo<any, void>(void 0);
  }

  spawnScript(path: string): Observable<any> {
    return new Observable(obs => {
      const childProcess = this.child_process.spawn('node', [path], { stdio: 'inherit' });
      childProcess.on('close', code => {
        if (code !== 0) {
          obs.error(code);
          return;
        }

        obs.complete();
      });
      obs.next();

      return () => childProcess.kill('SIGTERM');
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
