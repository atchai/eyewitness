'use strict';

/*
 * ENTRY POINT
 * Loads either the bot or the read server depending on environment config.
 */

require(process.env.ENTRY_POINT === `read-server` ? `./readServer` : `./bot`);
// Ensure we always work relative to this script.
process.chdir(__dirname);

