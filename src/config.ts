import { SpawnOptions } from 'child_process';
import { WebpackStats } from './node-server-plugin';

export type ScriptPathResolver = (stats: WebpackStats) => string

export interface NodeServerPluginConfig {

  /**
   * Times the plugin tries to restart the script (3).
   */
  retries?: number;

  /**
   * Times in seconds script has to stay up the reset retries (10).
   */
  retryDelay?: number;

  /**
   * Delay restring script after crash in seconds (1).
   */
  minUpTime?: number;

  /**
   * Debounce compilation emits by time in milli seconds (300).
   */
  compilationDebounce?: number;

  /**
   * Signal sent to process when restarting. Default is `SIGKILL`.
   */
  killSignal?: string;

  /**
   * Command used when spawning the child process. Default is `node`.
   */
  command?: string;

  /**
   * Options used when spawning the child process. Per default `stdio` is set to `inherit`.
   */
  spawnOptions?: SpawnOptions;

  /**
   * Arguments given to spawned child process in addition to script path.
   *
   * The script path is appended to `commandArgs` before spawning.
   *
   * Useful for example to start node with `--inspect` flag.
   */
  commandArgs?: string[];

  /**
   * Function which is called after each compilation and takes `WebpackStats` and returns the path
   * to the script to run.
   *
   * Defaults to `getFirstJSTargetBundlePath`, which uses the first build target with the
   * extension `.js`.
   */
  scriptPathResolver?: ScriptPathResolver;

}
