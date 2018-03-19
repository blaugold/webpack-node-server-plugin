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

}
