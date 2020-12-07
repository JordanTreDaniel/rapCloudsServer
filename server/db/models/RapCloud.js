import mongoose, { Schema } from 'mongoose';

const RapCloudSettingsSchema = new mongoose.Schema({
	backgroundColor: String,
	collocations: Boolean,
	coloredBackground: Boolean,
	colorFromMask: Boolean,
	colors: [ String ],
	contour: Boolean,
	contourColor: String,
	contourWidth: String,
	detectEdges: Boolean,
	downSample: String,
	height: String,
	includeNumbers: Boolean,
	maskAsBackground: Boolean,
	maskDesired: Boolean,
	maskId: Schema.Types.ObjectId,
	repeat: Boolean,
	stopWords: [ String ],
	transparentBackground: Boolean,
	useCustomColors: Boolean,
	useRandomColors: Boolean,
	whiteThreshold: String,
	width: String,
	private: Boolean,
});

const RapCloudSchema = new mongoose.Schema({
	artistIds: [ String ],
	description: String,
	settings: RapCloudSettingsSchema,
	songIds: [ String ], //NOTE: Not using Schema.Types.ObjectId here bc the id's are genius ids
	userId: Schema.Types.ObjectId,
	info: Schema.Types.Mixed, //TO-DO: Make a schema for the info cloudinary gives
	inspirationType: String,
	lyricString: { type: String, default: "Lyric string wasn't provided upon creation." },
});

export default mongoose.model('RapCloud', RapCloudSchema);
