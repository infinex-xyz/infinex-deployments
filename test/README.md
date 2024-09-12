# Deployment Acceptance Tests

The contracts repo has tests for contract functionality; tests here are designed to verify that contracts have been correctly deployed. Examples of issues we're trying to catch:

- Contracts not configured properly because of typos (both in variable names and values)
- Contract configuration inconsistent with Platform app
- Multisig transactions still pending
- Two-step ownership transfers still pending
- Third-party dependencies not available in a given chain
- Wrong third-party contract addresses used in a given chain
- Gas wallets not having funds
- Contract upgrades not complete

## Basic usage

### Set up configuration vars

To create default `.env.testnet` and `.env.mainnet` files:

```
pnpm run init
```

Public RPC endpoints are used by default.

### Run tests and view reports

```
pnpm run test:testnets
```

After running tests, you'll get reports in the `./report/` directory.

- Markdown report in `./report/report.md`
- JSON report in `./report/report.json`
- Web report in `./report/index.html`

To view the web report, use `pnpm run serve` in a terminal and browse to http://localhost:4173/. You can keep the server running, but you'll need to manually refresh the page in your browser to see updated test runs. Click "View Test Source Code" to the right of test names to see more info (including details of failed tests).

#### Manual test running

If you want more control (e.g., when writing tests for a new deployment), you can run tests manually. This runs just the `appregistry` tests against the `testnets` environment:

```
ENV=testnets npx vitest --run appregistry
```

## Work-in-progress deployments and known special cases

A complete deployment should be all green, but it's normal to have some red when a deployment is in progress.

If you do need to mark a test as known to fail for some reason, you can

- Make it a [TODO test](https://vitest.dev/api/#test-todo) (affects all environments)
- Use [`skipIf`](https://vitest.dev/api/#test-skipif) (can be made environment/chain specific)
- Use the [`skip()` function from context](https://vitest.dev/guide/test-context#context-skip) (fine-grained control)
