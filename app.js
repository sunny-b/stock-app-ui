'use strict';

require('dotenv').config()

const { Client } = require('pg');
const { Store } = require('./lib/store');
const { IEXCloudClient } = require('node-iex-cloud');
const fetch = require('node-fetch');
const session = require('express-session');
const { Quoter } = require ('./lib/quoter');
const { handleErr } = require('./lib/helpers')

var createError = require('http-errors');
var express = require('express');
var path = require('path');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

const db = new Client({
  connectionString: process.env.DB_CONN_STRING,
})

const iexOpts = {
  publishable: process.env.IEX_SANDBOX_API_TOKEN,
  version: 'stable'
}

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
if (process.env.ENVIRONMENT !== 'prod') {
  iexOpts.sandbox = true
}

const iex = new IEXCloudClient(fetch, iexOpts);

db.connect()
  .then(() => console.log('connected to database'))
  .catch(err => console.error('connection error', err.stack))

const store = new Store(db)
const quoter = new Quoter(iex)

var app = express();
var router = express.Router();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: true,
    saveUninitialized: false
}));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.get('/login', (req, res) => {
    res.render('login', { title: 'Quorum Stock and Crypto Exchange' })
})
app.post('/login', async (req, res, next) => {
  let loginErr
  const username = req.body.username.toLowerCase()

  if (!(await store.userExists(username))) {
    try {
      await store.addUser(username)
    } catch (e) {
      handleErr(e)
      loginErr = true
    }
  }

  if (loginErr) {
    res.render('index', {error: true});
  } else {
    req.session.username = username.toLowerCase();
    res.redirect('/')
  }
});

app.get('/dashboard', async (req, res, next) => {
  // fetch all assets for user from db
  if (!req.session.username) {
    res.redirect('/login')
  }

  const username = req.session.username
  try {
    const cashBalance = await store.accountBalance(username)
    const assets = await store.getAssets(username)

    let networth = 0
    for (let asset of assets) {
      let price
      if (asset.type === 'stock') {
        price = await quoter.fetchStockPrice(asset.ticker)
      } else {
        price = await quoter.fetchCryptoPrice(asset.ticker)
      }
      asset.currentPrice = price
      networth += (+price * +asset.shares)
    }

    networth += +cashBalance

    res.render('index', {
      title: 'Quorum Exchange Dashboard',
      assets: assets,
      networth: parseFloat(networth.toFixed(2)),
      cashBalance: cashBalance,
      username: username,
    })
  } catch (e) {
    handleErr(e)
    loginErr = true
  }
})

app.get('/leaderboard', async (req, res, next) => {
  try {
    const users = await store.getAllUsers()

    for (let user of users) {
      const cashBalance = await store.accountBalance(user.username)
      const assets = await store.getAssets(user.username)

      let networth = 0
      for (let asset of assets) {
        let price
        if (asset.type === 'stock') {
          price = await quoter.fetchStockPrice(asset.ticker)
        } else {
          price = await quoter.fetchCryptoPrice(asset.ticker)
        }
        asset.currentPrice = price
        networth += (+price * +asset.shares)
      }

      networth += +cashBalance

      user.networth = parseFloat(networth.toFixed(2))
    }

    const sortedUsers = users.sort(function(a, b) {
      return b.networth - a.networth
    })

    res.render('leaderboard', {
      title: 'Quorum Exchange Leaderboard',
      users: sortedUsers,
    })
  } catch (e) {
    handleErr(e)
    loginErr = true
  }
})

app.get('/stockPrice', async (req, res, next) => {
  try {
    console.log(req)
    console.log(req.query.ticker)
    const price = await quoter.fetchStockPrice(req.query.ticker.toLowerCase())

    res.render('stock_price', {
      price: price.toFixed(2),
    })
  } catch (e) {
    handleErr(e)
    loginErr = true
  }
})

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
