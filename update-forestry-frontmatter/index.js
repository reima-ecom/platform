#!/usr/bin/env node
/* eslint-disable no-console */

import updateFrontmatter from './workflows.js';

const [,, sourceDir, targetDir] = process.argv;

updateFrontmatter(sourceDir, targetDir).then((eventLog) => {
  eventLog.forEach((logEntry) => {
    console.log(logEntry);
  });
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
