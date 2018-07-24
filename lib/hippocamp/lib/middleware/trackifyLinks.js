'use strict';

/*
 * MIDDLEWARE: Trackify Links
 */

/*
 * Removes any trailing slashes from the end of the given URL.
 */
function trimTrailingSlashes (url) {
	return (url || ``).trim().replace(/\/+$/, ``);
}

/*
 * Returns a trackable link.
 */
function generateTrackableLink (hippocampOptions, message, originalUrl, { linkType, linkIndex1, linkIndex2 }) {

	const { linkTracking, baseUrl } = hippocampOptions;
	const serverBaseUrl = trimTrailingSlashes(linkTracking.serverUrl) || `${trimTrailingSlashes(baseUrl)}/track-link`;
	const encodedUrl = encodeURIComponent(originalUrl);
	const queryParams = [ `originalUrl=${encodedUrl}` ];

	// Can we add the message details?
	if (message.messageId && linkType && typeof linkIndex1 !== `undefined`) {
		queryParams.push(`messageId=${message.messageId}`, `linkType=${linkType}`, `linkIndex1=${linkIndex1}`);
		if (linkIndex2) { queryParams.push(`linkIndex2=${linkIndex2}`); }
	}

	const trackableUrl = `${serverBaseUrl}/?${queryParams.join(`&`)}`;

	return trackableUrl;

}

/*
 * Updates button payloads with trackable links.
 */
function updateButton (hippocampOptions, message, button, linkMeta) {

	if (button.type === `url`) {
		button.payload = generateTrackableLink(hippocampOptions, message, button.payload, linkMeta);
	}

	return button;

}

/*
 * Updates carousel payloads with trackable links.
 */
function updateCarousel (updateButtonForMessage, element, linkIndex1) {

	if (element.defaultAction) {
		element.defaultAction = updateButtonForMessage(element.defaultAction, {
			linkType: `carousel-default`,
			linkIndex1,
		});
	}

	element.buttons = element.buttons.map((button, linkIndex2) =>
		updateButtonForMessage(button, {
			linkType: `carousel-button`,
			linkIndex1,
			linkIndex2,
		})
	);

	return element;

}

/*
 * The middleware itself.
 */
module.exports = function trackifyLinksMiddleware (
	sharedLogger, hippocampOptions
) {

	// The actual middleware.
	return async (message, adapter, recUser, next/* , stop */) => {

		sharedLogger.debug({
			text: `Running middleware "trackifyLinksMiddleware".`,
			direction: message.direction,
			message: message.text,
			userId: recUser._id.toString(),
			channelName: recUser.channel.name,
			channelUserId: recUser.channel.userId,
		});

		// Skip if link tracking is not enabled.
		if (!hippocampOptions.linkTracking || !hippocampOptions.linkTracking.enabled) {
			return next(null, recUser);
		}

		const updateButtonForMessage = updateButton.bind(null, hippocampOptions, message);
		const updateCarouselForMessage = updateCarousel.bind(null, updateButtonForMessage);

		// Buttons.
		if (message.buttons) {
			message.buttons = message.buttons.map((button, linkIndex1) =>
				updateButtonForMessage(button, {
					linkType: `button`,
					linkIndex1,
				})
			);
		}

		// Carousels.
		if (message.carousel) {
			message.carousel.elements = message.carousel.elements.map(updateCarouselForMessage);
		}

		return next(null, recUser);

	};

};
