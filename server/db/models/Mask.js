import mongoose from 'mongoose';

const MaskSchema = new mongoose.Schema({
	img: { data: Buffer, contentType: String }
});

export default mongoose.model('Mask', MaskSchema);
