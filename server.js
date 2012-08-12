var express = require('express');
var nconf = require('nconf');

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

app.configure(function() {
  app.use(express.cookieParser());
  app.use(express.session({ secret: nconf.get("server:session:secret") }));
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
  app.use(express.logger());
  app.use(express.static(__dirname + '/public'));

  app.set('view cache', false);
  app.set('view engine', 'ejs');

});


app.listen(8080);

var io = require('socket.io');
io = io.listen(app);

app.get('/oauth/twitter', function(req, res) {
	oa.getOAuthRequestToken(function(error, oauth_token, oauth_token_secret, results){
		if (error) {
			console.log(error);
		}
		else {
			req.session.oauth = {};
			req.session.oauth.token = oauth_token;
			req.session.oauth.token_secret = oauth_token_secret;
			res.redirect(nconf.get('twitter:url:authenticate') + oauth_token);
    }
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

app.get('/chat', function(req, res) {

  console.log(req.session);  

  if(req.session.oauth) {
    res.render('chat', {req: req });
  } else {
    res.render('index');
  }
});

app.get('/', function(req, res) {
  res.render('index');
});




