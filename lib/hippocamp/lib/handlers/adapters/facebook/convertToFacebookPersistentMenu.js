'use strict';

const { convertToFacebookButtons } = require(`./convertToFacebookButtons`);

/*
 * Converts the Hippocamp menu format to the Facebook persistent menu format.
 */
module.exports = function convertToFacebookPersistentMenu (menuItems) {

	const maxTopLevelItems = 3;
	const maxSubLevelItems = 5;

	let menu = convertToFacebookButtons(menuItems, 1);

	// Ensure we don't have too many top-level items.
	menu = (menu.length > maxTopLevelItems ? menu.slice(0, maxTopLevelItems) : menu);

	// Ensure we don't have too many sub items.
	menu = menu.map(item => {
		if (item.type === `nested` && item.call_to_actions.length > maxSubLevelItems) {
			item.call_to_actions = item.call_to_actions.slice(0, maxSubLevelItems); // eslint-disable-line camelcase
		}

		return item;
	});

	return menu;

};
