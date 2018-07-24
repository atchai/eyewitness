'use strict';

/*
 * WORKFLOW: FILE MANAGEMENT
 * Functions for loading bot resource files from disk and storing them in the in-memory caches.
 */

const filesystem = require(`fs`);
const path = require(`path`);

/*
 * Pull the name out of the filename.
 */
function parseFilename (filename, ext) {

	const normalisedFilename = filename.replace(/\\/g, `/`); // Windows uses backslashes.
	const regexp = new RegExp(`/([^/]+).${ext}`, `i`);
	const match = normalisedFilename.match(regexp);

	return match[1].toLowerCase();

}

/*
 * Returns an array of all the files with the given extension in the given directory (and optionally its
 * subdirectories).
 */
async function discoverFiles (directory, ext, searchSubDirectories = true) {

	const fileList = [];
	const items = await this.listDirectory(directory);
	const directoryList = [];
	const regexp = new RegExp(`.${ext}$`, `i`);

	// Add all the files and remember the directories for recursion later.
	for (const item of items) {
		const itemAbsolute = path.join(directory, item);
		const isDir = (searchSubDirectories ? await this.isDirectory(itemAbsolute) : false); // eslint-disable-line no-await-in-loop

		if (isDir) { directoryList.push(itemAbsolute); }
		else if (itemAbsolute.match(regexp)) { fileList.push(itemAbsolute); }
	}

	// Recursively get all the files from each of the subdirectories.
	for (const dir of directoryList) {
		const subFiles = await this.discoverFiles(dir, ext, searchSubDirectories); // eslint-disable-line no-await-in-loop
		fileList.push(...subFiles);
	}

	return fileList;

}

/*
 * Returns an array of all the directories in the top level of the given directory (not its subdirectories).
 */
async function discoverDirectories (directory) {

	const items = await this.listDirectory(directory);
	const directoryList = [];

	// Add all the directories.
	for (const item of items) {
		const itemAbsolute = path.join(directory, item);
		const isDir = await this.isDirectory(itemAbsolute); // eslint-disable-line no-await-in-loop

		if (isDir) { directoryList.push(itemAbsolute); }
	}

	return directoryList;

}

/*
 * Returns a list of items in the given directory, excluding any hidden files.
 */
function listDirectory (directory) {

	return new Promise((resolve, reject) => {

		filesystem.readdir(directory, (err, _files) => { // eslint-disable-line promise/prefer-await-to-callbacks
			if (err) { return reject(err); }
			const files = _files.filter(file => file[0] !== `.`);
			return resolve(files);
		});

	});

}

/*
 * Returns true if the given filename is in fact a directory./
 */
function isDirectory (filename) {

	return new Promise((resolve, reject) => {
		filesystem.stat(filename, (err, stats) => (err ? reject(err) : resolve(stats.isDirectory()))); // eslint-disable-line promise/prefer-await-to-callbacks
	});

}

/*
 * Load and parse the given file.
 */
async function parseJsonFile (filename, ignoreNotFoundErrors = false) {

	const data = await this.loadFile(filename, ignoreNotFoundErrors);
	if (!data) { return null; }

	try {
		return JSON.parse(data);
	}
	catch (err) {
		throw new Error(`Failed to parse JSON file "${filename}" because of "${err}".`);
	}

}

/*
 * Read in the given file.
 */
function loadFile (filename, ignoreNotFoundErrors = false) {

	return new Promise((resolve, reject) => {
		filesystem.readFile(filename, { encoding: `utf8` }, (err, data) => { // eslint-disable-line promise/prefer-await-to-callbacks
			if (err && (err.code !== `ENOENT` || !ignoreNotFoundErrors)) { return reject(err); }
			return resolve(data || null);
		});
	});

}

/*
 * Export.
 */
module.exports = {
	parseFilename,
	discoverFiles,
	discoverDirectories,
	listDirectory,
	isDirectory,
	parseJsonFile,
	loadFile,
};
