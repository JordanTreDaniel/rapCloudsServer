import mongoose, { Schema } from "mongoose";

const RapCloudSettingsSchema = new mongoose.Schema({
	addWatermark: Boolean,
	backgroundColor: String,
	blackoutThreshold: Number,
	collocations: Boolean,
	coloredBackground: Boolean,
	colorFromMask: Boolean,
	colors: [String],
	contour: Boolean,
	contourColor: String,
	contourWidth: Number,
	currentFontName: String,
	currentFontVariantIdx: Number,
	detectEdges: Boolean,
	downsample: Number,
	fadeCloud: Boolean,
	font: {
		name: String,
		addy: String,
	},
	fontDesired: Boolean,
	height: Number,
	includeNumbers: Boolean,
	margin: Number,
	maskAsBackground: Boolean,
	maskDesired: Boolean,
	maskId: Schema.Types.ObjectId,
	cloudOpacity: Number,
	maxFontSize: Number,
	minFontSize: Number,
	preferHorizontal: Number,
	private: Boolean,
	relativeScaling: Number,
	repeat: Boolean,
	stopWords: [String],
	transparentBackground: Boolean,
	useCustomColors: Boolean,
	useRandomColors: Boolean,
	whiteThreshold: Number,
	width: Number,
});

const RapCloudSchema = new mongoose.Schema({
	artistIds: [String],
	description: String,
	settings: RapCloudSettingsSchema,
	songIds: [String], //NOTE: Not using Schema.Types.ObjectId here bc the id's are genius ids
	userId: Schema.Types.ObjectId,
	info: Schema.Types.Mixed, //TO-DO: Make a schema for the info cloudinary gives
	inspirationType: String,
	lyricString: {
		type: String,
		default: "Lyric string wasn't provided upon creation.",
	},
	officialCloud: { type: Boolean, default: false },
	private: { type: Boolean, default: true },
});

export default mongoose.model("RapCloud", RapCloudSchema);
