import Mask from './models/Mask';
import fs from 'fs';
const mongoose = require('mongoose');

const seedDB = async () => {
	const collections = await mongoose.connection.collections;
	const collectionNames = Object.keys(collections);
	console.log('seeding', collectionNames);
	if (collectionNames.includes('masks')) {
		await Mask.collection.drop();
	}

	const paths = [ './ignore/drake.png', './ignore/cloud-with-moon.png' ];

	paths.forEach((path) => {
		const mask = new Mask();
		mask.img.data = fs.readFileSync(path);
		mask.img.contentType = 'image/png';
		mask.save();
	});
};

export default seedDB;
