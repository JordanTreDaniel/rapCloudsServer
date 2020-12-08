import Mask from './models/Mask';
import fs from 'fs';
const mongoose = require('mongoose');
import cloudinary from 'cloudinary';

const seedDB = async () => {
	const collections = await mongoose.connection.collections;
	const collectionNames = Object.keys(collections);
	console.log('seeding', collectionNames);
	try {
		const masks = await Mask.find({ userId: { $in: [ undefined, null ] } }).exec();
		console.log(`There are ${masks.length} public masks to delete.`);
		for (let maskIdx = 0; maskIdx < masks.length; maskIdx++) {
			const mask = masks[maskIdx];
			const { public_id } = mask.info;
			console.log('deleting public_id', public_id);
			await cloudinary.v2.uploader.destroy(public_id);
			await mask.deleteOne();
		}
	} catch (error) {
		console.log('Problem dropping mask collection', error);
	}
	const ignoreDir = fs.readdirSync('./ignore');
	for (let idx = 0; idx < ignoreDir.length; idx++) {
		const fileName = ignoreDir[idx];
		console.log(`Adding ${fileName} as a public mask.`);
		const [ name, ext ] = fileName.split('.');
		if (!name.length) {
			continue;
		}
		const cloudinaryResult = await cloudinary.v2.uploader.upload(
			`ignore/${fileName}`,
			{ folder: process.env.NODE_ENV === 'development' ? '/publicMasksDev' : '/publicMasks' },
			(error, result) => {
				if (error) {
					console.log('Something went wrong while trying to save your Mask to Cloudinary.', error);
					return error;
				}
				return result;
			},
		);
		const mask = new Mask({ name, private: false, info: cloudinaryResult });
		await mask.save();
	}
};

export default seedDB;
