'use strict';

/*
 * Returns an array of dynamic flow records from the database.
 */
async function __discoverDynamicFlows () {

	const database = this.__dep(`database`);
	const records = await database.find(`Flow`, {});

	return records;

}

/*
 * Returns a combined array of all the static and dynamic flows.
 */
async function __discoverAllFlows (directory) {

	const staticFlows = (directory ? await this.discoverFiles(directory, `json`) : []);
	const dynamicFlows = await this.__discoverDynamicFlows();
	const allFlows = [
		...staticFlows.map(filename => Object({ type: `static`, filename })),
		...dynamicFlows.map(record => Object({ type: `dynamic`, record, id: record._id.toString() })),
	];

	return {
		numStaticFlows: staticFlows.length,
		numDynamicFlows: dynamicFlows.length,
		allFlows,
	};

}

/*
 * Converts a static flow file to the same model used by dynamic flows.
 */
async function __convertStaticFlowToModel (flowFilename) {

	const database = this.__dep(`database`);
	const Flow = database.getModel(`Flow`);
	const definition = await this.parseJsonFile(flowFilename);

	// Convert to model without an object ID.
	definition._id = null;
	const doc = new Flow(definition);
	const rawDoc = doc.toObject({ getters: true, virtuals: true, minimize: false, versionKey: false });

	return rawDoc;

}

/*
 * Prepares the URI and definition for a given loaded flow.
 */
async function __prepareLoadedFlow (directory, flow) {

	// Prepare a static flow.
	if (flow.type === `static`) {
		const uri = this.__parseFlowUriFromPath(directory, flow.filename);
		const definition = await this.__convertStaticFlowToModel(flow.filename);
		definition.uri = this.__normaliseFlowUri(definition.uri);
		return { uri, definition };
	}

	// Prepare a dynamic flow.
	else if (flow.type === `dynamic`) {
		const definition = flow.record;
		definition.uri = this.__normaliseFlowUri(definition.uri || flow.id, true);
		definition.canonicalUri = this.__normaliseFlowUri(flow.id, true);
		const uri = definition.uri;
		return { uri, definition };
	}

	else {
		throw new Error(`Unrecognised flow type ${flow.type}`);
	}

}

async function __addFlow (unpreppedFlow, directory = null) {

	const { uri, definition } = await this.__prepareLoadedFlow(directory, unpreppedFlow);

	// Make sure we haven't already loaded a flow with this URI.
	if (this.__getFlow(uri)) {
		throw new Error(`There is a duplicate flow for the URI "${uri}".`);
	}

	// Ensure the file's URI and the path URI match.
	if (definition.uri !== uri) {
		throw new Error(`The URI "${definition.uri}" in the flow "${uri}" does not match its path.`);
	}

	this.flows[uri] = {
		type: unpreppedFlow.type,
		filename: unpreppedFlow.filename || null,
		dynamicId: unpreppedFlow.id || null,
		uri,
		definition,
	};

	return this.flows[uri];

}

/*
 * Load and cache all the flows in the flows directory and all its subdirectories.
 */
async function __loadFlows (directory) {

	const sharedLogger = this.__dep(`sharedLogger`);

	sharedLogger.debug(`Loading flows...`);

	const { numStaticFlows, numDynamicFlows, allFlows } = await this.__discoverAllFlows(directory);

	await Promise.all(allFlows.map(async flow => {
		const loadedFlow = await this.__addFlow(flow, directory);
		sharedLogger.verbose(`Loaded Flow ${loadedFlow.uri} (${loadedFlow.dynamicId || loadedFlow.filename})`);
	}));

	if (!this.__getFlow(`/`)) {
		sharedLogger.warn(`Root flow ('/') is missing: either a static or dynamic flow should be configured.`);
	}

	sharedLogger.debug(`${numStaticFlows} static and ${numDynamicFlows} dynamic flows loaded.`);

}

/*
 * Load or reload the given flow by its dynamic ID.
 */
async function __reloadDynamicFlow (database, dynamicFlow, dynamicId) {

	// Delete the flow if it already exists.
	if (dynamicFlow && this.flows[dynamicFlow.uri]) {
		delete this.flows[dynamicFlow.uri];
	}

	// Load in the given flow.
	const record = await database.get(`Flow`, { _id: dynamicId });
	return await this.__addFlow({ type: `dynamic`, record, id: dynamicId });

}

/*
 * Reloads the dynamic flows given some pre-processed information.
 */
async function __reloadDynamicFlows (flowIds, dynamicFlows, reloadAll) {

	const database = this.__dep(`database`);
	const reloadedFlowIds = [];

	// Handle reloads: reload existing flows.
	const reloadPromises = dynamicFlows.map(async dynamicFlow => {
		if (reloadAll || flowIds.includes(dynamicFlow.dynamicId)) {
			await this.__reloadDynamicFlow(database, dynamicFlow, dynamicFlow.dynamicId);
			reloadedFlowIds.push(dynamicFlow.dynamicId);
		}
	});

	// Must reload existing before loading in new ones.
	await Promise.all(reloadPromises);

	// Handle additions: load new flows.
	const remainingIds = flowIds.filter(id => reloadedFlowIds.indexOf(id) < 0);

	const newFlowPromises = remainingIds.map(async flowId => {
		const dynamicFlow = await this.__reloadDynamicFlow(database, null, flowId);
		reloadedFlowIds.push(dynamicFlow.dynamicId);
	});

	await Promise.all(newFlowPromises);

	return reloadedFlowIds;

}

/*
 * Allows specified dynamic flows to be reloaded.
 */
async function reloadDynamicFlows (req, res) {

	const sharedLogger = this.__dep(`sharedLogger`);

	const flowIds = (Array.isArray(req.body.flowIds) || !req.body.flowIds ? req.body.flowIds : [ req.body.flowIds ]);
	const reloadAll = !(flowIds && flowIds.length); // if no IDs specified we reload everything
	const dynamicFlows = await this.__getDynamicFlows();
	let reloadedFlowIds = [];

	try {

		reloadedFlowIds = await this.__reloadDynamicFlows(flowIds, dynamicFlows, reloadAll);

	}
	catch (err) {

		sharedLogger.error(err);

		return res.respond({
			success: false,
			error: `An unexpected error occured.`,
		});

	}

	// Check if we failed to reload any flows.
	const failedFlowIds = flowIds.filter(obj => reloadedFlowIds.indexOf(obj) === -1);

	// All flows failed to reload, let's return failure!
	if (flowIds.length && failedFlowIds.length === flowIds.length) {

		sharedLogger.error(`Failed to reload any of the dynamic flows.`, {
			flowIds,
		});

		return res.respond({
			success: false,
			error: `Failed to reload any of the dynamic flows.`,
			reloadedFlowIds: reloadedFlowIds,
			failedFlowIds,
		});

	}

	// Success! (at least partially)
	sharedLogger.debug(`Successfully reloaded dynamic flows.`, {
		reloadedFlowIds: reloadedFlowIds,
		failedFlowIds,
	});

	return res.respond({
		success: true,
		reloadedFlowIds: reloadedFlowIds,
		failedFlowIds,
	});

}

/*
 * Export.
 */
module.exports = {
	__discoverDynamicFlows,
	__discoverAllFlows,
	__convertStaticFlowToModel,
	__prepareLoadedFlow,
	__addFlow,
	__loadFlows,
	__reloadDynamicFlow,
	__reloadDynamicFlows,
	reloadDynamicFlows,
};
