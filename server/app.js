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
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo')(session);
const app = express();
import seedDB from './db/seed';

//env variables
dotenv.config();

const appRootUrl = process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'http://www.rapclouds.com';
// Accept requests from the client
app.use(
	cors({
		origin: appRootUrl, //TO-DO: Use env vars to distinguish b/t dev & prod
	}),
);

mongoose.connect(
	`mongodb+srv://myself:${process.env.DB_PASSWORD}@cluster0-xlyk2.mongodb.net/test?retryWrites=true&w=majority`,
	{ useNewUrlParser: true, useUnifiedTopology: true },
);
mongoose.Promise = global.Promise;
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
	console.log('db connected');
	// we're connected!
});
// seedDB();

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
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));
app.use('/', authRouter);
app.use('/', indexRouter);
app.use('/users', usersRouter);

export default app;
