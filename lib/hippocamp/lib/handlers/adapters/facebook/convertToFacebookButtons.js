'use strict';

/*
 * Convert an array of internal buttons to an array of Facebook buttons.
 */
function convertToFacebookButtons (items, maxNestingLevel = 0, curNestingLevel = 0) {

	const output = [];

	for (let index = 0; index < items.length; index++) {
		const item = items[index];
		const button = {
			title: item.label,
		};

		switch (item.type) {
			case `nested`:
				if (curNestingLevel >= maxNestingLevel) { continue; } // Skip further nesting if we are already nested to the max.
				button.type = `nested`;
				button.call_to_actions = convertToFacebookButtons(item.items, maxNestingLevel, curNestingLevel + 1); // eslint-disable-line camelcase
				break;

			case `url`:
				button.type = `web_url`;
				button.url = item.payload;
				button.webview_height_ratio = `full`; // eslint-disable-line camelcase
				button.webview_share_button = (item.sharing ? `show` : `hide`); // eslint-disable-line camelcase
				button.messenger_extensions = Boolean(item.trusted); // eslint-disable-line camelcase
				break;

			case `call`:
				button.type = `phone_number`;
				button.payload = item.payload;
				break;

			case `basic`:
			default:
				button.type = `postback`;
				button.payload = item.payload || item.label;
				break;
		}

		output.push(button);
	}

	return output;

}

/*
 * Helper method to convert a single button at a time.
 */
function convertToFacebookSingleButton (item) {
	return convertToFacebookButtons([ item ])[0];
}

/*
 * Export.
 */
module.exports = {
	convertToFacebookButtons,
	convertToFacebookSingleButton,
};
