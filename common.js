var Base64 = require('base64');
var Buffer = require('buffer').Buffer;
var urlpaser = require('url');
var http = require('http');
var Hash = require('./sha1');
var fs = require('fs');
var sys = require('sys');

var couchdb_host = '127.0.0.1';
var couchdb_port = 5984;

exports.base64_encode = function(enc_string) {
    return Base64.encode( new Buffer(enc_string) );
}

exports.credentials = exports.base64_encode("ryth:abCD--12");
var default_salt = "1";

exports.couchdb_request = function(request_url, method, credentials) {
    if( credentials == null ) {
        credentials = "";
    } else {
        credentials = exports.base64_encode(credentials);
    }
        
    var couchdb = http.createClient(couchdb_port, couchdb_host, true);
    
    var request_params = {
        'Host': couchdb_host,
        'Authorization': 'Basic ' + credentials,
    }
    
    if( method == "POST" || method == "PUT" )
        request_params['Content-Type'] = 'application/json'; 
        
    var request = couchdb.request(method, request_url, request_params);
    
    return request;
}

function register(req, res) {
    var request = exports.couchdb_request('/_users', "POST");
        
    var newUser = {
        _id: "org.couchdb.user:" + req.body.email,
        name: req.body.email,
        password_sha: Hash.hex_sha1(req.body.password + default_salt),
        salt: default_salt,
        type: "user",
        roles: []
    }
    
    request.end( JSON.stringify(newUser) );
    request.on('response', function (response) {
        response.on('data', function (data) {
            res.header('Content-Type', 'application/json');
            res.send(data);
        });
    });
}

function login(req, res) {
    var credentials = "";
    fs.writeFile('temp.out', sys.inspect(req));
    if( req.body ) {
        credentials = req.body.username + ":" + req.body.password;
    } else {
        auth_error(res);
        return;    
    }

    var request = exports.couchdb_request('/_session', "GET", credentials);
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
                req.session.creds = exports.base64_encode(req.body.username + ":"+ req.body.password)
                redirect = {
                    redirect: "dashboard/home"
                }
                res.end( JSON.stringify( redirect ) );
                return;
            } else {
                console.log("Wrong password or some shit");
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
    console.log("Default error, not validted redirect this fool to user/login");
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
    console.log("URL Pathname: " + url.pathname);
    if( url.pathname == "/user/register" ) {
        register(req, res);
    } else if ( url.pathname == "/user/login" ) {
        login(req, res);
    } else {
        console.log("The fuck?");
        auth_error(res);
    }
}
