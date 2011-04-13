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

var ryth = exports;

ryth.cradle_config = {
    host: '127.0.0.1',
    port: 5984,
    cache: false,
    auth: get_master_auth()
}

cradle.setup(ryth.cradle_config);

ryth.defaultSalt = '1';

function get_master_auth() {
    return { username: 'ryth', password: 'abCD--12' };
}

ryth.auth_error = function(res, reason) {
    if( reason == null )
        reason = 'incorrect user';
    res.send( {error: 'unauthorized', reason: reason}, 401 ); 
}

ryth.couchdb_error = function(err, callback) {
    var err_obj = {
        body: err,
        statusCode: 500
    }
    return callback(err_obj);
}

// Return an appropriately encoded username.
ryth.username_docid = function( username, raw ) {
    var base = 'org.couchdb.user:'; 

    if( raw ) {
        return base + username;
    } else {
        return  base + encodeURIComponent( username );
    }
}

function register(req, res) {
    console.log('we are registering.');
    var docid = ryth.username_docid( req.body.email, 'raw' );

    var con = new(cradle.Connection)();
    var db = con.database('_users');

    async.waterfall([
        function( callback ) {
            /* Check to see if the user document already exists in the _users table. */
            var encoded_docid = encodeURIComponent( docid );
            db.head(encoded_docid, function(err, doc) {
                if( err ) return ryth.couchdb_error(err, callback);

                /* If the etag is undefined, this user has not yet registered. */
                if( typeof doc.etag == 'undefined' ) {
                    return callback(null);
                } else {
                    /* We are dealing with an already registered user. */
                    var err_doc = {
                        body: {
                            error: 'registration_failed',
                            reason: 'already registered',
                        },
                        statusCode: 400
                    };

                    callback(err_doc);
                } 
            });
        },
        function( callback ) {
            /* Create the user document in the authentication database. */

            var newUser = {
                _id: docid,
                name: req.body.email,
                password_sha: Hash.hex_sha1(req.body.password + ryth.defaultSalt),
                salt: ryth.defaultSalt,
                type: 'user',
                roles: []
            }

            db.save(newUser, function(err, doc) {
                if( err ) {
                    console.log( err );
                    return ryth.couchdb_error(err, callback);
                }

                return callback(null);
            });
        },
        function( callback ) {
            /* Create the profile document in the app database. */

            var newUserProfile = {
                _id: docid,
                last_modified: Date.now(),
                created_at: Date.now(),
                author: req.body.email,
                activation_key: uuid(),
                type: 'user',
                activated: false,
                proposal_num: 0
            }

            var db2 = new(cradle.Connection)().database('app');

            db2.save(newUserProfile, function(err, doc) { 
                if( err ) return ryth.couchdb_error(err, callback);
                
                return callback(null, newUserProfile.activation_key);
            });
        },
        function( activation_key, callback ) {
            /* Send the registration email. */

            var activation_url = 'http://app.protosal.com:3000/register/' + activation_key;

            try {
                postmark.send({
                    'From': 'admin@protosal.com', 
                    'To': req.body.email, 
                    'Subject': 'Activate Your Account', 
                    'HtmlBody': '<b>Click here: </b><a href="' + activation_url + '">' + activation_url + '</a>'
                });
            } catch(err) {
                console.log('Error: ');
                console.log(err); 

                var err_obj = {
                    body: {
                        error: 'registration_email_sending_failed',
                        reson: err.message
                    },
                    statusCode: 500
                }

                return callback(err_obj);
            }
            
            return callback(null);
        }
    ],
    function(err) {
        /* Error handler. */
        if( err ) {
            res.send(err.body, err.statusCode);
        } else {
            /* Indicate success. */
            res.send({}, 200);
        }
    });
}

function login(req, res) {
    if( req.method != 'POST' ) {
        ryth.auth_error(res);
        return;    
    }

    if( req.body ) {
        var con = new(cradle.Connection)();

        /* Temporarily override auth details to get session details. */
        cradle.auth.username = req.body.username;
        cradle.auth.password = req.body.password;

        con.request('GET', '/_session', function(err, doc) {
            if( err ) {
                ryth.auth_error(res, 'incorrect credentials');
            } else {
                var db = con.database('app');
                var docid = ryth.username_docid( req.body.username );

                /* Check that the user has activated their account. */
                db.get(docid, function(err, doc) {
                    if( err ) {
                        ryth.auth_error(res, 'user not found');
                    } else {
                        if( doc.activated ) {
                            req.session.auth = true;
                            req.session.username = req.body.username;
                            res.send({}, 200);
                        } else {
                            ryth.auth_error(res, 'not activated');
                        }
                    }
                });
            }
        });

        /* Put auth details back to the way they were. */
        cradle.auth = get_master_auth();
    } else {
        ryth.auth_error(res);
        return;    
    }
}

function logout(req, res) {
    req.session.destroy();
    res.send({}, 200);
}

ryth.authCheck = function (req, res, next) {
    url = req.urlp = urlparser.parse(req.url, true);

    // ####
    // Logout
    if ( url.pathname == '/logout' ) {
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
    if( url.pathname == '/user/register' ) {
        register(req, res);
    } else if ( url.pathname == '/user/login' ) {
        login(req, res);
    } else {
        ryth.auth_error(res);
    }
}

process.on('uncaughtException', function (err) {
    console.log(err);
    console.log(err.stack);
    Exceptional.handle(err);
});
