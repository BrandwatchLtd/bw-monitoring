# bw-monitoring

## Version 3 now available with zero runtime dependencies, requires Node >=14.18.0.

# Usage

`@brandwatch/monitoring` is Express middleware that exposes a collection of standardised endpoints for monitoring infrastructure (e.g. Prometheus) to consume.

`npm i @brandwatch/monitoring`

The package is published to brandwatch private artifactory repo, and therefore npmrc will need to be setup.
`npm login --registry https://artifactory.brandwatch.com/artifactory/api/npm/npm/` Can be run to setup a local npmrc, however, for the service to install & use this package
the npmrc must be mounted. For example see https://github.com/BrandwatchLtd/application-service/blob/main/service/Dockerfile#L19

`@brandwatch/monitoring` exports a function `getMiddleware` which returns an express middleware to pass to `expressApp.use`. This adds standard routes `/healthz`, `/metricz`, `/checkz`.

```js
var monitoring = require('@brandwatch/monitoring');
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

## /livez

The `/livez` endpoint is the same as `/checkz`, and checks are added the same way (via `bwMonitoring.addCheck()`.  However if any check fails it will return a `500` status code.  The content of the body will also be only the failed check

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

# Deployment

This package is deployed to artifactory. It has no build step or dependencies.
To publish a new verison of this package:

1. Merge changes from PR into master/main branch.
2. Checkout master branch
3. Version the package accordingly with [semver](https://semver.org/) `npm version major|minor|patch`
4. Publish version to artifactory `npm run publish` (the `prepublishOnly` hook will ensure tests pass first)
5. Commit the version change & push the tags to remote
  ```
    git add .
    git commit -m 'chore: publish vX.X.X'
    git push && git push --tags
  ```

Assuming all steps were successfull a new version of the package will be available for usage in consuming apps.
