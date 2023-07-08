/**
 * This app was created using this amazing tutorial: https://www.freecodecamp.org/news/how-to-enable-es6-and-beyond-syntax-with-node-and-express-68d3e11fe1ab/
 */
import express from 'express';
import path from 'path';
import cors from 'cors';
import passport from 'passport';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import indexRouter from './routes/index';
import usersRouter from './routes/users';
import session from 'express-session';
import dotenv from 'dotenv';
import passportInit from './passportInit';
import authRouter from './routes/auth';
import cloudinary from 'cloudinary';

const mongoose = require('mongoose');
const MongoStore = require('connect-mongo')(session);
const app = express();
//env variables
dotenv.config();
cloudinary.v2.config({
	cloud_name: 'rap-clouds',
	api_key: process.env.CLOUDINARY_KEY,
	api_secret: process.env.CLOUDINARY_SECRET,
});
const appRootUrl = process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://www.rapclouds.com';
// Accept requests from the client
// app.use(
// 	cors({
// 		origin: appRootUrl, //TO-DO: Use env vars to distinguish b/t dev & prod
// 	}),
// );

// app.use(function(req, res, next) {
// 	res.header('Access-Control-Allow-Origin', '*');
// 	res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
// 	console.log('Cors block', res);
// 	next();
// });

const whitelist = [ 'https://www.rapclouds.com', 'http://localhost:3000' ];
app.use(
	cors({
		origin: function(origin, callback) {
			// allow requests with no origin
			if (!origin) return callback(null, true);
			if (whitelist.indexOf(origin) === -1) {
				var message = `The CORS policy for this origin doesn't allow access from the particular origin.`;
				return callback(new Error(message), false);
			}
			return callback(null, true);
		},
	}),
);


mongoose.connect(
	`mongodb+srv://myself:${process.env.DB_PASSWORD}@cluster0-xlyk2.mongodb.net/${process.env.NODE_ENV === 'development'
		? 'dev'
		: 'prod'}?retryWrites=true&w=majority`,
	{ useNewUrlParser: true, useUnifiedTopology: true },
);
mongoose.Promise = global.Promise;
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
	console.log('db connected');
	// we're connected!
});

//Set up for express-session
app.use(
	session({
		secret: 'jordansreallygoodsecret', //TO-DO: Use an env variable
		resave: true,
		saveUninitialized: true,
		store: new MongoStore({ mongooseConnection: db }),
		//TO-DO: Should I use genId here?
	}),
);

//passport initialization
app.use(passport.initialize());
app.use(passport.session());
passportInit();
app.use(logger('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));
app.use('/', authRouter);
app.use('/', indexRouter);
app.use('/users', usersRouter);

export default app;
