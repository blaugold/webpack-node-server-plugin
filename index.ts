import { _NodeServerPlugin } from './src/node-server-plugin'
import { ProcessModule } from './src/process'
import { ChildProcessModule } from './src/child_process'

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

module.exports = NodeServerPlugin;