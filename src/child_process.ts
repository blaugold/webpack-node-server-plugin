
import { ChildProcess } from 'child_process';
import { SpawnOptions } from 'child_process';
import { spawn } from 'child_process';

export class ChildProcessModule {
  spawn(command: string, args: string[], options: SpawnOptions): ChildProcess {
    return spawn(command, args, options);
  }
}
