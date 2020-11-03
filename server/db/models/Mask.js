import mongoose from 'mongoose';

const MaskSchema = new mongoose.Schema({
	userId: String,
	name: String,
	img: { data: Buffer, contentType: String },
});

export default mongoose.model('Mask', MaskSchema);
