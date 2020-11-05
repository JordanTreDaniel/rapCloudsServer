import mongoose, { Schema } from 'mongoose';
import { ArtistSchema } from './Artist'

const SongSchema = new mongoose.Schema({
	"annotation_count": Number,
	"api_path ": String,
	"apple_music_id": String,
	"apple_music_player_url": String,
	"description": Schema.Types.Mixed,
	"embed_content": String,
	"fact_track": {
		"provider": String,
		"external_url": String,
		"button_text": String,
		"help_link_text": String,
		"help_link_url": String
	},
	"featured_video": Boolean,
	"full_title": String,
	"header_image_thumbnail_url": String,
	"header_image_url": String,
	"id": Number,
	"lyrics_owner_id": Number,
	"lyrics_placeholder_reason": Schema.Types.Mixed,
	"lyrics_state": String,
	"lyrics": String,
	"path": String,
	"pyongs_count": Number,
	"recording_location": Schema.Types.Mixed,
	"release_date": String,
	"release_date_for_display": String,
	"song_art_image_thumbnail_url": String,
	"song_art_image_url": String,
	"stats": {
		"accepted_annotations": Number,
		"contributors": Number,
		"iq_earners": Number,
		"transcribers": Number,
		"unreviewed_annotations": Number,
		"verified_annotations": Number,
		"hot": Boolean,
		"pageviews": Number
	},
	"title": String,
	"title_with_featured": String,
	"url": String,
	"album": {
		"api_path": String,
		"cover_art_url": String,
		"full_title": String,
		"id": Number,
		"name": String,
		"url": String,
		"artist": ArtistSchema
	},
	"featured_artists": [ArtistSchema],
	"media": [],
	"primary_artist": ArtistSchema,
	"producer_artists": [ArtistSchema],
	"song_relationships": [],
	"verified_annotations_by": [
	],
	"verified_contributors": [],
	"verified_lyrics_by": [],
	"writer_artists": [ArtistSchema]
}
);

export default mongoose.model('Song', SongSchema);
