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
		//TO-DO: Is there a way to findManyOrCreate?
		const mongooseSongs = songs.map(async (song) => {
			let mongooseSong = await Song.findOne({ id: song.id }, (err, foundInstance) => {
				return foundInstance;
			});
			if (!mongooseSong) {
				mongooseSong = new Song(song);
				mongooseSong.save();
			}
			return mongooseSong;
		});
		res.status(status).json({ songs });
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
		const { status } = meta;
		const { song } = response;
		const { data: ytData, error } = await fetchYtInfo(song);
		if (!error) song.ytData = ytData;
		let mongooseSong = await Song.findOne({ id: songId }).exec();
		if (mongooseSong) {
			Object.assign(mongooseSong, song);
			await mongooseSong.save();
		}
		res.status(status).json({ song });
	} catch (err) {
		console.log('SOMETHING WENT WRONG', err);
		const { status, statusText } = err.response;
		res.status(status).json({ status, statusText });
	}
}

async function getSongLyrics(req, res, next) {
	const { body } = req;
	const { songPath, songId } = body;
	if (!songPath || !songId) {
		res.status(400).json({ status: 400, statusText: 'Path to page with lyrics, and song id are required.' });
	}
	try {
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
		let mongooseSong = await Song.findOne({ id: songId }, (err, foundInstance) => {
			return foundInstance;
		});
		if (mongooseSong) {
			mongooseSong.lyrics = lyrics;
			// mongooseSong.markModified('lyrics');
			const result = await mongooseSong.save();
		}
		res.status(lyricStatus).json({ lyrics });
	} catch (err) {
		console.log('SOMETHING WENT WRONG', err);
		res.status(500).json({ err });
	}
}

async function generateCloud(req, res, next) {
	const { headers, body } = req;
	const {
		lyricString,
		settings,
		artistIds = [],
		description = `A RapCloud that you love.`,
		songIds = [],
		userId,
		inspirationType = 'song, artist, or album',
	} = body;
	const { maskId } = settings;
	const mask = maskId ? await Mask.findById(maskId).exec() : null;
	try {
		const isLocalBuild = headers.host.match('localhost');

		const { data, status, error } = await axios({
			method: 'post',
			url: isLocalBuild ? 'http://localhost:5000' : `https://o049r3fygh.execute-api.us-east-1.amazonaws.com/dev`,
			headers: {
				'Content-Type': 'application/json',
				'Access-Control-Allow-Origin': '*',
			},
			data: {
				lyricString,
				maskUrl: mask && mask.info.url,
				cloudSettings: settings,
			},
		});
		const encodedCloud = data.encodedCloud.replace(/(\r\n|\n|\r)/gm, '');
		await fs.writeFile('tempCloud.png', encodedCloud, 'base64', function(err) {
			if (err) {
				console.log('Something went wrong with fs.writeFile', err);
				res
					.status(500)
					.json({ err, message: 'Something went wrong while trying to save the new cloud to the db & cdn' });
			}
		});
		const cloudinaryResult = await cloudinary.v2.uploader.upload(
			'tempCloud.png',
			// `data:image/png;base64, ${encodedCloud}`, //TO-DO: Fix problem with using base64. Could be faster.
			{ folder: '/userMadeClouds' },
			(error, result) => {
				if (error) {
					console.log('Something went wrong while trying to save your RapCloud to Cloudinary.', error);
					return error;
				}
				console.log('cloudinaryResult', { result, error });
				return result;
			},
		);
		fs.unlink('tempCloud.png', (err) => {
			if (err) {
				console.log('Something went wrong while removing tempCloud.png');
			} else {
				console.log('Removed tempCloud.png', err);
			}
		});
		const rapCloud = new RapCloud({
			info: cloudinaryResult,
			artistIds,
			description,
			settings,
			songIds,
			userId,
			inspirationType,
			lyricString,
		});
		rapCloud.save();
		res.status(200).json({ data: { rapCloud: { ...rapCloud.toObject(), id: rapCloud._id } } });
	} catch (err) {
		console.log('SOMETHING WENT WRONG', { err });
		const { status, statusText, data } = err.response;
		res.status(status).json({ status, statusText, data });
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

const apiFetchArtistSongs = async (artistId, accessToken, nextPage = 1) => {
	const { data: artistSongsData } = await axios({
		method: 'get',
		url: `https://api.genius.com/artists/${artistId}/songs?per_page=${20}&page=${nextPage}&sort=${'popularity'}`,
		headers: {
			accept: 'application/json',
			// host: "api.genius.com",
			authorization: `Bearer ${accessToken}`,
		},
	});
	const { meta: songsDataMeta, response: songsDataResponse } = artistSongsData;
	const { songs: artistSongs, next_page } = songsDataResponse;
	nextPage = next_page || null;
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
		const { meta, response } = data;

		const { status } = meta;
		let { artist } = response;
		let mongoArtist = await Artist.findOne({ id: artistId }).exec();
		artist = mongoArtist ? Object.assign(mongoArtist, artist) : new Artist(artist);
		await artist.save();
		const { artistSongs: songs, nextPage } = await apiFetchArtistSongs(artistId, accessToken);
		res.status(status).json({ artist, songs, nextPage });
		saveSongs(songs);
	} catch (err) {
		console.log('SOMETHING WENT WRONG', err);
		const { status, statusText } = err.response;
		res.status(status).json({ status, statusText });
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
		RapCloud.find({ userId: { $in: [ undefined, userId ] } }, function(err, clouds) {
			if (err) {
				res.status(500).json({ message: 'Something went wrong fetching resources from DB', err });
			}
			//TO-DO: Modify query to pull public assets as well
			res.status(200).json({ clouds: clouds.map((cloud) => ({ ...cloud.toObject(), id: cloud._id })) });
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

async function seed(req, res, next) {
	try {
		await seedDB();
		res.status(200).json('Done!');
	} catch (error) {
		res.status(500).json(error);
	}
}

router.get('/search', search);
router.get('/getSongDetails/:songId', getSongDetails);
router.get('/getArtistDetails/:artistId', getArtistDetails);
router.get('/views', views);
router.post('/generateCloud', generateCloud);
router.post('/getSongLyrics', getSongLyrics);
router.post('/getSongLyrics', getSongLyrics);
router.get('/masks/:userId?', getMasks);
router.get('/getClouds/:userId?', getClouds);
router.post('/addMask', addMask);
router.post('/deleteMask', deleteMask);
router.get('/seed', seed);
export default router;
