import { _NodeServerPlugin } from './src/node-server-plugin'
import { ProcessModule } from './src/process'
import { ChildProcessModule } from './src/child_process'

export class NodeServerPlugin extends _NodeServerPlugin {
  /**
   *
   * @param config.retried {number} - Times the plugin tries to restart the script.
   * @param config.minUpTime {number} - Times in seconds script has to stay up the reset retries.
   */
  constructor(config: {
    retries?: number
    minUpTime?: number
  } = {}) {
    super(new ProcessModule(), new ChildProcessModule(), config);
  }
}

module.exports = NodeServerPlugin;