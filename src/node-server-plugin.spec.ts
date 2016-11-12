/* tslint:disable */
import { _NodeServerPlugin } from './node-server-plugin';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { Subject } from 'rxjs';

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
    this.$nextEvent.filter(e => e.event === event).subscribe(e => cb(e.message));
  }

  kill(signal) {

  }
}

const getMockStats = () => ({
  compilation: {
    assets: {
      'test.bundle.js':     { existsAt: '/dir' },
      'test.bundle.js.map': { existsAt: '/dir' },
    },
  },
});

let child_process;
let child_processMock;

let process;
let nextTickSpy;
let exitSpy;

let runCompiler;
let watchCompiler;

let stats;

describe('NodeServerPlugin', () => {

  beforeEach(() => {
    child_process     = new ChildProcessModuleMock();
    child_processMock = sinon.mock(child_process);

    process     = new ProcessModuleMock();
    nextTickSpy = sinon.spy(process, 'nextTick');
    exitSpy     = sinon.spy(process, 'exit');

    runCompiler   = new CompilerMock(false);
    watchCompiler = new CompilerMock(true);

    stats = getMockStats();
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

  it('should use first js file in assets', () => {
    const plugin           = new _NodeServerPlugin(process, child_process);
    const childProcessMock = new ChildProcessMock();

    child_processMock
      .expects('spawn')
      .once()
      .withArgs('node', ['/dir'], { stdio: 'inherit' })
      .returns(childProcessMock);

    plugin.onDone(stats);

    expect(nextTickSpy.calledOnce).to.be.true;

    process.$nextTick.next();
  });

  it('should return exit code of script in run mode', () => {
    const plugin = new _NodeServerPlugin(process, child_process);
    plugin.apply(runCompiler);

    const childProcess = new ChildProcessMock();

    child_processMock.expects('spawn').returns(childProcess);

    plugin.onDone(stats);
    process.$nextTick.next();

    childProcess.$nextEvent.next({ event: 'close', message: 1 });

    expect(exitSpy.calledWith(1)).to.be.true;
  });

  it('should reset retry counter on new compilation', () => {
    const plugin       = new _NodeServerPlugin(process, child_process);
    const childProcess = new ChildProcessMock();

    child_processMock.expects('spawn').twice().returns(childProcess);

    plugin.apply(watchCompiler);
    plugin.onDone(stats);

    process.$nextTick.next();

    childProcess.$nextEvent.next({ event: 'close', message: 1 });

    expect(plugin.retryCount).to.equal(1);

    plugin.onDone(stats);

    expect(plugin.retryCount).to.equal(0);
  });

  it('should reset retry counter after min up time reached', () => {
    const plugin      = new _NodeServerPlugin(process, child_process);
    const clock       = sinon.useFakeTimers();
    plugin.retryCount = 1;
    plugin.startUpTimeCounter();
    // Default of 10 sec min up time
    clock.tick(10000);
    expect(plugin.retryCount).to.equal(0);
    clock.restore();
  });

  it('should back of after `retries`', () => {
    const plugin      = new _NodeServerPlugin(process, child_process);

    child_processMock.expects('spawn').never();

    // Default retries of 3
    plugin.retryCount = 3;

    plugin.handleCloseEvent(1)
  })
});
