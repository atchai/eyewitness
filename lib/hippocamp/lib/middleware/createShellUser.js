'use strict';

/*
 * MIDDLEWARE: Create Shell User
 */

module.exports = function createShellUserMiddleware (database, sharedLogger, triggerEvent, hippocampOptions) {

	// The actual middleware.
	return async (message, adapter, _recUser, next/* , stop */) => {

		// We don't want to create a new shell user if we already have a user record.
		if (_recUser) {

			let recUser;

			// If the user record exists but has been wiped we are allowed to update the reference.
			if (!_recUser.profile.lastUpdated && message.referral) {
				const dbChanges = { 'profile.referral': message.referral };

				// If profile refreshing is disabled the "lastUpdated" flag will never get updated, so we update it here.
				if (!hippocampOptions.enableUserProfile) { dbChanges[`profile.lastUpdated`] = Date.now(); }

				recUser = await database.update(`User`, _recUser, dbChanges);
			}

			else {
				recUser = _recUser;
			}

			// Otherwise we just need to skip creating a new shell user.
			return next(null, recUser);

		}

		// Insert a new shell user.
		const recUser = await database.insert(`User`, {
			channel: {
				name: message.channelName,
				userId: message.channelUserId,
			},
			profile: {
				referral: message.referral || null,
			},
		});

		sharedLogger.debug({
			text: `Running middleware "createShellUserMiddleware".`,
			direction: message.direction,
			message: message.text,
			userId: recUser._id.toString(),
			channelName: recUser.channel.name,
			channelUserId: recUser.channel.userId,
		});

		// Trigger event listeners.
		await triggerEvent(`encountered-new-user`, { recUser });

		return next(null, recUser);

	};

};
