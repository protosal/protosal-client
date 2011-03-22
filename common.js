var urlparser = require('url');
var http = require('http');
var Hash = require('./sha1');
var fs = require('fs');
var sys = require('sys');
var cradle = require('cradle');

var _defaultSalt = "1";

function get_master_auth() {
    return { username: 'ryth', password: 'abCD--12' };
}

function auth_error(res) {
    res.send( {error: "unauthorized", reason: "incorrect user" }, 401 ); 
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

    var db = new(cradle.Connection)().database('_users');

    /* Create the user document in the authentication database. */
    db.save(newUser, function(err, doc) {
        if( err ) {
            res.send(err, 500);
            return;
        }
    });

    var newUserProfile = {
        _id: docid,
        last_modified: Date.now(),
        created_at: Date.now(),
        author: req.body.email
    }
    
    var db2 = new(cradle.Connection)().database('app');

    /* Create the profile document in the app database. */
    db2.save(newUserProfile, function(err, doc) { 
        if( err ) {
            res.send(err, 500);
            return;
        }
    });

    res.send({}, 200);
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
                auth_error(res);
            } else {
                req.session.auth = true;
                req.session.username = req.body.username;
            }

            res.send({}, 200);
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
