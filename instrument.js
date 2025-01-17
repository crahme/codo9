// Import with `import * as Sentry from "@sentry/node"` if you are using ESM
const Sentry = require("@sentry/node");

Sentry.init({
  dsn: "https://018a258fe683ef5f62b25f5741f88049@o4508613584355328.ingest.us.sentry.io/4508614047694848",
});

// IMPORTANT: Make sure to import `instrument.js` at the top of your file.
// If you're using ECMAScript Modules (ESM) syntax, use `import "./instrument.js";`
require("./instrument.js");

// All other imports below
const { createServer } = require("node:http");

const server = createServer((req, res) => {
  // server code
});

server.listen(3000, "127.0.0.1");


const Sentry = require("@sentry/node");

try {
  foo();
} catch (e) {
  Sentry.captureException(e);
}
