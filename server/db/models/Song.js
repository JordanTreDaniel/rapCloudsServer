import mongoose from 'mongoose';

const SongSchema = new mongoose.Schema({
	annotation_count: Number,
	api_path: String,
	full_title: String,
	header_image_thumbnail_url: String,
	header_image_url: String,
	id: Number,
	lyrics_owner_id: Number,
	lyrics_state: String,
	path: String,
	pyongs_count: Number,
	song_art_image_thumbnail_url: String,
	song_art_image_url: String,
	stats: {
		unreviewed_annotations: Number,
		hot: Boolean,
		pageviews: Number
	},
	title: String,
	title_with_featured: String,
	url: String,
	primary_artist: {
		api_path: String,
		header_image_url: String,
		id: Number,
		image_url: String,
		is_meme_verified: Boolean,
		is_verified: Boolean,
		name: String,
		url: String,
	},
	lyrics: String
});

export default mongoose.model('Song', SongSchema);
