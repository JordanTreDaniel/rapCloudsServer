import mongoose, { Schema } from "mongoose";

const IdentitySchema = {
  id: Number,
  name: String,
  provider: String,
  custom_properties: Array,
};

const UserSchema = new mongoose.Schema({
  // _id: mongoose.Schema.Types.Mixed,
  _id: Number,
  about_me: {
    dom: {
      tag: String,
    },
  },
  api_path: String,
  available_identity_providers: Array,
  avatar: {
    tiny: {
      url: String,
      bounding_box: {
        width: Number,
        height: Number,
      },
    },
    thumb: {
      url: String,
      bounding_box: {
        width: Number,
        height: Number,
      },
    },
    small: {
      url: String,
      bounding_box: {
        width: Number,
        height: Number,
      },
    },
    medium: {
      url: String,
      bounding_box: {
        width: Number,
        height: Number,
      },
    },
  },
  custom_header_image_url: String,
  email: String,
  followed_users_count: Number,
  followers_count: Number,
  header_image_url: String,
  human_readable_role_for_display: String,
  id: Number,
  identities: [IdentitySchema],
  iq: Number,
  iq_for_display: String,
  login: String,
  name: String,
  photo_url: String,
  preferences: {
    mention_notifications: Boolean,
    creation_comment_notifications: Boolean,
    mentioned_forum_notifications: Boolean,
    discussion_creation_notifications: Boolean,
    message_notifications: Boolean,
    followed_thread_notifications: Boolean,
    editorial_suggestion_notifications: Boolean,
    forum_post_creation_notifications: Boolean,
  },
  role_for_display: Array,
  roles_for_display: Array,
  unread_groups_inbox_count: Number,
  unread_main_activity_inbox_count: Number,
  unread_messages_count: Number,
  unread_newsfeed_inbox_count: Number,
  url: String,
  current_user_metadata: {
    permissions: [String],
    excluded_permissions: [String],
    interactions: {
      following: Boolean,
    },
    features: [String],
  },
  artist: String, //TO-DO: probably incorrect type. I don't have the artist schema yet though
  stats: {
    annotations_count: Number,
    answers_count: Number,
    comments_count: Number,
    forum_posts_count: Number,
    pyongs_count: Number,
    questions_count: Number,
    transcriptions_count: Number,
  },
  accessToken: String,
  awsAuthInfo: Schema.Types.Mixed,
});

export default mongoose.model("User", UserSchema);
