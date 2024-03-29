import express from "express";
import axios from "axios";
import Song from "../db/models/Song";
import Mask from "../db/models/Mask";
import RapCloud from "../db/models/RapCloud";
import Artist from "../db/models/Artist";
import seedDB from "../db/seed";
import cloudinary from "cloudinary";
import fs from "fs";
import a from "genius-lyrics";
import get from "lodash/get";

const router = express.Router();

async function search(req, res, next) {
  const { query } = req;
  const { q } = query;
  const { headers } = req;
  // const { accessToken } = req.session; //TO-DO: Get access token to be dependably stored in session, so we don't save on User.
  const { authorization: accessToken } = headers;
  if (!accessToken) {
    res.status(401).json({
      status: 401,
      statusText: "Missing access token. Please sign in first",
    });
    // made a mistake with the line above and this helped me out:
    //https://stackoverflow.com/questions/7042340/error-cant-set-headers-after-they-are-sent-to-the-client
  }
  try {
    const { data } = await axios({
      method: "get",
      url: `https://api.genius.com/search`,
      headers: {
        accept: "application/json",
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
      let mongooseSong = await Song.findOne(
        { id: song.id },
        (err, foundInstance) => {
          return foundInstance;
        }
      );
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
  const watchUrl = (
    (song.media || []).find((mediaInfo) => mediaInfo.provider === "youtube") ||
    {}
  ).url;
  if (!watchUrl)
    return { problem: "Couldn't find youtube media info on song." };
  const res = await axios({
    method: "get",
    url: `https://www.youtube.com/oembed?url=${watchUrl}&format=json`,
  });
  return res;
};

const saveArtistsFromSong = async (song) => {
  const { primary_artist, featured_artists = [], producer_artists = [] } = song;
  const artists = [primary_artist, ...featured_artists, ...producer_artists];
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
    res.status(401).json({
      status: 401,
      statusText: "Missing access token. Please sign in first",
    });
    // made a mistake with the line above and this helped me out:
    //https://stackoverflow.com/questions/7042340/error-cant-set-headers-after-they-are-sent-to-the-client
  }
  try {
    const { data } = await axios({
      method: "get",
      url: `https://api.genius.com/songs/${songId}`,
      headers: {
        accept: "application/json",
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
      console.log(
        "Details fetched for previously unknown song. Going to save it."
      );
      song = new Song(song);
      await song.save();
    }
    res.status(200).json({
      song: song.toObject(),
    });
    // await saveArtistsFromSong(song); //TO-DO: Re-instate
  } catch (err) {
    console.log("SOMETHING WENT WRONG in getSongDetails", err);
    res.status(500).json({ err });
  }
}

async function setSongLyrics(req, res, next) {
  const { params, headers, body } = req;
  const { songId } = params;
  const { newLyrics } = body;
  console.log("recived new lyrics", newLyrics);
  // const { accessToken } = req.session; //TO-DO: Get access token to be dependably stored in session, so we don't save on User.
  const { authorization: accessToken } = headers;
  if (!accessToken) {
    res.status(401).json({
      status: 401,
      statusText: "Missing access token. Please sign in first",
    });
  }
  try {
    let mongooseSong = await Song.findOne({ id: songId }).exec();
    if (mongooseSong) {
      Object.assign(mongooseSong, { lyrics: newLyrics });
      await mongooseSong.save();
    }
    res.status(200).json({
      song: mongooseSong.toObject(),
    });
  } catch (err) {
    console.log("SOMETHING WENT WRONG in setSongLyrics", err);
    res.status(500).json({ err });
  }
}

async function getSongClouds(req, res, next) {
  const { params } = req;
  const { songId, userId } = params;
  try {
    let officalCloud = await RapCloud.findOne({
      songIds: [songId],
      officialCloud: true,
    });
    let userMadeClouds = await RapCloud.find({
      songIds: [songId],
      userId: userId,
    });
    const officalCloudTimeStamp = officalCloud
      ? officalCloud._id.getTimestamp()
      : null;
    res.status(200).json({
      officalCloud:
        officalCloud && officalCloud.info
          ? {
              ...officalCloud.toObject(),
              createdAt: officalCloudTimeStamp,
              id: officalCloud._id,
            }
          : null,
      userMadeClouds: userMadeClouds
        .filter((cloud) => !cloud.info)
        .map((c) => {
          const timeStamp = c._id.getTimestamp();
          return { ...c.toObject(), createdAt: timeStamp, id: c._id };
        }),
    });
  } catch (err) {
    console.log("SOMETHING WENT WRONG in getSongClouds", err);
    res.status(500).json({ err });
  }
}

async function apiGetSongLyrics(songId, accessToken) {
  const Client = new a.Client(accessToken);
  const song = await Client.songs.get(parseInt(songId));
  const lyrics = await song.lyrics();
  return { lyrics: lyrics || null };
}

async function getSongLyrics(req, res, next) {
  const { body, headers } = req;
  const { songId } = body;
  const { authorization: accessToken } = headers;

  if (!songId) {
    res.status(400).json({
      status: 400,
      statusText:
        "Song ID is required to fetch the lyrics using genius-lyrics package.",
    });
  }
  try {
    const { lyrics } = await apiGetSongLyrics(songId, accessToken);
    res.status(200).json({ lyrics });
    let mongooseSong = await Song.findOne(
      { id: songId },
      (err, foundInstance) => {
        return foundInstance;
      }
    );
    if (mongooseSong) {
      mongooseSong.lyrics = lyrics;
      // mongooseSong.markModified('lyrics');
      const result = await mongooseSong.save();
    }
  } catch (err) {
    console.log("SOMETHING WENT WRONG", err);
    res.status(500).json({ err });
  }
}

async function getGoogleFonts(req, res, next) {
  try {
    const { data } = await axios({
      method: "get",
      url: `https://www.googleapis.com/webfonts/v1/webfonts?key=${process.env.GOOGLE_API_KEY}`,
    });
    const { items } = data;
    res.status(200).json({ fonts: items || [] });
  } catch (error) {
    console.error("Something went wrong while fetching fonts", error);
  }
}

async function base64ToFile(fileName, data) {
  return new Promise((resolve, reject) => {
    fs.writeFile(fileName, data, "base64", function (err) {
      if (err) {
        console.log("Something went wrong with fs.writeFile", err);
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
    inspirationType = "song, artist, or album",
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
      method: "post",
      url: process.env.CLOUD_GEN_ENDPOINT,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
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
    res
      .status(200)
      .json({ cloud: { ...newCloud.toObject(), id: newCloud._id }, message });
  } catch (err) {
    console.log("SOMETHING WENT WRONG in triggerCloudGeneration", { err });
    res.status(500).json({ err });
  }
}

async function handleNewCloud(req, res, next) {
  const { body } = req;
  const { socketId, cloudId, cloudInfo, error } = body;
  try {
    const io = req.app.get("io");
    if (error) {
      io.in(socketId).emit("RapCloudError", { error, cloudId, socketId });
      res.status(200).json({
        message: "Error received from python script & reported to React app.",
      });
    } else {
      const rapCloud = await RapCloud.findOneAndUpdate(
        { _id: cloudId },
        { info: cloudInfo },
        { new: true, useFindAndModify: false }
      );
      await rapCloud.save();
      io.in(socketId).emit("RapCloudFinished", {
        ...rapCloud.toObject(),
        id: rapCloud._id,
      });
      res
        .status(200)
        .json({ message: "Cloud is saved and sent back to client." });
    }
  } catch (err) {
    console.log("SOMETHING WENT WRONG in handleNewCloud", { err });
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
    method: "get",
    url: `https://api.genius.com/artists/${artistId}/songs?per_page=${per_page}&page=${page}&sort=${"popularity"}`,
    headers: {
      accept: "application/json",
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
    res.status(401).json({
      status: 401,
      statusText: "Missing access token. Please sign in first",
    });
  }

  try {
    const { data } = await axios({
      method: "get",
      url: `https://api.genius.com/artists/${artistId}`,
      headers: {
        accept: "application/json",
        // host: "api.genius.com",
        authorization: `Bearer ${accessToken}`,
      },
    });
    const { _, response } = data;

    let { artist } = response;
    let mongoArtist = await Artist.findOne({ id: artistId }).exec();
    artist = mongoArtist
      ? Object.assign(mongoArtist, artist)
      : new Artist(artist);
    res.status(200).json({ artist });
    await artist.save();
  } catch (err) {
    console.log("SOMETHING WENT WRONG", err);
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
    res.status(401).json({
      status: 401,
      statusText: "Missing access token. Please sign in first",
    });
  }
  try {
    const { artistSongs: songs, nextPage } = await apiFetchArtistSongs(
      artistId,
      accessToken,
      { page }
    );
    res.status(200).json({ songs, nextPage });
    saveSongs(songs);
  } catch (err) {
    console.log("SOMETHING WENT WRONG", err);
    const { status, statusText } = err.response;
    res.status(500).json({ status, statusText });
  }
}

const views = (req, res, next) => {
  if (req.session.views) {
    req.session.views++;
    res.setHeader("Content-Type", "text/html");
    res.write("<p>views: " + req.session.views + "</p>");
    res.write("<p>expires in: " + req.session.cookie.maxAge / 1000 + "s</p>");
    res.end();
  } else {
    req.session.views = 1;
    res.end("welcome to the session demo. refresh!");
  }
};

const testPython = async (req, res, next) => {
  try {
    console.log("testing python @ ", process.env.PYTHON_TEST_URL);
    await axios.get(process.env.PYTHON_TEST_URL);
    console.log("Everything is good", { res });
    res.status(200).json("yay");
  } catch (error) {
    console.log("Problem during python test", error);
    res.status(500).json({ message: "Couldn't do it fam", error });
  }
};

async function getMasks(req, res, next) {
  const { params } = req;
  const { userId = "default" } = params;
  try {
    Mask.find({ userId: { $in: [undefined, userId] } }, function (err, masks) {
      if (err) {
        res.status(500).json({
          message: "Something went wrong fetching resources from DB",
          err,
        });
      }
      //TO-DO: Modify query to pull public assets as well
      res.status(200).json({
        masks: masks.map((mask) => ({ ...mask.toObject(), id: mask._id })),
      });
    });
  } catch (error) {
    res.status(500).json(error);
  }
}

async function getClouds(req, res, next) {
  const { params } = req;
  const { userId = "default" } = params;
  try {
    RapCloud.find(
      { userId: { $in: [userId] }, officialCloud: false },
      function (err, clouds) {
        if (err) {
          res.status(500).json({
            message: "Something went wrong fetching resources from DB",
            err,
          });
        }
        //TO-DO: Modify query to pull public assets as well
        res.status(200).json({
          clouds: clouds
            .filter((cloud) => !cloud.info)
            .map((cloud) => ({ ...cloud.toObject(), id: cloud._id })),
        });
      }
    );
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
      message: "Deleted Successfully.",
      maskId,
    });
  } catch (error) {
    res.status(500).json(error);
  }
}

async function deleteClouds(req, res, next) {
  const { body } = req;
  const { cloudIds } = body;
  try {
    for (const cloudId of cloudIds) {
      const cloud = await RapCloud.findById(cloudId);
      const cloudAsObject = cloud ? cloud.toObject : {};
      const { public_id } = cloudAsObject["info"] || {};
      await RapCloud.findOneAndDelete({ _id: cloudId.toString() }).exec();
      if (public_id) {
        await cloudinary.v2.uploader.destroy(public_id);
      }
    }
    res.status(200).json({
      message: "Deleted Successfully.",
      cloudIds,
    });
  } catch (error) {
    console.dir(error);
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
        console.log("Found a rapCloud with no public_id", rapCloud);
      }
      await RapCloud.findByIdAndDelete(_id);
      deletedClouds.push(_id);
    }
    res.status(200).json({
      message: "Deleted Successfully.",
      deletedClouds,
    });
  } catch (error) {
    console.log("Something went wrong in deleteAllClouds", error);
    res.status(500).json(error);
  }
}

//TO-DO: Put this function on automatic timer
async function deleteBadClouds(req, res, next) {
  try {
    //Should be deleting the correspoding cloudinary object here?
    const rapClouds = await RapCloud.deleteMany({ info: undefined }).exec();
    res.status(200).json({
      message: "Deleted Successfully.",
      rapClouds,
    });
  } catch (error) {
    console.log("Something went wrong in deleteBadClouds", error);
    res.status(500).json(error);
  }
}

async function pruneCloudinary(req, res, next) {
  try {
    let cloudinaryResult, next_cursor;
    const cloudinaryCallOptions = { max_results: 500, resource_type: "image" };
    do {
      await cloudinary.v2.api.resources(
        cloudinaryCallOptions,
        async function (error, result) {
          cloudinaryResult = result;
          next_cursor = result.next_cursor;
          if (next_cursor) {
            cloudinaryCallOptions["next_cursor"] = next_cursor;
          }
          for (const resource of result.resources) {
            const { public_id } = resource;
            const matchingClouds = await RapCloud.find({
              "info.public_id": public_id,
            });
            const matchingMasks = await Mask.find({
              "info.public_id": public_id,
            });
            const conditions = [!matchingClouds.length, !matchingMasks.length];
            const matchesDev = public_id.toLowerCase().match("dev");
            conditions.push(
              process.env.NODE_ENV === "development" ? matchesDev : !matchesDev
            );
            if (conditions.every((c) => c)) {
              console.log(
                "Found a resource with no matching rapCloud or mask",
                resource
              );
              await cloudinary.v2.uploader.destroy(public_id);
              deletedResources.push(public_id);
            }
          }
          //   resources.push(...result.resources);
        }
      );
    } while (next_cursor);

    const deletedResources = [];

    res.status(200).json({
      message: "Pruned Successfully.",
      deletedResources,
      cloudinaryResult,
    });
  } catch (error) {
    console.log("Something went wrong in pruneCloudinary", error);
    res.status(500).json(error);
  }
}

async function seed(req, res, next) {
  try {
    await seedDB();
    res.status(200).json("Done!");
  } catch (error) {
    res.status(500).json(error);
  }
}

async function verifyAdmin(req, res, next) {
  try {
    const { params } = req;
    const { adminPassword } = params;
    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      res.status(403).json({ message: "Admin password needed" });
      return;
    }
    next();
  } catch (error) {
    res.status(500).json(error);
  }
}

async function getEmbeddingForStr(str, model = "text-embedding-ada-002") {
  try {
    const response = await axios.post(
      "https://api.openai.com/v1/embeddings",
      {
        model,
        input: str,
        max_tokens: 64,
        // n: Math.ceil(terms.length * 0.25), // Get the top 25% of matches
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    const embedding = get(response, "data.data[0].embedding", [0]);
    return embedding;
  } catch (error) {
    console.error("Something went wrong in getEmbeddingForStr", error.message);
    throw error;
  }
}

async function getEmbeddings(req, res, next) {
  //write a function that will take post request with a str collection in body, and call open ai to return an embedding of that str collection
  try {
    const { body } = req;
    const { strCollection } = body;
    if (!strCollection) {
      res.status(400).json({ message: "No strCollection" });
      return;
    }
    const isArr = Array.isArray(strCollection);
    const _strCollection = isArr ? strCollection : [`${strCollection}`];
    const model = "text-embedding-ada-002";
    const embeddings = await Promise.all(
      _strCollection.map((str) => getEmbeddingForStr(str, model))
    );
    res.status(200).json({ embeddings });
  } catch (error) {
    console.error("Something went wrong in getEmbeddings", error.message);
    res.status(500).json(error);
  }
}

router.get("/search", search);
router.post("/getEmbeddings", getEmbeddings);
router.get("/getGoogleFonts", getGoogleFonts);
router.post("/getSongLyrics", getSongLyrics);
router.post("/setSongLyrics/:songId", setSongLyrics);
router.get("/getSongDetails/:songId", getSongDetails);
router.get("/getSongClouds/:songId/:userId", getSongClouds);
router.get("/getArtistDetails/:artistId", getArtistDetails);
router.get("/getArtistSongs/:artistId/:page", getArtistSongs);
router.post("/triggerCloudGeneration/:socketId", triggerCloudGeneration);
router.post("/newCloud/", handleNewCloud);
router.get("/masks/:userId?", getMasks);
router.get("/getClouds/:userId?", getClouds);
router.post("/addMask", addMask);
router.post("/deleteMask", deleteMask);
router.post("/deleteClouds", deleteClouds);
//Admin Endpoints
router.get("/views/:adminPassword", verifyAdmin, views);
router.get("/testPython", testPython);
router.get("/deleteAllClouds/:adminPassword", verifyAdmin, deleteAllClouds);
router.get("/deleteBadClouds/:adminPassword", verifyAdmin, deleteBadClouds);
router.get("/pruneCloudinary/:adminPassword", verifyAdmin, pruneCloudinary);
router.get("/seed/:adminPassword", verifyAdmin, seed);

export default router;
