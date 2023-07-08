import mongoose, { Schema } from "mongoose";

const MaskSchema = new mongoose.Schema({
  userId: String,
  name: String,
  private: { type: Boolean, default: true },
  info: Schema.Types.Mixed, //TO-DO: Make a schema for the info cloudinary gives
});

export default mongoose.model("Mask", MaskSchema);
