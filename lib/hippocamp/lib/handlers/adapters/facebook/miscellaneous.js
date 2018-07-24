'use strict';

/*
 * Respond with 403 if the verify token is incorrect.
 */
function validateVerifyToken (req, res, correctVerifyToken) {

	if (req.query[`hub.mode`] === `subscribe` && req.query[`hub.verify_token`] === correctVerifyToken) {
		return res.status(200).respond(req.query[`hub.challenge`], false);
	}
	else {
		return res.status(403).respond();
	}

}

/*
 *
 */
module.exports = {
	validateVerifyToken,
};
