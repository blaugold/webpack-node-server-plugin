import { ProcessModule } from './process';
import { ChildProcessModule } from './child_process';
import { Subject, Observable } from '@reactivex/rxjs';

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
  private cwd?: string;

  /**
   *
   * @param config.retries - Times the plugin tries to restart the script (3).
   * @param config.minUpTime - Times in seconds script has to stay up the reset retries (10).
   * @param config.retryDelay - Delay restring script after crash in seconds (1).
   * @param config.compilationDebounce - Debounce compilation emits by time in milli seconds (300).
   * @param config.cwd - Directory in which node process will spawn (cwd)
   */
  constructor(private process: ProcessModule,
              private child_process: ChildProcessModule, // tslint:disable-line
              config: {
                retries?: number
                retryDelay?: number
                minUpTime?: number
                compilationDebounce?: number;
                cwd?: string;
              } = {}) {
    this.initFromConfig(config);
    this.setupPipeline();
  }

  initFromConfig(config: any): void {
    this.retries             = defaultNumber(config.retries, 3);
    this.retryDelay          = defaultNumber(config.retryDelay, 1);
    this.minUpTime           = defaultNumber(config.minUpTime, 10);
    this.compilationDebounce = defaultNumber(config.compilationDebounce, 300);
    this.cwd = config.cwd;
  }

  setupPipeline(): void {
    this.$pipeline = this.$onDone
      .debounceTime(this.compilationDebounce)
      .let(this.getScriptPath())

      // Do nothing if compilation produced no executable.
      .filter(scriptPath => !!scriptPath)
      .switchMap<string, void>(scriptPath => this.runScript(scriptPath));
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

    return this.spawnScript(scriptPath, this.cwd)
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

  getScriptPath(): (statsObs: Observable<WebpackStats>) => Observable<string> {
    return statsObs => statsObs
      .map(stats => stats.compilation.assets)
      .map(assets => {
        const bundleName = Object.keys(assets).filter(fileName => fileName.match(/\.js$/))[0];
        return assets[bundleName];
      })
      .map(asset => asset.existsAt);
  }

  spawnScript(path: string, cwd?: string): Observable<any> {
    return new Observable(obs => {
      const childProcess = this.child_process.spawn('node', [path], { stdio: 'inherit', cwd });
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

function defaultNumber(option, def): number {
  if (option === undefined) {
    return def;
  }
  return option;
}

export class NodeServerPlugin extends _NodeServerPlugin {
  /**
   * Default for each option in brackets.
   * @param config.retries - Times the plugin tries to restart the script (3).
   * @param config.minUpTime - Times in seconds script has to stay up the reset retries (10).
   * @param config.retryDelay - Delay restring script after crash in seconds (1).
   * @param config.compilationDebounce - Debounce compilation emits by time in milli seconds (300).
   */
  constructor(config: {
    retries?: number
    retryDelay?: number
    minUpTime?: number
    compilationDebounce?: number;
  } = {}) {
    super(new ProcessModule(), new ChildProcessModule(), config);
  }
}
