'use strict';

/*
 * ENTRY POINT
 * Loads either the app or the read server depending on environment config.
 */

require(process.env.ENTRY_POINT === `read-server` ? `./readServer` : `./app`);
