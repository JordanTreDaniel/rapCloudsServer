import express from 'express';
import axios from 'axios';
import Song from '../db/models/Song';
import Mask from '../db/models/Mask';
import RapCloud from '../db/models/RapCloud';
import Artist from '../db/models/Artist';
import seedDB from '../db/seed';
import cloudinary from 'cloudinary';
import fs from 'fs';
const router = express.Router();

async function search(req, res, next) {
	const { query } = req;
	const { q } = query;
	const { headers } = req;
	// const { accessToken } = req.session; //TO-DO: Get access token to be dependably stored in session, so we don't save on User.
	const { authorization: accessToken } = headers;
	if (!accessToken) {
		res.status(401).json({ status: 401, statusText: 'Missing access token. Please sign in first' });
		// made a mistake with the line above and this helped me out:
		//https://stackoverflow.com/questions/7042340/error-cant-set-headers-after-they-are-sent-to-the-client
	}
	try {
		const { data } = await axios({
			method: 'get',
			url: `https://api.genius.com/search`,
			headers: {
				accept: 'application/json',
				// host: "api.genius.com",
				authorization: `Bearer ${accessToken}`,
			},
			params: {
				q,
			},
		});
		const { meta, response } = data;
		const { status } = meta;
		const { hits } = response;
		const songs = hits.map((hit) => hit.result);
		const artists = songs.reduce((artists, song) => {
			const { primary_artist, featured_artists = [] } = song;
			artists[primary_artist.id] = primary_artist;
			featured_artists.forEach((artist) => (artists[artist.id] = artist));
			return artists;
		}, {});
		res.status(status).json({ songs, artists });
		//TO-DO: Is there a way to findManyOrCreate?
		songs.forEach(async (song) => {
			let mongooseSong = await Song.findOne({ id: song.id }, (err, foundInstance) => {
				return foundInstance;
			});
			if (!mongooseSong) {
				mongooseSong = new Song(song);
				mongooseSong.save();
			}
			await saveArtistsFromSong(song);
		});
	} catch (err) {
		const { status, statusText } = err.response;
		res.status(401).json({ status, statusText });
	}
}

const fetchYtInfo = async (song) => {
	const watchUrl = ((song.media || []).find((mediaInfo) => mediaInfo.provider === 'youtube') || {}).url;
	if (!watchUrl) return { problem: "Couldn't find youtube media info on song." };
	const res = await axios({ method: 'get', url: `https://www.youtube.com/oembed?url=${watchUrl}&format=json` });
	return res;
};

const saveArtistsFromSong = async (song) => {
	const { primary_artist, featured_artists = [], producer_artists = [] } = song;
	const artists = [ primary_artist, ...featured_artists, ...producer_artists ];
	for (var artist of artists) {
		const { id: artistId } = artist;
		let mongoArtist = await Artist.findOne({ id: artistId }).exec();
		if (!mongoArtist) {
			mongoArtist = new Artist(artist);
			await mongoArtist.save();
		}
	}
};

async function getSongDetails(req, res, next) {
	const { params, headers } = req;
	const { songId } = params;
	// const { accessToken } = req.session; //TO-DO: Get access token to be dependably stored in session, so we don't save on User.
	const { authorization: accessToken } = headers;
	if (!accessToken) {
		res.status(401).json({ status: 401, statusText: 'Missing access token. Please sign in first' });
		// made a mistake with the line above and this helped me out:
		//https://stackoverflow.com/questions/7042340/error-cant-set-headers-after-they-are-sent-to-the-client
	}
	try {
		const { data } = await axios({
			method: 'get',
			url: `https://api.genius.com/songs/${songId}`,
			headers: {
				accept: 'application/json',
				// host: "api.genius.com",
				authorization: `Bearer ${accessToken}`,
			},
		});
		const { meta, response } = data;
		let { song } = response;
		const { data: ytData, error } = await fetchYtInfo(song);
		if (!error) song.ytData = ytData;
		let mongooseSong = await Song.findOne({ id: songId }).exec();
		if (mongooseSong) {
			Object.assign(mongooseSong, song);
			await mongooseSong.save();
			song = mongooseSong;
		} else {
			console.log('Details fetched for previously unknown song. Going to save it.');
			song = new Song(song);
			await song.save();
		}
		res.status(200).json({
			song: song.toObject(),
		});
		// await saveArtistsFromSong(song); //TO-DO: Re-instate
	} catch (err) {
		console.log('SOMETHING WENT WRONG in getSongDetails', err);
		res.status(500).json({ err });
	}
}

async function getSongClouds(req, res, next) {
	const { params } = req;
	const { songId, userId } = params;
	try {
		let officalCloud = await RapCloud.findOne({ songIds: [ songId ], officialCloud: true });
		let userMadeClouds = await RapCloud.find({ songIds: [ songId ], userId: userId });
		res.status(200).json({
			officalCloud:
				officalCloud && officalCloud.info ? { ...officalCloud.toObject(), id: officalCloud._id } : null,
			userMadeClouds: userMadeClouds.filter((cloud) => !cloud.info).map((c) => ({ ...c.toObject(), id: c._id })),
		});
	} catch (err) {
		console.log('SOMETHING WENT WRONG in getSongClouds', err);
		res.status(500).json({ err });
	}
}

async function apiGetSongLyrics(songPath) {
	let tries = 1,
		lyrics = '',
		lyricStatus;
	while (tries <= 3 && !lyrics.length) {
		const { status: _lyricStatus, data: lyricData } = await axios({
			method: 'get',
			url: `https://ukaecdgqm1.execute-api.us-east-1.amazonaws.com/default/getGeniusRapLyrics`,
			headers: {
				accept: 'application/json',
				// host: "api.genius.com",
				// authorization: `Bearer ${accessToken}`
			},
			params: {
				lyricsPath: songPath,
			},
		});
		lyrics = lyricData.lyrics || '';
		lyricStatus = _lyricStatus;
		tries++;
	}
	return { lyrics, lyricStatus };
}

async function getSongLyrics(req, res, next) {
	const { body } = req;
	const { songPath, songId } = body;
	if (!songPath || !songId) {
		res.status(400).json({ status: 400, statusText: 'Path to page with lyrics, and song id are required.' });
	}
	try {
		const { lyrics, lyricStatus } = await apiGetSongLyrics(songPath);
		res.status(lyricStatus).json({ lyrics });
		let mongooseSong = await Song.findOne({ id: songId }, (err, foundInstance) => {
			return foundInstance;
		});
		if (mongooseSong) {
			mongooseSong.lyrics = lyrics;
			// mongooseSong.markModified('lyrics');
			const result = await mongooseSong.save();
		}
	} catch (err) {
		console.log('SOMETHING WENT WRONG', err);
		res.status(500).json({ err });
	}
}

async function base64ToFile(fileName, data) {
	return new Promise((resolve, reject) => {
		fs.writeFile(fileName, data, 'base64', function(err) {
			if (err) {
				console.log('Something went wrong with fs.writeFile', err);
				reject(err);
			} else {
				resolve();
			}
		});
	});
}

async function triggerCloudGeneration(req, res, next) {
	const { headers, body, params } = req;
	const { socketId } = params;
	const {
		lyricString,
		settings,
		artistIds = [],
		description = `A RapCloud that you love.`,
		songIds = [],
		userId,
		inspirationType = 'song, artist, or album',
		officialCloud,
	} = body;
	const { maskId } = settings;
	const mask = maskId ? await Mask.findById(maskId).exec() : null;
	try {
		const newCloud = new RapCloud({
			artistIds,
			description,
			settings,
			songIds,
			userId,
			inspirationType,
			lyricString,
			officialCloud,
		});
		await newCloud.save();
		const { data, status, error } = await axios({
			method: 'post',
			url: process.env.CLOUD_GEN_ENDPOINT,
			headers: {
				'Content-Type': 'application/json',
				'Access-Control-Allow-Origin': '*',
			},
			data: {
				lyricString,
				maskUrl: mask && mask.info.url,
				cloudSettings: settings,
				socketId,
				cloudId: newCloud._id,
				officialCloud,
			},
		});
		const { message } = data;
		res.status(200).json({ cloud: { ...newCloud.toObject(), id: newCloud._id }, message });
	} catch (err) {
		console.log('SOMETHING WENT WRONG in triggerCloudGeneration', { err });
		res.status(500).json({ err });
	}
}

async function handleNewCloud(req, res, next) {
	const { body } = req;
	const { socketId, cloudId, cloudInfo, error } = body;
	try {
		const io = req.app.get('io');
		if (error) {
			io.in(socketId).emit('RapCloudError', { error, cloudId, socketId });
			res.status(200).json({ message: 'Error received from python script & reported to React app.' });
		} else {
			const rapCloud = await RapCloud.findOneAndUpdate(
				{ _id: cloudId },
				{ info: cloudInfo },
				{ new: true, useFindAndModify: false },
			);
			await rapCloud.save();
			io.in(socketId).emit('RapCloudFinished', { ...rapCloud.toObject(), id: rapCloud._id });
			res.status(200).json({ message: 'Cloud is saved and sent back to client.' });
		}
	} catch (err) {
		console.log('SOMETHING WENT WRONG in handleNewCloud', { err });
		res.status(500).json({ err });
	}
}

const saveSongs = async (songs) => {
	for (var song of songs) {
		const { id: songId } = song;
		let mongoSong = await Song.findOne({ id: songId }).exec();
		mongoSong = mongoSong ? Object.assign(mongoSong, song) : new Song(song);
		await mongoSong.save();
	}
};

const apiFetchArtistSongs = async (artistId, accessToken, options = {}) => {
	const { per_page = 9, page = 1 } = options;
	const { data: artistSongsData } = await axios({
		method: 'get',
		url: `https://api.genius.com/artists/${artistId}/songs?per_page=${per_page}&page=${page}&sort=${'popularity'}`,
		headers: {
			accept: 'application/json',
			// host: "api.genius.com",
			authorization: `Bearer ${accessToken}`,
		},
	});
	const { meta: songsDataMeta, response: songsDataResponse } = artistSongsData;
	const { songs: artistSongs, next_page } = songsDataResponse;
	const nextPage = next_page || null;
	return { artistSongs, nextPage };
};

async function getArtistDetails(req, res, next) {
	const { params, headers } = req;
	const { artistId } = params;
	// const { accessToken } = req.session; //TO-DO: Get access token to be dependably stored in session, so we don't save on User.
	const { authorization: accessToken } = headers;
	if (!accessToken) {
		res.status(401).json({ status: 401, statusText: 'Missing access token. Please sign in first' });
	}

	try {
		const { data } = await axios({
			method: 'get',
			url: `https://api.genius.com/artists/${artistId}`,
			headers: {
				accept: 'application/json',
				// host: "api.genius.com",
				authorization: `Bearer ${accessToken}`,
			},
		});
		const { _, response } = data;

		let { artist } = response;
		let mongoArtist = await Artist.findOne({ id: artistId }).exec();
		artist = mongoArtist ? Object.assign(mongoArtist, artist) : new Artist(artist);
		res.status(200).json({ artist });
		await artist.save();
	} catch (err) {
		console.log('SOMETHING WENT WRONG', err);
		const { status, statusText } = err.response;
		res.status(500).json({ status, statusText });
	}
}

async function getArtistSongs(req, res, next) {
	const { params, headers } = req;
	const { artistId, page = 1 } = params;
	// const { accessToken } = req.session; //TO-DO: Get access token to be dependably stored in session, so we don't save on User.
	const { authorization: accessToken } = headers;
	if (!accessToken) {
		res.status(401).json({ status: 401, statusText: 'Missing access token. Please sign in first' });
	}
	try {
		const { artistSongs: songs, nextPage } = await apiFetchArtistSongs(artistId, accessToken, { page });
		res.status(200).json({ songs, nextPage });
		saveSongs(songs);
	} catch (err) {
		console.log('SOMETHING WENT WRONG', err);
		const { status, statusText } = err.response;
		res.status(500).json({ status, statusText });
	}
}

const views = (req, res, next) => {
	if (req.session.views) {
		req.session.views++;
		res.setHeader('Content-Type', 'text/html');
		res.write('<p>views: ' + req.session.views + '</p>');
		res.write('<p>expires in: ' + req.session.cookie.maxAge / 1000 + 's</p>');
		res.end();
	} else {
		req.session.views = 1;
		res.end('welcome to the session demo. refresh!');
	}
};

async function getMasks(req, res, next) {
	const { params } = req;
	const { userId = 'default' } = params;
	try {
		Mask.find({ userId: { $in: [ undefined, userId ] } }, function(err, masks) {
			if (err) {
				res.status(500).json({ message: 'Something went wrong fetching resources from DB', err });
			}
			//TO-DO: Modify query to pull public assets as well
			res.status(200).json({ masks: masks.map((mask) => ({ ...mask.toObject(), id: mask._id })) });
		});
	} catch (error) {
		res.status(500).json(error);
	}
}

async function getClouds(req, res, next) {
	const { params } = req;
	const { userId = 'default' } = params;
	try {
		RapCloud.find({ userId: { $in: [ userId ] }, officialCloud: false }, function(err, clouds) {
			if (err) {
				res.status(500).json({ message: 'Something went wrong fetching resources from DB', err });
			}
			//TO-DO: Modify query to pull public assets as well
			res.status(200).json({
				clouds: clouds.filter((cloud) => !cloud.info).map((cloud) => ({ ...cloud.toObject(), id: cloud._id })),
			});
		});
	} catch (error) {
		res.status(500).json(error);
	}
}

async function addMask(req, res, next) {
	const { body } = req;
	const { newMask } = body;
	try {
		let mask = new Mask({
			userId: newMask.userId,
			info: newMask.cloudinaryInfo,
		});
		mask = await mask.save();
		res.status(200).json({ mask: { ...mask.toObject(), id: mask._id } });
	} catch (error) {
		res.status(500).json(error);
	}
}

async function deleteMask(req, res, next) {
	const { body } = req;
	const { maskId, public_id } = body;
	try {
		await Mask.findOneAndDelete({ _id: maskId }).exec();
		await cloudinary.v2.uploader.destroy(public_id);
		res.status(200).json({
			message: 'Deleted Successfully.',
			maskId,
		});
	} catch (error) {
		res.status(500).json(error);
	}
}

async function deleteCloud(req, res, next) {
	const { body } = req;
	const { cloudId, public_id } = body;
	try {
		await RapCloud.findOneAndDelete({ _id: cloudId }).exec();
		if (public_id) {
			await cloudinary.v2.uploader.destroy(public_id);
		}
		res.status(200).json({
			message: 'Deleted Successfully.',
			cloudId,
		});
	} catch (error) {
		res.status(500).json(error);
	}
}

async function deleteAllClouds(req, res, next) {
	try {
		const rapClouds = await RapCloud.find({}).exec();
		const deletedClouds = [];
		for (const rapCloud of rapClouds) {
			const { _id, info = {} } = rapCloud;
			const { public_id } = info;
			if (public_id) {
				await cloudinary.v2.uploader.destroy(public_id);
			} else {
				console.log('Found a rapCloud with no public_id', rapCloud);
			}
			await RapCloud.findByIdAndDelete(_id);
			deletedClouds.push(_id);
		}
		res.status(200).json({
			message: 'Deleted Successfully.',
			deletedClouds,
		});
	} catch (error) {
		console.log('Something went wrong in deleteAllClouds', error);
		res.status(500).json(error);
	}
}

//TO-DO: Put this function on automatic timer
async function deleteBadClouds(req, res, next) {
	try {
		const rapClouds = await RapCloud.deleteMany({ info: undefined }).exec();
		res.status(200).json({
			message: 'Deleted Successfully.',
			rapClouds,
		});
	} catch (error) {
		console.log('Something went wrong in deleteBadClouds', error);
		res.status(500).json(error);
	}
}

async function pruneCloudinary(req, res, next) {
	try {
		let cloudinaryResult,
			next_cursor,
			resources = [];
		const cloudinaryCallOptions = { max_results: 500 };
		do {
			await cloudinary.v2.api.resources(cloudinaryCallOptions, function(error, result) {
				cloudinaryResult = result;
				next_cursor = result.next_cursor;
				resources.push(...result.resources);
			});
		} while (next_cursor);

		const deletedResources = [];
		for (const resource of resources) {
			const { public_id } = resource;
			const rapClouds = await RapCloud.find({ 'info.public_id': public_id });
			const masks = await Mask.find({ 'info.public_id': public_id });
			// console.log({ rapClouds, masks });
			const conditions = [ !rapClouds.length, !masks.length ];
			const matchesDev = public_id.toLowerCase().match('dev');
			conditions.push(process.env.NODE_ENV === 'development' ? matchesDev : !matchesDev);
			if (conditions.every((c) => c)) {
				// console.log('Found a resource with no matching rapCloud or mask', resource);
				await cloudinary.v2.uploader.destroy(public_id);
				deletedResources.push(public_id);
			}
		}
		res.status(200).json({
			message: 'Pruned Successfully.',
			resources,
			deletedResources,
			cloudinaryResult,
		});
	} catch (error) {
		console.log('Something went wrong in pruneCloudinary', error);
		res.status(500).json(error);
	}
}
 
async function seed(req, res, next) {
	try {
		await seedDB();
		res.status(200).json('Done!');
	} catch (error) {
		res.status(500).json(error);
	}
}

async function verifyAdmin(req, res, next) {
	try {
		const { params } = req;
		const { adminPassword } = params;
		if (adminPassword !== process.env.ADMIN_PASSWORD) {
			res.status(403).json({ message: 'Admin password needed' });
			return;
		}
		next();
	} catch (error) {
		res.status(500).json(error);
	}
}

router.get('/search', search);
router.get('/getSongDetails/:songId', getSongDetails);
router.get('/getSongClouds/:songId/:userId', getSongClouds);
router.get('/getArtistDetails/:artistId', getArtistDetails);
router.get('/getArtistSongs/:artistId/:page', getArtistSongs);
router.post('/triggerCloudGeneration/:socketId', triggerCloudGeneration);
router.post('/newCloud/', handleNewCloud);
router.post('/getSongLyrics', getSongLyrics);
router.get('/masks/:userId?', getMasks);
router.get('/getClouds/:userId?', getClouds);
router.post('/addMask', addMask);
router.post('/deleteMask', deleteMask);
router.post('/deleteCloud', deleteCloud);
//Admin Endpoints
router.get('/views/:adminPassword', verifyAdmin, views);
router.get('/deleteAllClouds/:adminPassword', verifyAdmin, deleteAllClouds);
router.get('/deleteBadClouds/:adminPassword', verifyAdmin, deleteBadClouds);
router.get('/pruneCloudinary/:adminPassword', verifyAdmin, pruneCloudinary);
router.get('/seed/:adminPassword', verifyAdmin, seed);

export default router;
