'use strict';

/*
 * WORKFLOW: HOOKS
 * Functions for dealing with hooks.
 */

const path = require(`path`);

/*
 * Load and cache all the hooks in the top-level hooks directory (not its subdirectories).
 */
async function __loadHooks (directory) {

	const sharedLogger = this.__dep(`sharedLogger`);

	sharedLogger.debug(`Loading default and app hooks...`);

	const defaultHooksDirectory = path.join(__dirname, `../hooks`);
	const defaultHookFiles = await this.discoverFiles(defaultHooksDirectory, `js`, false);
	const appHookFiles = (directory ? await this.discoverFiles(directory, `js`, false) : []);
	const allHookFiles = defaultHookFiles.concat(...appHookFiles);

	// Load all of the hook files in turn.
	for (const hookFile of allHookFiles) {
		const hookName = this.parseFilename(hookFile, `js`);

		if (this.__getHook(hookName)) {
			throw new Error(`A hook with the name "${hookName}" has already been defined.`);
		}

		this.hooks[hookName] = {
			hookName,
			definition: require(hookFile), // eslint-disable-line global-require
		};
	}

	sharedLogger.debug(`${defaultHookFiles.length} default and ${appHookFiles.length} app hooks loaded.`);

}

/*
 * Returns the given hook by its name.
 */
function __getHook (hookName) {
	return this.hooks[(hookName || ``).toLowerCase()] || null;
}

/*
 * Export.
 */
module.exports = {
	__loadHooks,
	__getHook,
};
