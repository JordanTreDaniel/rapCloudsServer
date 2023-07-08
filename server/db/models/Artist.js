import mongoose, { Schema } from 'mongoose';

export const ArtistSchema = new mongoose.Schema({
    alternate_names: [String],
    api_path: String,
    description: Schema.Types.Mixed,
    facebook_name: String,
    followers_count: Number,
    header_image_url: String,
    id: Number,
    image_url: String,
    instagram_name: String,
    is_meme_verified: Boolean,
    is_verified: Boolean,
    iq: Number,
    name: String,
    translation_artist: Boolean,
    twitter_name: String,
    url: String,
    current_user_metadata: Schema.Types.Mixed,
    user: Schema.Types.Mixed,
    robertLikes: Boolean,
});
export default mongoose.model('Artist', ArtistSchema);
