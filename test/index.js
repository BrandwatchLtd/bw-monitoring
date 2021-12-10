const assert = require('assert');
const sinon = require('sinon');

const mon = require('../src/index.js');

describe('bw-monitoring', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {
      connection: {
        remoteAddress: '127.0.0.1'
      }
    };
    res = {
      set: sinon.spy(),
      sendStatus: sinon.spy(),
      status: sinon.spy(),
      send: sinon.spy(),
    };
    next = sinon.spy();
  });

  afterEach(() => {
    mon.reset();
  });

  it('ignores unrequired url paths', () => {
    req.path = '/your-app';
    const mid = mon.getMiddleware();
    mid(req, res, next);
    assert(next.called);
  });

  describe('IP filtering', () => {
    beforeEach(() => {
      req.path = '/healthz';
    });

    it('Filters out non-private IPs', () => {
      const mid = mon.getMiddleware();
      req.connection.remoteAddress = '4.4.4.4';
      mid(req, res, next);
      assert(next.called);
    });
  });

  describe('/healthz endpoint', () => {
    beforeEach(() => {
      req.path = '/healthz';
    });

    it('should return 200 by default', (done) => {
      const mid = mon.getMiddleware();
      mid(req, res, next)
        .then(() => {
          assert(res.sendStatus.calledWith(200));
          done();
        });
    });

    it('should return 200 if all checks succeed', (done) => {
      mon.addReadinessCheck({ name: 'bob', check: (ok) => ok() });
      mon.addReadinessCheck({ name: 'bob2', check: (ok) => ok() });
      const mid = mon.getMiddleware();
      mid(req, res, next)
        .then(() => {
          assert(res.sendStatus.calledWith(200));
          done();
        });
    });

    it('should return 500 if any check fails', (done) => {
      mon.addReadinessCheck({ name: 'bob', check: (ok) => ok() });
      mon.addReadinessCheck({ name: 'bob2', check: (ok, warning) => warning() });
      mon.addReadinessCheck({ name: 'bob2', check: (ok, warning, critical) => critical() });
      mon.addReadinessCheck({ name: 'bob2', check: (ok, warning, critical, unknown) => unknown() });
      const mid = mon.getMiddleware();
      mid(req, res, next)
        .then(() => {
          assert(res.sendStatus.calledWith(500));
          done();
        });
    });
  });

  describe('/checkz endpoint', () => {
    beforeEach(() => {
      req.path = '/checkz';
    });

    it('should return 404 by default', (done) => {
      const mid = mon.getMiddleware();
      mid(req, res, next)
        .then(() => {
          assert(res.sendStatus.calledWith(404));
          done();
        });
    });

    it('can be configured to do checks that succeed', (done) => {
      mon.addCheck({ name: 'bob0', check: (ok) => ok() });
      mon.addCheck({ name: 'bob1', check: (ok) => ok() });
      const mid = mon.getMiddleware();
      mid(req, res, next)
        .then(() => {
          assert(res.send.calledWith('bob0 0\nbob1 0\n'));
          done();
        });
    });

    it('can be configured to do checks that warn and fail', (done) => {
      mon.addCheck({ name: 'bob0', check: (ok) => ok() });
      mon.addCheck({ name: 'bob1', check: (ok, warning) => warning() });
      mon.addCheck({ name: 'bob2', check: (ok, warning, critical) => critical() });
      mon.addCheck({ name: 'bob3', check: (ok, warning, critical, unknown) => unknown() });
      const mid = mon.getMiddleware();
      mid(req, res, next)
        .then(() => {
          assert(res.send.calledWith('bob0 0\nbob1 1\nbob2 2\nbob3 3\n'));
          done();
        });
    });
  });

  describe('/livez endpoint', () => {
    beforeEach(() => {
      req.path = '/livez';
    });

    it('should return 200 by default', (done) => {
      const mid = mon.getMiddleware();
      mid(req, res, next)
        .then(() => {
          assert(res.sendStatus.calledWith(200));
          done();
        });
    });

    it('can be configured to do checks that succeed', (done) => {
      mon.addCheck({ name: 'bob0', check: (ok) => ok() });
      mon.addCheck({ name: 'bob1', check: (ok) => ok() });
      const mid = mon.getMiddleware();
      mid(req, res, next)
        .then(() => {
          assert(res.status.calledWith(200));
          assert(res.send.calledWith('bob0 0\nbob1 0\n'));
          done();
        });
    });

    it('can be configured to do checks that warn and fail', (done) => {
      mon.addCheck({ name: 'bob0', check: (ok) => ok() });
      mon.addCheck({ name: 'bob1', check: (ok, warning) => warning() });
      mon.addCheck({ name: 'bob2', check: (ok, warning, critical) => critical() });
      mon.addCheck({ name: 'bob3', check: (ok, warning, critical, unknown) => unknown() });
      const mid = mon.getMiddleware();
      mid(req, res, next)
        .then(() => {
          assert(res.status.calledWith(500));
          assert(res.send.calledWith('bob0 0\nbob1 1\nbob2 2\nbob3 3\n'));
          done();
        });
    });
  });

  describe('/metricz endpoint', () => {
    beforeEach(() => {
      req.path = '/metricz';
    });

    it('should return 404 by default', (done) => {
      const mid = mon.getMiddleware();
      mid(req, res, next)
        .then(() => {
          assert(res.sendStatus.calledWith(404));
          done();
        });
    });

    it('should return some generic metrics if passed in', (done) => {
      mon.addMetrics(() => 'some string basically');
      const mid = mon.getMiddleware();
      mid(req, res, next)
        .then(() => {
          assert(res.send.calledWith('some string basically'));
          done();
        });
    });

    it('should resolve a promise containing metrics', (done) => {
      mon.addMetrics(async () => 'a string that was promised');
      const mid = mon.getMiddleware();
      mid(req, res, next).then(() => {
        assert(res.send.calledWith('a string that was promised'));
        done();
      });
    });
  });

  describe('Content-Type header', () => {
    it('is not set if no paths match', () => {
      req.path = '/nothing-interesting';
      const mid = mon.getMiddleware();
      mid(req, res, next);
      assert.equal(res.set.callCount, 0);
    });

    it('is set for /metricz', () => {
      req.path = '/metricz';
      const mid = mon.getMiddleware();
      mid(req, res, next);
      assert.equal(res.set.callCount, 1);
    });

    it('is set for /checkz', () => {
      req.path = '/checkz';
      const mid = mon.getMiddleware();
      mid(req, res, next);
      assert.equal(res.set.callCount, 1);
    });

    it('is set for /livez', () => {
      req.path = '/livez';
      const mid = mon.getMiddleware();
      mid(req, res, next);
      assert.equal(res.set.callCount, 1);
    });

    it('is set for /healthz', () => {
      req.path = '/healthz';
      const mid = mon.getMiddleware();
      mid(req, res, next);
      assert.equal(res.set.callCount, 1);
    });
  });
});
