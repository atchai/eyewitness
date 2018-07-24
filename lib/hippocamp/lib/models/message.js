'use strict';

/*
 * SCHEMA: Message
 */

module.exports = function (Schema, Property, Reference) {

	return new Schema(`Message`, {
		_user: new Reference(`User`),
		_admin: new Reference(`User`, null),
		direction: new Property(`string`, null),
		sentAt: new Property(`date`, Date.now),
		sendDelay: new Property(`integer`, null),
		humanToHuman: new Property(`boolean`, false),
		batchable: new Property(`boolean`, false),
		data: new Property(`flexible`),
	}, {
		indices: [
			{ direction: 1, _user: 1, sentAt: -1 },
			{ humanToHuman: 1, _user: 1, sentAt: -1 },
			{ _user: 1, sentAt: -1 },
		],
	});

};
