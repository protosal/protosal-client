var Base64 = require('base64');
var Buffer = require('buffer').Buffer;
var urlpaser = require('url');
var http = require('http');
var Hash = require('./sha1');

var couchdb_host = 'localhost';
var couchdb_port = 5984;

exports.base64_encode = function(enc_string) {
    return Base64.encode( new Buffer(enc_string) );
}

exports.credentials = exports.base64_encode("ryth:abCD--12");
var default_salt = "1";

exports.couchdb_request = function(req, request_url, method) {
	if( method == null )
		method = req.method;
		
	var couchdb = http.createClient(couchdb_port, couchdb_host, true);
	
	var request_params = {
        'Host': couchdb_host,
        'Authorization': 'Basic ' + exports.credentials,
        'Content-Type': 'application/json'
    }
    
    if( method == "POST" || method == "PUT" )
		request_params['Content-Type'] = 'application/json';
		
    var request = couchdb.request(method, request_url, request_params);
    
    return request;
}

exports.authCheck = function (req, res, next) {
    url = req.urlp = urlpaser.parse(req.url, true);

    // ####
    // Logout
    if ( url.pathname == "/logout" ) {
       req.session.destroy();
        redirect = {
            redirect: "user/login"
        }
        res.send( JSON.stringify( redirect ) );
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
        var couchdb = http.createClient(5984, 'localhost', true);
        var request = couchdb.request("POST", '/_users', {
            'Host': 'localhost',
            'Content-Type': 'application/json',
            'Authorization': 'Basic ' + exports.base64_encode(exports.credentials)
        });
        
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
        
    } else if ( url.pathname == "/user/login" ) {
        var couchdb = http.createClient(5984, 'localhost', true);
        var request = couchdb.request("GET", '/_users', {
            'Host': 'localhost',
            'Content-Type': 'application/json',
            'Authorization': 'Basic ' + exports.base64_encode(req.body.username + ":" + req.body.password)
        });
        console.log(req.body.username + ":"+ req.body.password);
        request.end();
        request.on('response', function (response) {
            response.setEncoding('utf8');
            response.on('data', function (data) {
                res.header('Content-Type', 'application/json');
                data = JSON.parse(data);
                if( typeof data.error == "undefined" ) {
                    req.session.auth = true;
                    req.session.username = req.body.username
                    req.session.password = req.body.password
                    req.session.creds = exports.base64_encode(req.body.username + ":"+ req.body.password)
                    redirect = {
                        redirect: "home/dashboard"
                    }
                    res.end( JSON.stringify( redirect ) );
                  return;
                } 
                console.log(data);
                res.writeHead(401);
                console.log("Wrong password or some shit");
                redirect = {
                    redirect: "user/login"
                }
                res.end( JSON.stringify( redirect ) );
                return;
            });

        });
    } else {
        res.writeHead(401);
        console.log("Default error, not validted redirect this fool to user/login");
        redirect = {
            redirect: "user/login"
        }
        res.end( JSON.stringify( redirect ) );
        return;   
     }
}
