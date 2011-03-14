var Base64 = require('base64');
var Buffer = require('buffer').Buffer;
var urlpaser = require('url');
var http = require('http');
var Hash = require('./sha1');
var fs = require('fs');
var sys = require('sys');
var cradle = require('cradle');

var couchdb_host = '127.0.0.1';
var couchdb_port = 5984;

exports.cradle_config = {
    host: '127.0.0.1',
    port: 5984,
    auth: { username: 'ryth', password: 'abCD--12' }
}

cradle.setup(exports.cradle_config);

function base64_encode(enc_string) {
    return Base64.encode( new Buffer(enc_string) );
}

var _masterCredentials = "ryth:abCD--12";
var _defaultSalt = "1";

exports.couchdb_request = function(req, res, request_url, options) {
    // If no credentials are specified, check to see if the user is authenticated
    if( !options )
        options = {};
    if( !options.request_params )
        options.request_params = {};

    if( !options.credentials ) {
        if( typeof req.session != "undefined" && !req.session.auth ) {
            auth_error(res);
            return;
        } else {
            options.credentials = _masterCredentials;
        }
    }

    var couchdb = http.createClient(couchdb_port, couchdb_host, true);
    
    options.request_params['Host'] = couchdb_host;
    options.request_params['Authorization'] = 'Basic ' + base64_encode(options.credentials);
    
    if( options.method == "POST" || options.method == "PUT" )
        options.request_params['Content-Type'] = 'application/json'; 

        
    var request = couchdb.request(options.method, request_url, options.request_params);
    
    return request;
}

function register(req, res) {
    console.log("we are registering.");
    var newUser = {
        _id: "org.couchdb.user:" + req.body.email,
        name: req.body.email,
        password_sha: Hash.hex_sha1(req.body.password + _defaultSalt),
        salt: _defaultSalt,
        type: "user",
        roles: []
    }

    var db = new(cradle.Connection)().database('_users');

    db.save(newUser, function(err, doc) {
        if( err ) {
            res.send(err, 500);
        } else {
            res.send(doc);
        }
    });
}

function login(req, res) {
    if( req.method != "POST" ) {
        auth_error(res);
        return;    
    }

    var credentials = "";

    if( req.body ) {
        credentials = req.body.username + ":" + req.body.password;
    } else {
        auth_error(res);
        return;    
    }

    // Map the POST login request to a get request using the HTTP Authorization header
    var request = exports.couchdb_request(req, res, '/_session',
            {"method" : "GET", "credentials" : credentials});
    request.end();
    
    request.on('response', function (response) {
        response.setEncoding('utf8');
        data = "";
        response.on('data', function (chunk) {
            data += chunk;
        });
        response.on('end', function () {
            response.setEncoding("utf8");
            res.header('Content-Type', 'application/json');
            data = JSON.parse(data);
            if( typeof data.error == "undefined" ) {
                req.session.auth = true;
                req.session.username = req.body.username
                req.session.password = req.body.password
                req.session.creds = base64_encode(req.body.username + ":"+ req.body.password)
                redirect = {
                    redirect: "dashboard/home"
                }
                res.end( JSON.stringify( redirect ) );
                return;
            } else {
                auth_error(res);
                return;
            }
        });
    });
}

function logout(req, res) {
    req.session.destroy();
    redirect = {
        redirect: "dashboard/login"
    }
    res.send( JSON.stringify( redirect ) );
}

function auth_error(res) {
    res.writeHead(401);
    redirect = {
        redirect: "dashboard/login"
    }
    res.end( JSON.stringify( redirect ) ); 
}

exports.authCheck = function (req, res, next) {
    url = req.urlp = urlpaser.parse(req.url, true);

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
