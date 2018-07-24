'use strict';

/*
 * DATABASE: Mongo
 */

const mongoose = require(`mongoose`);
const MongooseSchema = mongoose.Schema;
const extender = require(`object-extender`);
const DatabaseBase = require(`./databaseBase`);
const Property = require(`../../modules/schema/property`);
const Reference = require(`../../modules/schema/reference`);
const Schema = require(`../../modules/schema/schema`);

module.exports = class DatabaseMongo extends DatabaseBase {

	/*
	 * Instantiates the handler.
	 */
	constructor (_options) {

		// Configure the handler.
		super(`database`, `mongo`);

		// Default config for this handler.
		this.options = extender.defaults({
			connectionString: null,
			mock: false,
		}, _options);

		// Define the required dependencies.
		this.requirements = [ `sharedLogger` ];

		// Force Mongoose to use native promises.
		mongoose.Promise = global.Promise;

	}

	/*
	 * Converts the given schema into a model this database can understand.
	 */
	addModel (Model, extraOptions = {}) {

		const schema = new Model(Schema, Property, Reference);
		const modelName = schema.modelName;

		if (this.hasModel(modelName)) {
			throw this.__error(`EXISTING_MODEL`, { modelName });
		}

		// Setup the Mongoose schema.
		const mongooseSchema = this.__convertToMongooseSchema(schema);

		// add methods and static methods
		if (schema.options.statics || extraOptions.statics) {
			Object.assign(mongooseSchema.statics, {
				...schema.options.statics,
				...extraOptions.statics,
				getDB: () => this,
			});
		}
		if (schema.options.methods || extraOptions.methods) {
			Object.assign(mongooseSchema.methods, {
				...schema.options.methods,
				...extraOptions.methods,
				getDB: () => this,
			});
		}

		// Setup schema indices.
		if (schema.options.indices) {
			schema.options.indices.forEach(indexDefinition => mongooseSchema.index(indexDefinition));
		}

		// Convert to Mongoose model.
		this.models[modelName] = mongoose.model(modelName, mongooseSchema, modelName.toLowerCase());

	}

	/*
	 * Converts the given hash of schema fields into a Mongoose schema recursively.
	 */
	__convertToMongooseSchema (input, isNested = false) {

		const fields = (input.constructor.name === `Schema` ? input.fields : input);

		const convertedProperties = {};

		for (const key in fields) {
			if (!fields.hasOwnProperty(key)) { continue; }

			const field = fields[key];

			switch (field.constructor.name) {

				// Nested in an array (i.e. a subdocument).
				case `Schema`:
					convertedProperties[key] = new MongooseSchema(this.__convertToMongooseSchema(field, true), { _id: false });
					break;

				// Nested properties.
				case `Object`:
					convertedProperties[key] = this.__convertToMongooseSchema(field, true);
					break;

				// A primitive.
				case `Property`:
					convertedProperties[key] = { type: this.__getPropertyDataType(field), default: field.defaultValue };
					break;

				// A subdocument.
				case `Array`:
					convertedProperties[key] = Object.values(this.__convertToMongooseSchema(field, true));
					break;

				// A reference to another model.
				case `Reference`:
					convertedProperties[key] = { type: MongooseSchema.Types.ObjectId, ref: field.referencedModel };
					break;

				default: throw new Error(`Invalid schema property type at "${key}".`);

			}
		}

		// We only need to turn the top level properties into a Mongoose schema.
		return (isNested ? convertedProperties : new MongooseSchema(convertedProperties));

	}

	/*
	 * Returns the appropriate JavaScript type for the given property's data type.
	 */
	__getPropertyDataType (field) {

		switch (field.dataType) {
			case `boolean`: return Boolean;
			case `date`: return Date;
			case `float`: return Number;
			case `integer`: return Number;
			case `string`: return String;
			case `flexible`: return MongooseSchema.Types.Mixed;
			default: throw new Error(`Invalid data type "${field.dataType}".`);
		}

	}

	/*
	 * Connect to the database.
	 */
	async connect () {

		// Are we mocking the database for testing?
		try {
			if (this.options.mock) { await this.__mockDatabase(); }
		}
		catch (err) {
			throw this.__error(`MOCK_FAILED`, { err });
		}

		// Connect to the database.
		try {
			await this.__connectToDatabase(this.options.connectionString);
		}
		catch (err) {
			throw this.__error(`CONNECT_FAILED`, { err });
		}

	}

	async disconnect () {
		// Connect to the database.
		try {
			await mongoose.disconnect();
		}
		catch (err) {
			throw this.__error(`DISCONNECT_FAILED`, { err });
		}

	}

	/*
	 * Sets up Mockgoose for testing.
	 */
	async __mockDatabase () {
		/* eslint global-require: 0 */
		/* eslint node/no-unpublished-require: 0 */

		const sharedLogger = this.__dep(`sharedLogger`);

		sharedLogger.info(`Preparing Mockgoose for testing...`);

		const { Mockgoose } = require(`mockgoose`);
		const mockedDatabase = new Mockgoose(mongoose);

		await mockedDatabase.prepareStorage();

		sharedLogger.info(`Mockgoose ready!`);

	}

	/*
	 * Connect to MongoDB.
	 */
	async __connectToDatabase (connectionString) {

		const sharedLogger = this.__dep(`sharedLogger`);

		sharedLogger.info(`Connecting to database...`);

		await mongoose.connect(connectionString, {
			useMongoClient: true,
		});

		sharedLogger.info(`Database ready!`);

	}

	/*
	 * Finds a single document that matches the given conditions.
	 */
	async get (modelName, conditions, options) {
		super.get(modelName, conditions, options);

		const Model = this.getModel(modelName);
		const query = Model.findOne(conditions).lean();

		this.__applyQueryOptions(query, options);

		return await query.exec() || null;

	}

	/*
	 * Finds an array of documents that match the given conditions.
	 */
	async find (modelName, conditions, options) {
		super.find(modelName, conditions, options);

		const Model = this.getModel(modelName);
		const query = Model.find(conditions).lean();

		this.__applyQueryOptions(query, options);

		return await query.exec() || [];

	}

	/*
	 * Inserts a new document or array of documents into the database. Return value is either a single record or an array
	 * of records based on what was inserted successfully.
	 */
	async insert (modelName, properties) {
		super.insert(modelName, properties);

		const propertiesList = (Array.isArray(properties) ? properties : [ properties ]);
		const Model = this.getModel(modelName);

		const documents = await Model.insertMany(propertiesList);
		const records = documents.map(document => document.toObject());

		return (propertiesList.length > 1 ? records : records[0]); // Returned objects must be lean!

	}

	/*
	 * Updates an existing document with the given changes. Input can be a document or a document ID.
	 */
	async update (modelName, input, changes, _options) {
		super.update(modelName, input, changes, _options);

		const options = extender.defaults({
			upsert: false,
			useConditions: false,
		}, _options);

		const Model = this.getModel(modelName);
		const documentId = this.__getDocumentId(input);
		const conditions = (options.useConditions ? input : { _id: documentId });

		// Perform the update operation.
		const newDocument = await Model.findOneAndUpdate(conditions, changes, {
			new: true,
			upsert: options.upsert,
			setDefaultsOnInsert: true,
		});
		if (!newDocument) { throw this.__error(`UPDATE_MISSING_DOCUMENT`, { modelName, documentId }); }

		return newDocument.toObject(); // Returned object must be lean!

	}

	/*
	 * Deletes an existing document. Input can be a document or a document ID.
	 */
	async delete (modelName, input) {
		super.delete(modelName, input);

		const Model = this.getModel(modelName);
		const documentId = this.__getDocumentId(input);

		// Perform the delete operation.
		await Model.findByIdAndRemove(documentId);

	}

	/*
	 * Deletes multiple existing documents that match the conditions.
	 */
	async deleteWhere (modelName, conditions) {
		super.deleteWhere(modelName, conditions);

		const Model = this.getModel(modelName);

		// Perform the delete operation.
		await Model.remove(conditions);

	}

	/*
	 * Apply options to the query to modify its behaviour.
	 */
	__applyQueryOptions (query, options = {}) {

		if (options.limit) { query.limit(options.limit); }
		if (options.skip) { query.skip(options.skip); }
		if (options.sort) { query.sort(options.sort); }
		if (options.populate) { query.populate(options.populate); }
		if (options.fields && options.fields.length) { query.select(options.fields.join(` `)); }

	}

	/*
	 * Returns the ID of the document.
	 */
	__getDocumentId (input) {

		switch (typeof input) {
			case `string`: return input;
			case `object`:
				if (input === null) { return null; }
				if (mongoose.Types.ObjectId.isValid(input)) { return input; }
				if (input._id) { return input._id; }
				return null;
			default: return null;
		}

	}

};
