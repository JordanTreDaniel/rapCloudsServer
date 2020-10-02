import express from 'express';
import axios from 'axios';
import Song from '../db/models/Song';
import os from 'os';
import Mask from '../db/models/Mask';

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
				authorization: `Bearer ${accessToken}`
			},
			params: {
				q
			}
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
				authorization: `Bearer ${accessToken}`
			}
		});
		const { meta, response } = data;
		const { status } = meta;
		const { song } = response;
		res.status(status).json({ song });
	} catch (err) {
		console.log('SOMETHING WENT WRONG', err);
		const { status, statusText } = err.response;
		res.status(status).json({ status, statusText });
	}
}

async function getSongLyrics(req, res, next) {
	const { body } = req;
	const { songPath } = body;
	if (!songPath) {
		res.status(400).json({ status: 400, statusText: 'Path to page with lyrics is required.' });
	}
	try {
		const { status: lyricStatus, data: lyricData } = await axios({
			method: 'get',
			url: `https://ukaecdgqm1.execute-api.us-east-1.amazonaws.com/default/getGeniusRapLyrics`,
			headers: {
				accept: 'application/json'
				// host: "api.genius.com",
				// authorization: `Bearer ${accessToken}`
			},
			params: {
				lyricsPath: songPath
			}
		});
		const { lyrics = 'Lamda call could not find lyrics' } = lyricData;
		res.status(lyricStatus).json({ lyrics });
	} catch (err) {
		console.log('SOMETHING WENT WRONG', err);
		const { status, statusText } = err.response;
		res.status(status).json({ status, statusText });
	}
}

async function makeWordCloud(req, res, next) {
	const { params, headers, body } = req;
	const { lyricJSON } = body;
	const mask = await Mask.findById('5f727b93af27887f7d258557', (err, foundMask) => {
		return foundMask;
	});

	// const { accessToken } = req.session; //TO-DO: Get access token to be dependably stored in session, so we don't save on User.
	// const { authorization: accessToken } = headers;
	// if (!accessToken) {
	// 	res.status(401).json({ status: 401, statusText: 'Missing access token. Please sign in first' });
	// 	// made a mistake with the line above and this helped me out:
	// 	//https://stackoverflow.com/questions/7042340/error-cant-set-headers-after-they-are-sent-to-the-client
	// }

	const { lyricString } = lyricJSON;

	try {
		const isLocalBuild = headers.host.match('localhost');

		const { data, status, error } = await axios({
			method: 'post',
			url: isLocalBuild ? 'http://localhost:5000' : `https://o049r3fygh.execute-api.us-east-1.amazonaws.com/dev`,
			headers: {
				'Content-Type': 'application/json',
				// 'Accept-Encoding': 'gzip',
				'Access-Control-Allow-Origin': '*'
				// 'Access-Control-Allow-Headers': 'Content-Type',
				// Accept: 'application/json'
			},
			data: {
				lyricString,
				encodedMask: mask.img.data.toString('base64')
			}
		});

		res.status(200).json({ data });
	} catch (err) {
		console.log('SOMETHING WENT WRONG', err);
		const { status, statusText } = err.response;
		res.status(status).json({ status, statusText });
	}
}

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
				authorization: `Bearer ${accessToken}`
			}
		});
		const { meta, response } = data;

		const { status } = meta;
		const { artist } = response;

		const { data: artistSongsData } = await axios({
			method: 'get',
			url: `https://api.genius.com/artists/${artistId}/songs`,
			headers: {
				accept: 'application/json',
				// host: "api.genius.com",
				authorization: `Bearer ${accessToken}`
			}
		});
		const { meta: songsDataMeta, response: songsDataResponse } = artistSongsData;
		const { songs, next_page } = songsDataResponse; //next_page indicates more songs
		//TO-DO: Save both the artist & the songs!
		artist.songs = songs;
		res.status(status).json({ artist });
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

/* GET home page. */
router.get('/search', search);
router.get('/getSongDetails/:songId', getSongDetails);
router.get('/getArtistDetails/:artistId', getArtistDetails);
router.get('/views', views);
router.post('/makeWordCloud', makeWordCloud);
router.post('/getSongLyrics', getSongLyrics);
export default router;
