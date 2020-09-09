#!/usr/bin/env node
/* eslint-disable no-console */

import updateFrontmatter from './workflows.ts';

const [githubRepo, targetDir = "."] = Deno.args;

updateFrontmatter(githubRepo, targetDir).then((eventLog) => {
  eventLog.forEach((logEntry) => {
    console.log(logEntry);
  });
}).catch((error) => {
  console.error(error);
  Deno.exit(1);
});
