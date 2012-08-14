var connect           = require('connect');
var express           = require('express');
var nconf             = require('nconf');
var expressValidator  = require('express-validator');
var io                = require('socket.io');
var util              = require('util');

nconf.argv().env().file({file: './config.json'});


var OAuth = require('oauth').OAuth;

var oa = new OAuth(
	nconf.get('twitter:url:token:request'),
	nconf.get('twitter:url:token:access'),
	nconf.get('twitter:consumer:key'),
	nconf.get('twitter:consumer:secret'),
	"1.0",
	nconf.get('twitter:url:callback'),
	"HMAC-SHA1"
);


var app = express.createServer(express.logger(), express.bodyParser());

var sessionStore = new express.session.MemoryStore();


app.configure(function() {
  app.use(express.cookieParser());
  app.use(express.session({ key: 'express.sid', secret: nconf.get("server:session:secret"), store: sessionStore }));
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
  app.use(express.logger());
  app.use(express.static(__dirname + '/public'));
  app.use(express.bodyParser());
  app.use(expressValidator);

  app.set('view cache', false);
  app.set('view engine', 'ejs');

});


app.listen(8080);

var socket = io.listen(app);
var parseCookie = connect.utils.parseCookie;
 var Session = connect.middleware.session.Session;

socket.set('authorization', function (data, accept) {
    if (data.headers.cookie) {
        data.cookie = parseCookie(data.headers.cookie);
        data.sessionID = data.cookie['express.sid'];
        data.sessionStore = sessionStore;
        sessionStore.get(data.sessionID, function (err, session) {
            if (err || !session) {
                accept('Error, could not get session.', false);
            } else {
                data.session = new Session(data, session);
                accept(null, true);
            }
        });
    } else {
       return accept('No cookie transmitted.', false);
    }
});


socket.sockets.on('connection', function (socket) {
    var hs = socket.handshake;
    console.log('A socket with sessionID ' + hs.sessionID 
        + ' connected!');

    var intervalID = setInterval(function () {
        hs.session.reload( function () { 
            hs.session.touch().save();
        });
    }, 60 * 1000);
    socket.on('disconnect', function () {
        console.log('A socket with sessionID ' + hs.sessionID 
            + ' disconnected!');
        clearInterval(intervalID);
    });
 
});

app.get('/oauth/callback', function(req, res, next) {
	if (req.session.oauth) {

		req.session.oauth.verifier = req.query.oauth_verifier;
		var oauth = req.session.oauth;


    var handler = function(error, token, secret, results) {
      if (error){
        console.log(error);
        res.redirect('/oauth/twitter')
      } else {
        oauth.access_token = token;
        oauth.access_token_secret = secret;
        req.session.username = results.screen_name;

        res.redirect('/chat');
      }
    }

		oa.getOAuthAccessToken(oauth.token, oauth.token_secret, oauth.verifier, handler);
	} else {
        res.redirect('/');
  }
});

app.post('/login', function(req, res) {

  req.session.roomname = req.query.roomname;

  oa.getOAuthRequestToken(function(error, oauth_token, oauth_token_secret, results) {
 
    if (error) {
      console.log("ERROR OCCURRED: " + error);
    }
    else {

      req.session.oauth = {};
      req.session.oauth.token = oauth_token;
      req.session.oauth.token_secret = oauth_token_secret;
      res.redirect(nconf.get('twitter:url:authenticate') + oauth_token);
    }
  });
});



app.get('/chat', function(req, res) {

  if(req.session.oauth) {
    res.render('chat', {req: req });
  } else {
    res.render('index');
  }
});

app.get('/', function(req, res) {
  res.render('index');
});




