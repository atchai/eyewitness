'use strict';

/*
 * MIDDLEWARE: Refresh User Profile
 */

const { refreshUserProfile } = require(`../modules/userProfileRefresher`);

module.exports = function refreshUserProfileMiddleware (database, sharedLogger, triggerEvent, hippocampOptions) {

	// The actual middleware.
	return async (message, adapter, recUser, next/* , stop */) => {

		sharedLogger.debug({
			text: `Running middleware "refreshUserProfileMiddleware".`,
			direction: message.direction,
			message: message.text,
			userId: recUser._id.toString(),
			channelName: recUser.channel.name,
			channelUserId: recUser.channel.userId,
		});

		// Skip if the user profile functionality has been disabled.
		if (!hippocampOptions.enableUserProfile) { return next(null, recUser); }

		const options = {
			refreshEvery: hippocampOptions.refreshUsersEvery,
			whitelistProfileFields: hippocampOptions.whitelistProfileFields,
		};

		await refreshUserProfile(recUser, adapter, database, triggerEvent, options);

		return next(null, recUser);

	};

};
