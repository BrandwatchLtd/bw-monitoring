const assert = require('assert');
const sinon = require('sinon');

const mon = require('../src/index.js');

describe('bw-monitoring', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {};
    res = {
      header: () => {},
      sendStatus: sinon.spy(),
      send: sinon.spy(),
    };
    next = sinon.spy();
  });

  afterEach(() => {
    mon.reset();
  });

  describe('/healthz endpoint', () => {
    beforeEach(() => {
      req.path = '/healthz';
    });

    it('should return 200 by default', (done) => {
      const mid = mon.getMiddleware();
      mid(req, res, next)
        .then(() => {
          assert(res.sendStatus.calledWith(200), true);
          done();
        });
    });

    it('should return 200 if all checks succeed', (done) => {
      mon.addReadinessCheck({ name: 'bob', check: (ok) => ok() });
      mon.addReadinessCheck({ name: 'bob2', check: (ok) => ok() });
      const mid = mon.getMiddleware();
      mid(req, res, next)
        .then(() => {
          assert(res.sendStatus.calledWith(200), true);
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
          assert(res.sendStatus.calledWith(500), true);
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
          assert(res.sendStatus.calledWith(404), true);
          done();
        });
    });

    it('can be configured to do checks that succeed', (done) => {
      mon.addHealthCheck({ name: 'bob0', check: (ok) => ok() });
      mon.addHealthCheck({ name: 'bob1', check: (ok) => ok() });
      const mid = mon.getMiddleware();
      mid(req, res, next)
        .then(() => {
          assert(res.send.calledWith('bob0 0\nbob1 0\n'), true);
          done();
        });
    });

    it('can be configured to do checks that warn and fail', (done) => {
      mon.addHealthCheck({ name: 'bob0', check: (ok) => ok() });
      mon.addHealthCheck({ name: 'bob1', check: (ok, warning) => warning() });
      mon.addHealthCheck({ name: 'bob2', check: (ok, warning, critical) => critical() });
      mon.addHealthCheck({ name: 'bob3', check: (ok, warning, critical, unknown) => unknown() });
      const mid = mon.getMiddleware();
      mid(req, res, next)
        .then(() => {
          assert(res.send.calledWith('bob0 0\nbob1 1\nbob2 2\nbob3 3\n'), true);
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
          assert(res.sendStatus.calledWith(404), true);
          done();
        });
    });

    it('should return some generic metrics if passed in', (done) => {
      mon.addMetrics(() => 'some string basically');
      const mid = mon.getMiddleware();
      mid(req, res, next)
        .then(() => {
          assert(res.send.calledWith('some string basically'), true);
          done();
        });
    });
  });
});
