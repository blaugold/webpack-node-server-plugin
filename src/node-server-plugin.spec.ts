/* tslint:disable */
import { _NodeServerPlugin, WebpackStats } from './node-server-plugin';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { Subject } from '@reactivex/rxjs';
import { SinonSpy, SinonMock } from 'sinon'

class CompilerMock {
  runSyp   = sinon.spy();
  watchSyp = sinon.spy();

  doneCallback: (stats) => void;

  constructor(private watch: boolean) {}

  plugin(event: string, cb: any) {
    switch (event) {
      case 'done':
        this.doneCallback = cb;
        break;
      case 'run':
        if (!this.watch) {
          cb(null, this.runSyp);
        }
        break;
      case 'watch-run':
        if (this.watch) {
          cb(null, this.watchSyp);
        }
        break;
      default:
    }
  }
}

class ProcessModuleMock {
  $nextTick = new Subject();

  nextTick(cb: () => void) {
    this.$nextTick.take(1).subscribe(() => cb());
  }

  exit(code: number) {

  }
}

class ChildProcessModuleMock {

  spawn() {

  }
}

class ChildProcessMock {
  $nextEvent = new Subject<{ event: string, message: any }>();

  on(event, cb) {
    this.$nextEvent
      .filter(e => e.event === event)
      .subscribe(e => cb(e.message));
  }

  kill(signal) {

  }
}

const getMockStats = () => ({
  compilation: {
    assets: {
      'test.bundle.js':     { existsAt: '/dir/test.bundle.js' },
      'test.bundle.js.map': { existsAt: '/dir/test.bundle.js.map' },
    },
  },
});

let child_process;
let child_processMock: SinonMock;

let process;
let nextTickSpy: SinonSpy;
let exitSpy: SinonSpy;

let runCompiler;
let watchCompiler;

let stats: WebpackStats;
let plugin: _NodeServerPlugin;

describe('NodeServerPlugin', () => {

  beforeEach(() => {
    child_process     = new ChildProcessModuleMock();
    child_processMock = sinon.mock(child_process);

    process     = new ProcessModuleMock();
    nextTickSpy = sinon.spy(process, 'nextTick');
    exitSpy     = sinon.spy(process, 'exit');

    runCompiler   = new CompilerMock(false);
    watchCompiler = new CompilerMock(true);

    stats = getMockStats() as any;

    plugin = new _NodeServerPlugin(process as any, child_process as any, {
      compilationDebounce: 0,
      retries:             1,
      retryDelay:          0,
      minUpTime:           1
    });
  });

  afterEach(() => {
    child_processMock.verify()
  });

  it('support run and watch', () => {
    new _NodeServerPlugin(process, child_process).apply(runCompiler);
    new _NodeServerPlugin(process, child_process).apply(watchCompiler);

    expect(runCompiler.runSyp.calledOnce).to.be.true;
    expect(watchCompiler.watchSyp.calledOnce).to.be.true;
  });

  describe('child process observable', () => {
    it('should emit when process starts', () => {
      const childProcess = new ChildProcessMock();
      child_processMock.expects('spawn').once().returns(childProcess);

      return plugin.spawnScript('/path')
        .mapTo('emit')
        .do(() => setTimeout(() => childProcess.$nextEvent.next({ event: 'close', message: 0 }), 0))
        .toPromise()
        .then(e => expect(e).to.equal('emit'))
    });

    it('should emit error when process finishes with other than 0', () => {
      const childProcess = new ChildProcessMock();
      child_processMock.expects('spawn').once().returns(childProcess);

      return plugin.spawnScript('/path')
        .do(() => setTimeout(() => childProcess.$nextEvent.next({ event: 'close', message: 1 }), 0))
        .toPromise()
        .then(() => {throw 'should not complete observable'})
        .catch(err => expect(err).to.equals(1))
    })
  });

  it('support single run by returning exit code of script', () => {
    const childProcess = new ChildProcessMock();
    child_processMock.expects('spawn').once().returns(childProcess);

    plugin.setWatchMode(false);

    const res = plugin.$pipeline.toPromise()
      .then(() => { throw 'should not complete observable' })
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
  })
});
