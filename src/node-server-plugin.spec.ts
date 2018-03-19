import { expect } from 'chai';
import { Subject } from 'rxjs';
import { filter, mapTo, take, tap } from 'rxjs/operators';
import * as sinon from 'sinon';
import { SinonMock, SinonSpy } from 'sinon';
import { SyncHook } from 'tapable';
/* tslint:disable */

import { _NodeServerPlugin, WebpackStats } from './node-server-plugin';

class CompilerMock {

  hooks = {
    done:     new SyncHook(),
    run:      new SyncHook(),
    watchRun: new SyncHook(),
  };

}

class ProcessModuleMock {
  $nextTick = new Subject();

  nextTick(cb: () => void) {
    this.$nextTick.pipe(take(1)).subscribe(() => cb());
  }

  exit(code: number) {}

}

class ChildProcessModuleMock {

  spawn() {}

}

interface Event {
  event: string;
  message: any;
}

class ChildProcessMock {

  $nextEvent = new Subject<Event>();

  on(event, cb) {
    this.$nextEvent.pipe(
      filter<Event>(e => e.event === event),
    )
      .subscribe(e => cb(e.message));
  }

  kill(signal) {}

}

const getMockStats = () => ({
  compilation: {
    assets: {
      'test.bundle.js':     { existsAt: '/dir/test.bundle.js' },
      'test.bundle.js.map': { existsAt: '/dir/test.bundle.js.map' },
    },
  },
  toJson() { return ''; },
} as WebpackStats);

let child_process;
let child_processMock: SinonMock;

let process;
let nextTickSpy: SinonSpy;
let exitSpy: SinonSpy;

let compiler: CompilerMock;

let stats: WebpackStats;
let plugin: _NodeServerPlugin;

describe('NodeServerPlugin', () => {

  beforeEach(() => {
    child_process     = new ChildProcessModuleMock();
    child_processMock = sinon.mock(child_process);

    process = new ProcessModuleMock();

    nextTickSpy = sinon.spy(process, 'nextTick');
    exitSpy     = sinon.spy(process, 'exit');

    compiler = new CompilerMock();

    stats = getMockStats() as any;

    plugin = new _NodeServerPlugin(process as any, child_process as any, {
      compilationDebounce: 0,
      retries:             1,
      retryDelay:          0,
      minUpTime:           1,
    });
  });

  afterEach(() => {
    child_processMock.verify();
  });

  it('support run mode', () => {
    const plugin = new _NodeServerPlugin(process, child_process);
    plugin.apply(compiler);
    compiler.hooks.run.call();

    expect((plugin as any).watchMode).to.be.false;
  });

  it('support watch mode', () => {
    const plugin = new _NodeServerPlugin(process, child_process);
    plugin.apply(compiler);
    compiler.hooks.watchRun.call();

    expect((plugin as any).watchMode).to.be.true;
  });

  describe('child process observable', () => {

    it('should emit when process starts', () => {
      const childProcess = new ChildProcessMock();
      child_processMock.expects('spawn').once().returns(childProcess);

      return plugin.spawnScript(getMockStats()).pipe(
        mapTo('emit'),
        tap(() => setTimeout(() => childProcess.$nextEvent
          .next({ event: 'close', message: 0 }), 0),
        ),
      )
        .toPromise()
        .then(e => expect(e).to.equal('emit'));
    });

    it('should emit error when process finishes with other than 0', () => {
      const childProcess = new ChildProcessMock();
      child_processMock.expects('spawn').once().returns(childProcess);

      return plugin.spawnScript(getMockStats()).pipe(
        tap(() => setTimeout(() => childProcess.$nextEvent
          .next({ event: 'close', message: 1 }), 0),
        ),
      )
        .toPromise()
        .then(() => {throw 'should not complete observable';})
        .catch(err => expect(err).to.equals(1));
    });
  });

  it('support single run by returning exit code of script', () => {
    const childProcess = new ChildProcessMock();
    child_processMock.expects('spawn').once().returns(childProcess);

    plugin.setWatchMode(false);

    const res = plugin.$pipeline.toPromise()
      .then(() => { throw 'should not complete observable'; })
      .catch(code => expect(code).to.equal(1));

    plugin.$onDone.next(stats);

    setTimeout(() => childProcess.$nextEvent.next({ event: 'close', message: 1 }), 0);

    return res;
  });

  it('should support restarting script', done => {
    const childProcess0 = new ChildProcessMock();
    const childProcess1 = new ChildProcessMock();
    child_processMock.expects('spawn')
      .twice()
      .onCall(0).returns(childProcess0)
      .onCall(1).returns(childProcess1);

    plugin.setWatchMode(true);
    plugin.$pipeline.subscribe();
    plugin.$onDone.next(stats);

    setTimeout(() => childProcess0.$nextEvent.next({ event: 'close', message: 1 }), 0);
    setTimeout(() => childProcess1.$nextEvent.next({ event: 'close', message: 1 }), 20);

    setTimeout(() => done(), 40);
  });

});
