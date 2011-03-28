var urlparser = require('url');
var http = require('http');
var Hash = require('./sha1');
var fs = require('fs');
var sys = require('sys');
var cradle = require('cradle');
var Exceptional = require('./exceptional').Exceptional;
var async = require('async');
var uuid = require('node-uuid')
var postmark = require('postmark')('473b864e-b165-473c-9435-68981a3bbeef');

var _defaultSalt = "1";

function get_master_auth() {
    return { username: 'ryth', password: 'abCD--12' };
}

function auth_error(res, reason) {
    if( reason == null )
        reason = "incorrect user";
    res.send( {error: "unauthorized", reason: reason}, 401 ); 
}

exports.auth_error = auth_error;

exports.cradle_config = {
    host: '127.0.0.1',
    port: 5984,
    auth: get_master_auth()
}

cradle.setup(exports.cradle_config);

function register(req, res) {
    console.log("we are registering.");
    var docid = "org.couchdb.user:" + req.body.email;
    var newUser = {
        _id: docid,
        name: req.body.email,
        password_sha: Hash.hex_sha1(req.body.password + _defaultSalt),
        salt: _defaultSalt,
        type: "user",
        roles: []
    }

    var con = new(cradle.Connection)();
    var db = con.database('_users');

    db.head(docid, function(err, doc) {
        /* If the etag is undefined, it means this user has not yet registered. */
        if( typeof doc.etag == "undefined" ) {
            /* Create the user document in the authentication database. */
            db.save(newUser, function(err, doc) {
                if( err ) {
                    res.send(err, 500);
                    throw "unable to save user document";
                }
            });

            var newUserProfile = {
                _id: docid,
                last_modified: Date.now(),
                created_at: Date.now(),
                author: req.body.email,
                activation_key: uuid(),
                type: 'user',
                activated: false
            }

            var db2 = new(cradle.Connection)().database('app');

            /* Create the profile document in the app database. */
            db2.save(newUserProfile, function(err, doc) { 
                if( err ) {
                    res.send(err, 500);
                    throw "unable to save profile document";
                } else {
                    var activation_url = "http://protosal.com:3000/register/" +
                        newUserProfile.activation_key
                    /* Send the registration email. */
                    postmark.send({
                        "From": "admin@protosal.com", 
                        "To": req.body.email, 
                        "Subject": "Activate Your Account", 
                        "HtmlBody": "<b>Click here: </b><a href='" + activation_url + "'>" + activation_url + "</a>"
                    }, function(err, res) {
                        console.log("Error: ");
                        console.log(err); 
                        console.log("Response: ");
                        console.log(res); 
                    });
                }
            });

            res.send({}, 200);

        } else {
            /* We are dealing with an already registered user. */
            res.send({error: "request failed", reason: "already registered"}, 400);
        }
    });
}

function login(req, res) {
    if( req.method != "POST" ) {
        auth_error(res);
        return;    
    }

    if( req.body ) {
        var con = new(cradle.Connection)();

        /* Temporarily override auth details to get session details. */
        cradle.auth.username = req.body.username;
        cradle.auth.password = req.body.password;

        con.request('GET', '/_session', function(err, doc) {
            if( err ) {
                auth_error(res, "incorrect credentials");
            } else {
                var db = con.database('app');
                var docid = "org.couchdb.user:" + req.body.username;

                /* Check that the user has activated their account. */
                db.get(docid, function(err, doc) {
                    if( err ) {
                        throw "unable to get document id";
                    } else {
                        if( doc.activated ) {
                            req.session.auth = true;
                            req.session.username = req.body.username;
                            res.send({}, 200);
                        } else {
                            auth_error(res, "not activated");
                        }
                    }
                });
            }
        });

        /* Put auth details back to the way they were. */
        cradle.auth = get_master_auth();
    } else {
        auth_error(res);
        return;    
    }
}

function logout(req, res) {
    req.session.destroy();
    res.send({}, 200);
}

exports.authCheck = function (req, res, next) {
    url = req.urlp = urlparser.parse(req.url, true);

    // ####
    // Logout
    if ( url.pathname == "/logout" ) {
        logout(req, res);
        return;
    }

    // ####
    // Is User already validated?
    if (req.session && req.session.auth == true) {
      next(); // stop here and pass to the next onion ring of connect
      return;
    }

    // Extract the base path e.g. example.com/base_path/whatever
    var base_path = url.pathname.split('/')[1];

    if(  base_path == 'logo' ) {
        // Let reqests for logos go through as they are public
        next();
        return;
    } else if( base_path == 'register' ) {
        // Let registration requests pass through
        next();
        return;
    }
    
    // ########
    // Auth - Replace this simple if with you Database or File or Whatever...
    // If Database, you need a Async callback...
    if( url.pathname == "/user/register" ) {
        register(req, res);
    } else if ( url.pathname == "/user/login" ) {
        login(req, res);
    } else {
        auth_error(res);
    }
}

process.on('uncaughtException', function (err) {
    console.log(err);
    console.log(err.stack);
    Exceptional.handle(err);
});
