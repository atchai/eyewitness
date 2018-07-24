'use strict';

/*
 * HANDLEBARS HELPERS
 */

/*
 * Allows the case of strings to be changed.
 */
function strCaseHelper (value, newCase) {

	switch (newCase) {
		case `upper`: return value.toUpperCase();
		case `lower`: return value.toLowerCase();
		default: return value;
	}

}

/*
 * Export.
 */
module.exports = {
	strCaseHelper,
};
