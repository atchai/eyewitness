'use strict';

/*
 * ENTRY POINT
 * Loads either the bot or the read server depending on environment config.
 */

/* eslint-disable global-require */

// Ensure we always work relative to this script.
process.chdir(__dirname);

// Include the appropriate entry point.
let entryPointFilename;

switch (process.env.ENTRY_POINT) {
	case `read-server`: entryPointFilename = `./readServer`; break;
	case `bot`: entryPointFilename = `./bot`; break;
	default: entryPointFilename = null; break;
}

if (entryPointFilename) {
	require(entryPointFilename);
}
