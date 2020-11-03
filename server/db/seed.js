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

	const ignoreDir = fs.readdirSync('./ignore');
	ignoreDir.forEach((fileName) => {
		const [ name, ext ] = fileName.split('.');
		const mask = new Mask();
		mask.name = name;
		mask.img.data = fs.readFileSync(`./ignore/${fileName}`);
		mask.img.contentType = `image/${ext}`;
		mask.save();
	});
};

export default seedDB;
