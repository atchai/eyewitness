'use strict';

/*
 * WORKFLOW: MATCHING
 * Functions for dealing with matching user input against a dictionary of matches.
 */

const path = require(`path`);
const escapeRegExp = require(`escape-regexp`);

/*
 * Returns the given match file by its name.
 */
function __getMatchFile (matchFileName) {
	return this.matchFiles[(matchFileName || ``).toLowerCase()] || null;
}

/*
 * Load and cache all the match files in the top-level matches directory (not its subdirectories).
 */
async function __loadMatchFiles (directory) {

	const sharedLogger = this.__dep(`sharedLogger`);

	sharedLogger.debug(`Loading default and app match files...`);

	const defaultMatchesDirectory = path.join(__dirname, `../matches`);
	const defaultMatchFiles = await this.discoverFiles(defaultMatchesDirectory, `json`, false);
	const appMatchFiles = (directory ? await this.discoverFiles(directory, `json`, false) : []);
	const allMatchFiles = defaultMatchFiles.concat(...appMatchFiles);

	// Load all of the match files in turn.
	for (const matchFile of allMatchFiles) {
		const matchName = this.parseFilename(matchFile, `json`);

		if (this.__getMatchFile(matchName)) {
			throw new Error(`A match file with the name "${matchName}" has already been defined.`);
		}

		this.matchFiles[matchName] = {
			matchName,
			definition: await this.parseJsonFile(matchFile), // eslint-disable-line no-await-in-loop
		};
	}

	sharedLogger.debug(`${defaultMatchFiles.length} default and ${appMatchFiles.length} app match files loaded.`);

}

/*
 * Returns true if one of the given match values matches the given message text.
 */
async function doesTextMatch (matches, text) {

	// Check each of the matches.
	for (const matchValue in matches) {
		if (!matches.hasOwnProperty(matchValue)) { continue; }

		const matchType = matches[matchValue];

		switch (matchType) {

			// If the value is falsy we just skip this match.
			case false:
			case null:
			case ``:
				continue;

			// Escape the regexp and match against it.
			case `regexp`:
				if (text.match(new RegExp(matchValue, `i`))) { return true; }
				break;

			// Load the value list file and match against it recursively.
			case `match-file`: {
				const matchFile = this.__getMatchFile(matchValue);
				if (!matchFile) { throw new Error(`Match file "${matchValue}" is not defined.`); }
				if (await doesTextMatch(matchFile.definition, text)) { return true; } // eslint-disable-line no-await-in-loop
				break;
			}

			// An other types are considered to be string matches.
			default:
			case `string`:
				if (text.match(new RegExp(`^${escapeRegExp(matchValue)}$`, `i`))) { return true; }
				break;

		}
	}

	// No matches for this message.
	return false;

}

/*
 * Export.
 */
module.exports = {
	__getMatchFile,
	__loadMatchFiles,
	doesTextMatch,
};
