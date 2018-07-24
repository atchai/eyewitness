'use strict';

const { URL } = require(`url`);
const FormData = require(`form-data`);
const RequestNinja = require(`request-ninja`);

/*
 * Returns new request and form objects.
 */
function prepareRequest (endpointUrl) {

	const req = new RequestNinja(endpointUrl, {
		timeout: (1000 * 60),
		returnResponseObject: true,
		logging: false,
	});

	const form = new FormData();

	return { req, form };

}

/*
 * Removes the Facebook API version segment from the URL path.
 */
function prepareRelativeUrl (pathname) {

	let relativeUrl = pathname.split(/\//g);
	relativeUrl.splice(0, 2);
	relativeUrl = relativeUrl.join(`/`);

	return relativeUrl;

}

/*
 * Returns true if the Facebook message contains an embedded attachment.
 */
function containsEmbeddedAttachment (facebookMessage) {

	return Boolean(
		facebookMessage &&
		facebookMessage.message &&
		facebookMessage.message.attachment &&
		facebookMessage.message.attachment._data
	);

}

/*
 * Returns true if the Facebook message contains an attachment.
 */
function containsAttachment (facebookMessage) {

	return Boolean(
		facebookMessage &&
		facebookMessage.message &&
		facebookMessage.message.attachment
	);

}

/*
 * Correctly encodes the body of a batched request in the format the Facebook API requires it.
 */
function encodeBatchRequestBody (dataItem) {

	const preparedProperties = Object.entries(dataItem).reduce((acc, [ key, value ]) => {
		const formattedKey = encodeURIComponent(key);
		const formattedValue = encodeURIComponent(typeof value === `object` ? JSON.stringify(value) : value);
		acc.push(`${formattedKey}=${formattedValue}`);
		return acc;
	}, []);

	return preparedProperties.join(`&`);

}

/*
 * Prepares the post data for the batch request to the Facebook API.
 */
function preparePostData (dataToSend, relativeUrl) {

	const embeddedAttachments = [];
	const postData = dataToSend.map(dataItem => {

		const batchItem = {
			relative_url: relativeUrl, // eslint-disable-line camelcase
		};

		// We have data to POST.
		if (dataItem) {

			// Add embedded attachment info.
			if (containsEmbeddedAttachment(dataItem)) {

				// Keep a copy of the attachment data separately from the message.
				const attachmentNum = embeddedAttachments.push({
					buf: dataItem.message.attachment._data,
					filename: dataItem.message.attachment._filename,
					mimeType: dataItem.message.attachment._mimeType,
				});

				// Add the name of the embedded file.
				batchItem[`attached_files`] = `file_${attachmentNum - 1}`;

			}

			if (containsAttachment(dataItem)) {
				// Don't allow these properties to be sent to the Facebook API.
				delete dataItem.message.attachment._data;
				delete dataItem.message.attachment._filename;
				delete dataItem.message.attachment._mimeType;
			}

			// Add the body of request correctly encoded.
			batchItem.method = `POST`;
			batchItem.body = encodeBatchRequestBody(dataItem);

		}

		// We have no data so must GET.
		else {
			batchItem.method = `GET`;
		}

		return batchItem;

	});

	return { embeddedAttachments, postData };

}

/*
 * Appends the required fields to the form submission.
 */
function appendFormFields (form, accessToken, postData) {

	form.append(`access_token`, accessToken);
	form.append(`include_headers`, `false`);
	form.append(`batch`, JSON.stringify(postData));

}

/*
 * Attaches each of the embedded attachment buffers to the form object.
 */
function appendFormAttachments (form, embeddedAttachments) {

	// Include all the embedded attachment buffers.
	embeddedAttachments.forEach((embeddedAttachment, index) => {

		form.append(`file_${index}`, embeddedAttachment.buf, {
			filename: embeddedAttachment.filename,
			contentType: embeddedAttachment.mimeType,
			knownLength: Buffer.byteLength(embeddedAttachment.buf),
		});

	});

}

/*
 * Handles errors returned by the Facebook API, if any, and converts them to native JS errors.
 */
async function handleFacebookAPISingleError (responseBody, postData, resources) {

	// Nothing to do if there is no error.
	if (!responseBody.error) { return null; }

	const { markBotRemovedForUserByChannel } = resources;
	let err = null;

	// Handle any API errors.
	switch (Number(responseBody.error.code)) {

		case 551: // "This person isn't available right now".
		case 2018001: // "No matching user found".
			await markBotRemovedForUserByChannel(postData.recipient.id);
			break;

		default:
			err = new Error(`Message rejected by Facebook API with error: "${responseBody.error.message}".`);
			break;

	}

	return err;

}

/*
 * Handles batched request errors returned by the Facebook API, if any, and converts them to native JS errors.
 */
async function handleFacebookAPIBatchedErrors (res, dataBatch, facebookUrl, postData, resources) {

	// Handle errors returned by the Facebook batch API.
	if (dataBatch.error) {
		throw new Error(`Facebook batch API returned the error "${dataBatch.error.message}".`);
	}

	// Otherwise if the batch API doesn't return a 200 status consider that a fatal error.
	else if (res.statusCode !== 200) {
		throw new Error(`Encountered a non-200 HTTP status code "${res.statusCode}" from the Facebook batch API.`);
	}

	const { sharedLogger } = resources;
	const errList = [];

	// Log out each of the batched errors in turn.
	for (const data of dataBatch) {
		const statusCode = data.code;
		const responseBody = JSON.parse(data.body);
		const err = await handleFacebookAPISingleError(responseBody, postData, resources); // eslint-disable-line no-await-in-loop

		// Decorate the error with more detail and log it out.
		if (err) {
			err.extraData = {
				statusCode,
				fbError: data.error || null,
				facebookUrl,
				postData,
				responseBody,
			};

			sharedLogger.error(err);
			errList.push(err);
		}
	}

	// Throw an error if one or more of the batched messages had an error.
	if (errList.length) {
		const numErroredMessages = errList.length;
		const numBatchedMessages = dataBatch.length;
		const errBatch = new Error(`${numErroredMessages}/${numBatchedMessages} of the batched messages returned errors.`);
		errBatch.errList = errList;

		throw errBatch;
	}

}

/*
 * Makes a request to the Facebook API with the given array of data. All items in the array must be of the same type.
 * Returns an array of the batch results from the Facebook API.
 */
module.exports = async function makeRequest (facebookUrl, _dataToSend, resources) {

	const dataToSend = (Array.isArray(_dataToSend) ? _dataToSend : [ _dataToSend ]);
	const { sharedLogger } = resources;

	sharedLogger.silly({
		text: `Making a request to the Facebook API with ${dataToSend.length} items(s).`,
		dataToSend,
		facebookUrl,
	});

	const { protocol, host, pathname, searchParams } = new URL(facebookUrl);
	const endpointUrl = `${protocol}//${host}`;
	const accessToken = searchParams.get(`access_token`);
	const relativeUrl = prepareRelativeUrl(pathname);

	// Prepare the request.
	const { req, form } = prepareRequest(endpointUrl);
	const { embeddedAttachments, postData } = preparePostData(dataToSend, relativeUrl);

	// Append form fields.
	appendFormFields(form, accessToken, postData);
	appendFormAttachments(form, embeddedAttachments);

	sharedLogger.silly({
		text: `${embeddedAttachments.length} embedded attachment(s) added to the Facebook request.`,
	});

	// Make the request.
	req.setHeaders(form.getHeaders());
	const res = await req.postStream(form);

	// Facebook returns the incorrect "text/javascript" content-type header so we need to manually parse the body.
	const dataBatch = (typeof res.body === `string` ? JSON.parse(res.body) : res.body);

	sharedLogger.silly({
		text: `Facebook API returned the following data.`,
		dataBatch,
	});

	await handleFacebookAPIBatchedErrors(res, dataBatch, facebookUrl, postData, resources);

	// Pull out the body of each batch item.
	const bodyBatch = dataBatch.map(dataItem => JSON.parse(dataItem.body));
	return bodyBatch;

};
