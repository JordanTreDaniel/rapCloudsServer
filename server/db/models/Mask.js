import mongoose, { Schema } from 'mongoose';

const MaskSchema = new mongoose.Schema({
	userId: String,
	name: String,
	info: Schema.Types.Mixed,
});

export default mongoose.model('Mask', MaskSchema);
