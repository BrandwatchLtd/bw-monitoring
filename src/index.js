/**
 * Configure a ExpressJS middleware to expose useful health/metrics/checks endpoints.
 */
const net = require('net');

// Default empty configuration
let metrics;
let readinessChecks = [];
let healthChecks = [];

const prometheusContentType = 'text/plain; version=0.0.4';

// Expect only requests in this range to get access to
// the health/metrics/checks endpoints
const blocklist = new net.BlockList();
blocklist.addSubnet('10.0.0.0', 8);

const doCheck = ({ name, check }) => new Promise((resolve) => {
  // Pass in the [ok, warning, critical, unknown] callbacks. i.e. just resolve the promise.
  check(
    () => { resolve({ name, value: 0 }); },
    () => { resolve({ name, value: 1 }); },
    () => { resolve({ name, value: 2 }); },
    () => { resolve({ name, value: 3 }); }
  );
});

const doReadinessCheck = ({ check }) => new Promise((resolve, reject) => {
  check(resolve, reject, reject, reject);
});

const toPrometheusFormat = (str, { name, value }) => `${str}${name} ${value}\n`;

const addCheck = (check) => healthChecks.push(check);
const addReadinessCheck = (check) => readinessChecks.push(check);
const addMetrics = (m) => { metrics = m; };

const getMiddleware = ({ debug = false } = {}) => (req, res, next) => {
  const requestingIP = req.ip || req.connection.remoteAddress
                       || req.socket.remoteAddress || req.connection.socket.remoteAddress;

  // Only expect private IPs from this range
  const ipVersion = net.isIPv6(requestingIP) ? 'ipv6' : 'ipv4';

  if (!blocklist.check(requestingIP, ipVersion)) {
    if (debug) {
      // eslint-disable-next-line no-console
      console.debug(`Blocking request from ${requestingIP}`);
    }

    return next();
  }

  if (req.path === '/healthz') {
    res.set('Content-Type', prometheusContentType);

    if (readinessChecks.length < 1) {
      return Promise.resolve().then(() => res.sendStatus(200));
    }

    const promisedChecks = readinessChecks.map((check) => new Promise((resolve, reject) => {
      doReadinessCheck(check)
        .then(resolve)
        .catch(reject);
    }));

    return Promise.all(promisedChecks)
      .then(() => res.sendStatus(200))
      .catch(() => res.sendStatus(500));
  }

  // Run the checks and return in prometheus formats
  if (req.path === '/checkz') {
    res.set('Content-Type', prometheusContentType);

    if (healthChecks.length < 1) {
      return Promise.resolve().then(() => res.sendStatus(404));
    }

    const promisedChecks = healthChecks.map((check) => new Promise((resolve, reject) => {
      doCheck(check)
        .then(resolve)
        .catch(reject);
    }));

    return Promise.all(promisedChecks)
      .then((check) => res.send(
        check.reduce(toPrometheusFormat, '')
      ));
  }

  // Run the checks and error if the app is not healthy
  if (req.path === '/livez') {
    res.set('Content-Type', prometheusContentType);

    if (healthChecks.length < 1) {
      return Promise.resolve().then(() => res.sendStatus(200));
    }

    const promisedChecks = healthChecks.map((check) => new Promise((resolve, reject) => {
      doCheck(check)
        .then(resolve)
        .catch(reject);
    }));

    return Promise.all(promisedChecks)
      .then((statuses) => {
        const badStatuses = statuses.filter(({ value }) => value !== 0);
        if (badStatuses.length === 0) {
          res.status(200);
        } else {
          res.status(500);
        }
        res.send(statuses.reduce(toPrometheusFormat, ''));
      });
  }

  // Send any prometheus metrics specified
  if (req.path === '/metricz') {
    res.set('Content-Type', prometheusContentType);

    if (!metrics) {
      return Promise.resolve().then(() => res.sendStatus(404));
    }

    return Promise.resolve(metrics()).then((actualMetrics) => res.send(actualMetrics));
  }

  return next();
};

const reset = () => {
  metrics = undefined;
  readinessChecks = [];
  healthChecks = [];
};

module.exports = {
  addCheck,
  addReadinessCheck,
  addMetrics,
  getMiddleware,
  reset,
};
