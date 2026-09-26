# First steps regression

From the repository root:

```sh
npm install --prefix tests --no-save --package-lock=false jsdom@30.1.1
node --test tests/first-steps-modal.cjs
```

Requires Node.js 22.13+ (jsdom requirement). The test exercises the real guide script with a small DOM fixture, opens and reopens income and expense modals, and verifies that the observer settles and the guide returns after closing. A bounded observer turns the former infinite microtask loop into an assertion failure instead of hanging the runner.
