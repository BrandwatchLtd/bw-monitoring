# bw-monitoring

#  [![NPM version][npm-image]][npm-url] [![Build Status][travis-image]][travis-url] [![Dependency Status][daviddm-image]][daviddm-url]


`bw-monitoring` is Express middleware that exposes a collection of standardised endpoints for monitoring infrastructure (e.g. Prometheus) to consume.

`npm install --save bw-monitoring`

`bw-monitoring` exports a function `getMiddleware` which returns an express middleware to pass to `expressApp.use`. This adds standard routes `/healthz`, `/metricz`, `/checkz`.

```js
var monitoring = require('bw-monitoring');
expressApp.use(monitoring.getMiddleware());
```

## /checkz

By default `/checkz` returns a `404` status code. It can be configured to perform arbitrary checks of application dependencies using `bwMonitoring.addCheck()`.

#### `monitoring.addCheck`

```js
var postgresCheck = {
  name: 'postgres',
  check: (ok, warning, critical, unknown) => {
    pgConnection.query.raw('SELECT version();', [])
      .then(ok)
      .catch(critical);
  }
}
monitoring.addCheck(postgresCheck);

```

With this check added the endpoint will return 200 with a body showing the result of any checks in prometheus compatible data format. E.g...

```
postgres 0
```

## /healthz

By default `/healthz` returns a `200` status code. This can be used as a sensible default in a Kubernetes readinessProbe, and all it does is check that the express server is serving correctly. It checks no upstream dependencies for health, although it can be configured to do this using `addReadinessCheck`.

#### `monitoring.addReadinessCheck`

To add specific checks to a readinessProbe (e.g. can connect to postgres) use the `addReadinessCheck` method. `addReadinessCheck` takes the exact same style of check as `addCheck`, meaning we can re-use the postgres check from above if desirable. E.g...

```js
monitoring.addReadinessCheck(postgresCheck);

```

*NB: Do not configure explicit readiness checks unless you have a tier infront of your application that can serve appropriate error pages (e.g nginx). If all you have is dumb TCP/HTTP load-balancing, then keep forwarding requests to the application so it can deal with errors itself when an upstream dependency is failing.*


## /metricz

By default `/metricz` returns a `404` status code.

#### `monitoring.addMetrics`

It can be configured with a function to query for Prometheus style metrics and will expose them in a compatible data format.

```js
var prometheus = require('prom-client');
var c = new Counter('my_counter');
setTimeout(c.inc, 200);
monitoring.addMetrics(() => prometheus.register.metrics());
```

[npm-image]: https://badge.fury.io/js/bw-monitoring.svg
[npm-url]: https://npmjs.org/package/bw-monitoring
[travis-image]: https://travis-ci.org/BrandwatchLtd/bw-monitoring.svg?branch=master
[travis-url]: https://travis-ci.org/BrandwatchLtd/bw-monitoring
[daviddm-image]: https://david-dm.org/BrandwatchLtd/bw-monitoring.svg?theme=shields.io
[daviddm-url]: https://david-dm.org/BrandwatchLtd/bw-monitoring
