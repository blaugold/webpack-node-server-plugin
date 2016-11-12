import { ChildProcess } from 'child_process';
import Timer = NodeJS.Timer;
import { ProcessModule } from './process';
import { ChildProcessModule } from './child_process';

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
  retryCount: number                = 0;

  private childProcess: ChildProcess;
  private watchMode: boolean;
  private bundlePath: string;
  private retries: number;
  private minUpTime: number;
  private minUpTimeTimeout: Timer   = null;
  private reachedMinUpTime: boolean = false;

  /**
   *
   * @param config.retried {number} - Times the plugin tries to restart the script.
   * @param config.minUpTime {number} - Times in seconds script has to stay up the reset retries.
   */
  constructor(private process: ProcessModule,
              private child_process: ChildProcessModule, // tslint:disable-line
              config: {
                retries?: number
                minUpTime?: number
              } = {}) {
    this.retries   = config.retries || 3;
    this.minUpTime = config.minUpTime || 10;
  }

  apply(compiler) {

    // Register callback to start server when compiler is done.
    compiler.plugin('done', this.onDone.bind(this));

    // Detect whether compiler is in watch mode.
    compiler.plugin('run', (_, cb) => {
      this.watchMode = false;
      cb();
    });
    compiler.plugin('watch-run', (_, cb) => {
      this.watchMode = true;
      cb();
    });
  }

  onDone(stats) {
    // Kill possible outdated version of server.
    this.killProcess();

    // Reset retry counter.
    this.retryCount = 0;

    // Resolve bundle by using name of first asset which ends in .js.
    // TODO multiple assets (choose one in config or start multiple)
    const assets     = stats.compilation.assets;
    const bundleName = Object.keys(assets).filter(fileName => fileName.match(/\.js$/))[0];
    this.bundlePath  = assets[bundleName].existsAt;

    // Spawn new server process in next turn to let all compiler callbacks finish.
    this.process.nextTick(() => {
      console.log('\n');
      this.spawnProcess();
    });
  }

  spawnProcess() {
    // If server fails to stay up after set retries wait for next compilation.
    if (this.hasRetriesLeft()) {

      if (this.retryCount === 0) {
        console.log('NodeServerPlugin: Starting server');
      }
      else {
        console.log(`NodeServerPlugin: Retrying to start server (count: ${this.retryCount})`);
      }

      // Spawn bundle as node process and inherit stdio to make output visible.
      this.childProcess = this.child_process.spawn('node', [this.bundlePath], { stdio: 'inherit' });
      this.startUpTimeCounter();

      // Handle end of process.
      this.childProcess.on('close', this.handleCloseEvent.bind(this));
    }
  }

  handleCloseEvent(code: number) {
    if (code !== 0) {
      this.clearUpTimeCounter();
      console.error(`NodeServerPlugin: Server exited with code ${code}`);

      if (!this.hasRetriesLeft()) {
        console.log(
          `NodeServerPlugin: Baking of after ${this.retryCount} failed tries.`
        );
      }
    }

    // If this was a single run exit process with code returned by process.
    // Useful to detect whether server crashed in bash command.
    if (!this.watchMode) {
      this.process.exit(code);
    }

    // If code 0 is returned server exited without error so don't retry.
    else if (code !== 0) {

      // Kick of a new try to get server running.
      this.spawnProcess();
    }
  }

  /** @internal */
  startUpTimeCounter() {
    this.minUpTimeTimeout = setTimeout(() => {
      this.reachedMinUpTime = true;
      this.retryCount       = 0;
    }, this.minUpTime * 1000);
  }

  /** @internal */
  clearUpTimeCounter() {
    // Clear timeout.
    if (this.minUpTimeTimeout !== null) {
      clearTimeout(this.minUpTimeTimeout);
      this.minUpTimeTimeout = null;
    }

    // Increment retry counter if script did not stay up.
    if (!this.reachedMinUpTime) {
      this.retryCount++;
    }

    // Reset `reached time out` flag
    this.reachedMinUpTime = false;
  }

  private hasRetriesLeft(): boolean {
    return this.retryCount < this.retries;
  }

  private killProcess() {
    if (this.childProcess) {
      console.log('NodeServerPlugin: Stopping server');
      this.childProcess.kill('SIGTERM');
      this.childProcess = null;
    }
  }
}
