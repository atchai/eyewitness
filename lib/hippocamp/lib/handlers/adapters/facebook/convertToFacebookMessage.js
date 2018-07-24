'use strict';

const extender = require(`object-extender`);
const { convertToFacebookButtons, convertToFacebookSingleButton } = require(`./convertToFacebookButtons`);

/*
 * Returns a shell of a Facebook message.
 */
function createFacebookMessageShell (channelUserId, message = {}) {

	return Object({
		recipient: {
			id: channelUserId,
		},
		message: message || {},
		tag: `NON_PROMOTIONAL_SUBSCRIPTION`,
	});

}

/*
 * Converts an array of internal options to an array of Facebook quick replies.
 */
function convertToFacebookQuickReplies (options) {

	return (options || []).map(option => Object({
		content_type: `text`, // eslint-disable-line camelcase
		title: option.label,
		payload: option.payload || option.label,
	}));

}

/*
 * Converts an array of internal attachments to an array of Facebook attachments.
 */
function convertToFacebookAttachments (items) {

	return items.map(item => {

		let fbType;

		switch (item.type) {
			case `file`: fbType = `file`; break;
			case `image`: fbType = `image`; break;
			case `audio`: fbType = `audio`; break;
			case `video`: fbType = `video`; break;
			default: throw new Error(`Invalid attachment type "${item.type}".`);
		}

		const payload = {};

		// Payload must be an empty object unless there is a remote URL for the attachment.
		if (item.remoteUrl) {
			payload.url = item.remoteUrl;
		}

		return {
			type: fbType,
			payload,
			_data: item.data,
			_filename: item.filename,
			_mimeType: item.mimeType,
		};

	});

}

/*
 * Converts an internal representation of a carousel to a Facebook carousel.
 */
function convertToFacebookCarousel (carousel) {

	const maxFbElements = 10;

	// Convert elements to Facebook carousel elements.
	const elements = carousel.elements.map(element => {

		const buttons = convertToFacebookButtons(element.buttons);
		let defaultAction = element.defaultAction;

		// If no default action is specified, use the first button but only if it's a URL.
		if (!defaultAction && buttons && buttons[0] && buttons[0].type === `url`) {
			defaultAction = extender.clone(buttons[0]);
		}

		// If a default action has already been specified.
		else if (defaultAction) {
			defaultAction = convertToFacebookSingleButton(defaultAction);
		}

		// Facebook doesn't allow title for default actions.
		if (defaultAction && defaultAction.title) {
			delete defaultAction.title;
		}

		return Object({
			title: element.label,
			subtitle: element.text || void (0),
			image_url: element.imageUrl || void (0), // eslint-disable-line camelcase
			default_action: defaultAction || void (0), // eslint-disable-line camelcase
			buttons: (buttons && buttons.length ? buttons : void (0)),
		});

	});

	return elements.slice(0, maxFbElements);

}

/*
 * Convert internal buttons to Facebook buttons.
 */
function addButtons (channelUserId, message, primaryFBMessage, postDataItems) {

	if (!message.buttons || !message.buttons.length) { return; }

	const shell = (primaryFBMessage.attachment ? createFacebookMessageShell(channelUserId) : primaryFBMessage);
	const buttons = convertToFacebookButtons(message.buttons);

	shell.message.attachment = {
		type: `template`,
		payload: {
			template_type: `button`, // eslint-disable-line camelcase
			text: message.text,
			buttons,
		},
	};

	// We don't need the top-level text property when using a template.
	if (typeof shell.message.text !== `undefined`) {
		delete shell.message.text;
	}

	// If we created a new shell message, add it to the list of items to send.
	if (shell !== primaryFBMessage) {
		postDataItems.push(shell);
	}

}

/*
 * Convert an internal carousel to a Facebook carousel and add to message.
 */
function addCarousel (channelUserId, message, primaryFBMessage, postDataItems) {

	if (!message.carousel) { return; }

	const shell = (primaryFBMessage.attachment ? createFacebookMessageShell(channelUserId) : primaryFBMessage);

	shell.message.attachment = {
		type: `template`,
		payload: {
			template_type: `generic`, // eslint-disable-line camelcase
			sharable: (typeof message.carousel.sharing !== `undefined` ? message.carousel.sharing : false),
			image_aspect_ratio: `horizontal`, // eslint-disable-line camelcase
			elements: convertToFacebookCarousel(message.carousel),
		},
	};

	// We don't need the top-level text property when using a template.
	if (typeof shell.message.text !== `undefined`) {
		delete shell.message.text;
	}

	// If we created a new shell message, add it to the list of items to send.
	if (shell !== primaryFBMessage) {
		postDataItems.push(shell);
	}

}

/*
 * Convert internal attachments (every attachment creates a new FB message) and add to message.
 */
function addAttachments (channelUserId, message, primaryFBMessage, postDataItems) {

	if (!message.attachments || !message.attachments.length) { return; }

	const fbAttachments = convertToFacebookAttachments(message.attachments);

	fbAttachments.map(fbAttachment => {
		let shell;
		let newShellMessage;

		if (primaryFBMessage.attachment) {
			shell = createFacebookMessageShell(channelUserId);
			newShellMessage = true;
		}
		else {
			shell = primaryFBMessage;
			newShellMessage = false;
		}

		shell.message.attachment = fbAttachment;

		if (newShellMessage) {
			postDataItems.push(shell);
		}
	});

}

/*
 * Convert the given internal message to the Facebook representation used for sending. Returns an array even if there
 * is just one message to return (sometimes there may be more than one).
 */
module.exports = function convertToFacebookMessage (channelUserId, message, resources) {

	const { MessageObject } = resources;

	// Don't allow spurious objects to be used in place of a MessageObject.
	if (!(message instanceof MessageObject)) {
		throw new Error(`Messages must be created using the MessageObject class.`);
	}

	// Prepare the primary message.
	const quickReplies = convertToFacebookQuickReplies(message.options);
	const primaryFBMessage = createFacebookMessageShell(channelUserId, {
		text: message.text || void (0),
		quick_replies: (quickReplies && quickReplies.length ? quickReplies : void (0)), // eslint-disable-line camelcase
	});
	const postDataItems = [ primaryFBMessage ];

	// Add properties to message (or create new messages as necessary).
	addButtons(channelUserId, message, primaryFBMessage, postDataItems, convertToFacebookButtons);
	addCarousel(channelUserId, message, primaryFBMessage, postDataItems);
	addAttachments(channelUserId, message, primaryFBMessage, postDataItems);

	return postDataItems;

};
