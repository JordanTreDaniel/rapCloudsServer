import express from 'express';
var router = express.Router();
import User from '../db/models/User';

const updateUser = async (req, res, next) => {
	try {
		const { user } = req.body;
		await User.findOneAndUpdate({ _id: user._id }, user, { new: true }).exec();
		res.status(200).json({ user });
	} catch (error) {
		res.status(500).json(error);
	}
};

router.post('/updateUser', updateUser);

export default router;
