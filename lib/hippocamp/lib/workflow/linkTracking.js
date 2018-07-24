'use strict';

/*
 * WORKFLOW: LINK TRACKING
 * Functions for dealing with tracking links.
 */

const { URL } = require(`url`);
const moment = require(`moment`);

/*
 * Returns decoded variables from the given tracking URL.
 */
function __extractTrackingLinkVariables (input) {

	const fullUrl = new URL(input, this.options.baseUrl);
	const originalUrl = decodeURI(fullUrl.searchParams.get(`originalUrl`) || ``) || null;
	const messageId = fullUrl.searchParams.get(`messageId`) || null;
	const linkType = fullUrl.searchParams.get(`linkType`) || null;
	const linkIndex1 = fullUrl.searchParams.get(`linkIndex1`) || null;
	const linkIndex2 = fullUrl.searchParams.get(`linkIndex2`) || null;

	return { originalUrl, messageId, linkType, linkIndex1, linkIndex2 };

}

/*
 * Returns a dictionary of changes to apply to the message record.
 */
function __prepareMessageRecordChanges (linkType, linkIndex1, linkIndex2, recMessage) {

	const changes = {};
	const nowDate = moment.utc().toDate();
	let propertyBasePath;
	let existingObject;

	// Find the base path to the object we must update and the object itself.
	switch (linkType) {

		case `button`:
			propertyBasePath = `data.buttons.${linkIndex1}`;
			existingObject = recMessage.data.buttons[linkIndex1];
			break;

		case `carousel-default`:
			propertyBasePath = `data.carousel.elements.${linkIndex1}.defaultAction`;
			existingObject = recMessage.data.carousel.elements[linkIndex1].defaultAction;
			break;

		case `carousel-button`:
			propertyBasePath = `data.carousel.elements.${linkIndex1}.buttons.${linkIndex2}`;
			existingObject = recMessage.data.carousel.elements[linkIndex1].buttons[linkIndex2];
			break;

		default: throw new Error(`Invalid link type "${linkType}".`);

	}

	changes.$inc = { [`${propertyBasePath}.numVisits`]: 1 };
	changes[`${propertyBasePath}.lastVisit`] = nowDate;

	if (!existingObject.firstVisit) {
		changes[`${propertyBasePath}.firstVisit`] = nowDate;
	}

	return changes;

}

/*
 * Returns the label of the button clicked for the link we're tracking.
 */
function __getLinkTrackButtonLabel (linkType, linkIndex1, linkIndex2, recMessage) {

	switch (linkType) {
		case `button`: return recMessage.data.buttons[linkIndex1].label || null;
		case `carousel-default`: return recMessage.data.carousel.elements[linkIndex1].defaultAction.label || null;
		case `carousel-button`: return recMessage.data.carousel.elements[linkIndex1].buttons[linkIndex2].label || null;
		default: throw new Error(`Invalid link type "${linkType}".`);
	}

}

/*
 * Mark the link in the message as visited by the user, if we have the message details. Returns the message record or
 * null if we don't have the message details required to find it.
 */
async function __markMessageLinkAsVisited (database, linkVariables, trackingVariables) {

	const { messageId, linkType, linkIndex1, linkIndex2 } = linkVariables;

	if (!messageId || !linkType || !linkIndex1) {
		return null;
	}

	const recMessage = await database.get(`Message`, { _id: messageId });
	trackingVariables.messageText = recMessage.data.text || null;
	trackingVariables.buttonLabel = this.__getLinkTrackButtonLabel(linkType, linkIndex1, linkIndex2, recMessage);

	const changes = this.__prepareMessageRecordChanges(linkType, linkIndex1, linkIndex2, recMessage);
	await database.update(`Message`, recMessage, changes);

	return recMessage;

}

/*
 * Track the analytics event for tracking links, if analytics is configured and enabled.
 */
async function __trackLinkClickThroughAnalyticsHandlers (database, recMessage, trackingVariables) {

	const analytics = this.__dep(`analytics`);
	const analyticsEventName = this.options.linkTracking.analyticsEventName;

	if (!Object.keys(analytics).length || !this.options.enableEventTracking || !analyticsEventName || !recMessage) {
		return;
	}

	const recUser = await database.get(`User`, { _id: recMessage._user });
	trackingVariables.userId = recUser._id.toString();

	const analyticsPromises = Object.values(analytics)
		.map(handler => handler.trackEvent(recUser, analyticsEventName, trackingVariables));

	await Promise.all(analyticsPromises);

}

/*
 * Handle requests to the link tracking server.
 */
async function handleLinkTrackingRequests (req, res) {

	const sharedLogger = this.__dep(`sharedLogger`);

	try {

		sharedLogger.debug(`Tracking a link click.`);

		const database = this.__dep(`database`);
		const linkVariables = this.__extractTrackingLinkVariables(req.url);
		const trackingVariables = { ...linkVariables };

		sharedLogger.verbose({ text: `Link variables.`, ...linkVariables });

		const recMessage = await this.__markMessageLinkAsVisited(database, linkVariables, trackingVariables);
		await this.__trackLinkClickThroughAnalyticsHandlers(database, recMessage, trackingVariables);

		sharedLogger.silly({ text: `Tracking variables.`, ...trackingVariables });

		// Trigger any attached external event listeners.
		await this.triggerEvent(`track-link`, trackingVariables);

		// Redirect to the original URL now that we've done tracking the visit;
		res.redirect(303, linkVariables.originalUrl);

	}
	catch (err) {
		sharedLogger.error(`Failed to track link.`);
		sharedLogger.error(err);
		res.status(500).respond(err.message, false);
	}

}

/*
 * Export.
 */
module.exports = {
	__extractTrackingLinkVariables,
	__prepareMessageRecordChanges,
	__getLinkTrackButtonLabel,
	__markMessageLinkAsVisited,
	__trackLinkClickThroughAnalyticsHandlers,
	handleLinkTrackingRequests,
};
