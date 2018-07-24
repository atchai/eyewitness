'use strict';

/*
 * UTILITIES
 * Various small methods used by multiple modules.
 */

const Chance = require(`chance`);
const Handlebars = require(`handlebars`);
const moment = require(`moment`);
const { strCaseHelper } = require(`./handlebarsHelpers`);

/*
 * Register all the helpers with handlebars.
 */
Handlebars.registerHelper(`str-case`, strCaseHelper);

/*
 * Returns a stack trace at the call site of this function.
 */
function getStackTrace (asArray = false, preserveFormatting = false) {

	let stack = new Error().stack;

	// Remove spaces at the start of every line?
	if (!preserveFormatting) { stack = stack.replace(/^\s+/gm, ``); }

	// Turn into an array.
	stack = stack.split(/\n/g);

	// Remove the "Error" line from the trace.
	stack.shift();

	// Remove this function from the trace.
	stack.shift();

	return (asArray ? stack : stack.join(`\n`));

}

/*
 * Returns a copy of the HTML with the variables parsed in. Does nothing if the HTML is not a template.
 */
function compileTemplate (html, variables) {
	if (!html || !html.match(/\{\{/)) { return html; }
	const template = Handlebars.compile(html);
	return template(variables);
}

/*
 * Returns a promise that resolves after the given number of seconds.
 */
function delay (seconds) {
	return new Promise(resolve => setTimeout(resolve, (seconds * 1000)));
}

/*
 * Returns the value for the given delay option.
 */
function __getValueForDelayOption (defaultDelays, customDelays, key) {

	const defaultValue = defaultDelays[key];
	const customValue = customDelays[key];

	return (typeof customValue === `number` ? customValue : defaultValue) || 0;

}

/*
 * Returns a dictionary of all the values for all the delay options.
 */
function __getValuesForAllDelayOptions (defaultDelays, customDelays) {

	return {
		fixedDelay: __getValueForDelayOption(defaultDelays, customDelays, `fixedDelay`),
		avgWordsPerMin: __getValueForDelayOption(defaultDelays, customDelays, `avgWordsPerMin`),
		buttonDelay: __getValueForDelayOption(defaultDelays, customDelays, `buttonDelay`),
		randomness: __getValueForDelayOption(defaultDelays, customDelays, `randomness`),
		minDelay: __getValueForDelayOption(defaultDelays, customDelays, `minDelay`),
		maxDelay: __getValueForDelayOption(defaultDelays, customDelays, `maxDelay`),
	};

}

/*
 *
 */
function __getMessageFeaturesForDelay (message) {

	return {
		messageHasButtons: Boolean(message.buttons && message.buttons.length),
		messageHasOptions: Boolean(message.options && message.options.length),
		messageHasAttachments: Boolean(message.attachments && message.attachments.length),
		messageHasCarousel: Boolean(message.carousel),
	};

}

/*
 * Add the button delay if there are any extraneous items attached to the message.
 */
function __addButtonDelay (calculatedDelay, message, buttonDelay) {

	if (!buttonDelay) {
		return calculatedDelay;
	}

	const {
		messageHasButtons,
		messageHasOptions,
		messageHasAttachments,
		messageHasCarousel,
	} = __getMessageFeaturesForDelay(message);

	let newCalculatedDelay = calculatedDelay;
	if (messageHasButtons || messageHasOptions || messageHasAttachments) { newCalculatedDelay += buttonDelay; }
	if (messageHasCarousel) { newCalculatedDelay += (buttonDelay * 2); }

	return newCalculatedDelay;

}

/*
 * Calculate the text reading delay.
 */
function __addTextReadingDelay (calculatedDelay, message, avgWordsPerMin) {

	if (!avgWordsPerMin || !message.text) {
		return calculatedDelay;
	}

	let newCalculatedDelay = calculatedDelay;
	const numWords = message.text.split(/\s+/gm).length;
	const readingDelay = 60 / (avgWordsPerMin / numWords);
	newCalculatedDelay += readingDelay;

	return newCalculatedDelay;

}

/*
 * Add some variation?
 */
function __addVariableDelay (calculatedDelay, randomness) {

	if (!randomness) {
		return calculatedDelay;
	}

	const chance = new Chance();
	const variation = calculatedDelay * randomness;
	const lowerBound = Math.max(calculatedDelay - variation, 0);
	const upperBound = calculatedDelay + variation;

	const newCalculatedDelay = chance.floating({
		min: lowerBound,
		max: upperBound,
		fixed: 2,
	});

	return newCalculatedDelay;

}

/*
 * Returns the number of seconds to delay before sending the given message.
 */
function calculateSendMessageDelay (message, defaultDelays, customDelays = {}) {

	const {
		fixedDelay,
		avgWordsPerMin,
		buttonDelay,
		randomness,
		minDelay,
		maxDelay,
	} = __getValuesForAllDelayOptions(defaultDelays, customDelays);

	let calculatedDelay = fixedDelay;
	calculatedDelay = __addButtonDelay(calculatedDelay, message, buttonDelay);
	calculatedDelay = __addTextReadingDelay(calculatedDelay, message, avgWordsPerMin);
	calculatedDelay = __addVariableDelay(calculatedDelay, randomness);

	// Bound the delay between the min and max, if configured.
	if (minDelay) { calculatedDelay = Math.max(calculatedDelay, minDelay); }
	if (maxDelay) { calculatedDelay = Math.min(calculatedDelay, maxDelay); }

	return calculatedDelay;

}

/*
 * Returns a dictionary of time parts taken from the given time string if valid. Any missing parts are undefined.
 */
function parseTimeString (_time) {

	const time = _time || ``;
	const genericTimeRegExp = /(\d{1,2})(?:(?:\.|:|,)(\d{2}))?(?:\s?(a\.?m?\.?|p\.?m?\.?))?/i;

	// Otherwise assume the time is in some generic format.
	const [ , hours, minutes, period ] = time.match(genericTimeRegExp) || [];
	const is24Hours = (hours >= 13);

	return {
		hours: (hours ? parseInt(hours) : void (0)),
		minutes: (minutes ? parseInt(minutes) : 0),
		period: (!is24Hours ? period : void (0)),
		is24Hours,
	};

}

/*
 * Returns either "am" or "pm" depending on the parsed period string, or otherwise use the bias.
 */
function parsePeriodString (_period, _bias) {

	const amRegExp = /a\.?m?\.?/i;
	const pmRegExp = /p\.?m?\.?/i;
	const period = _period || ``;
	const bias = _bias || ``;

	if (period.match(amRegExp)) { return `am`; }
	if (period.match(pmRegExp)) { return `pm`; }

	if (bias.match(amRegExp)) { return `am`; }
	if (bias.match(pmRegExp)) { return `pm`; }

	return null;
}

/*
 * Takes any reasonable time string, returns military time (eg. "23:59"), or null
 */
function parseTime (value, bias = ``) {

	const { hours, minutes, period: _period, is24Hours } = parseTimeString(value);
	const period = parsePeriodString(_period, bias);

	// Generate an error if we can't parse the time string.
	if (typeof hours === `undefined` || typeof minutes === `undefined`) {
		return null;
	}

	// Prepare a time object so we can extract a correctly formatted time string.
	const timeObject = moment();
	const momentHours = (!is24Hours && period === `pm` ? (hours + 12) : hours);
	timeObject.hours(momentHours);
	timeObject.minutes(minutes);

	// Extract the correctly formatted time string from the time object.
	const formattedTime = timeObject.format(`HH:mm`);
	return formattedTime;

}

/*
 * Returns an object containing "frequency" and "units" variables for the given frequency string (e.g. "5 hours"), or
 * undefined values if the string is invalid.
 */
function parseFrequencyString (input) {

	const [ , frequency = 1, units ] = (input || ``).match(/(?:(\d+) )?([a-z]+)/i) || [];
	if (!frequency || !units) { return {}; }

	return {
		frequency: parseInt(frequency, 10),
		units,
	};

}

/*
 * Takes a value and returns either true, false or null.
 */
function parseBoolean (_value) {

	// Sanitise the input.
	const value = (_value || ``).trim().toLowerCase();

	switch (value) {

		case `true`:
		case `yes`:
		case true:
			return true;

		case `false`:
		case `no`:
		case false:
			return false;

		case `null`:
		case null:
		default:
			return null;

	}

}

/*
 * Export.
 */
module.exports = {
	getStackTrace,
	compileTemplate,
	delay,
	calculateSendMessageDelay,
	parseTimeString,
	parsePeriodString,
	parseTime,
	parseFrequencyString,
	parseBoolean,
};
