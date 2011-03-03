// Require the orm and framework
var express = require('express');
var http = require('http');
var Base64 = require('base64');
var Buffer = require('buffer').Buffer;
var rCommon = require('./common')
var fs = require('fs');
var sys = require('sys');
var app = express.createServer();
var connect = require('connect');

app.configure(function() {
  
  app.use(express.bodyDecoder());

  app.use(express.methodOverride());
  //app.use(express.logger());
  app.use(express.gzip());
  app.use(express.conditionalGet());
  app.use(express.cache());

  // Enable static file serving
  app.use(express.staticProvider(__dirname + '/public'));
  app.use(express.errorHandler({ dumpExceptions: true }));
  //app.use(connect.logger({ format: ':method :url' }));
  app.use(connect.cookieDecoder());
  app.use(connect.session({ secret: 'foobar' }));
  app.use(rCommon.authCheck );
});

var default_host = 'localhost';

function couchdb_request(req, request_url, method) {
	if( method == null )
		method = req.method;
		
	var couchdb = http.createClient(5984, 'localhost', true);
	
	var request_params = {
        'Host': default_host,
        'Authorization': 'Basic ' + rCommon.credentials,
        'Content-Type': 'application/json'
    }
    
    if( method == "POST" || method == "PUT" )
		request_params['Content-Type'] = 'application/json';
		
    var request = couchdb.request(method, request_url, request_params);
    
    return request;
}

function app_db_handler(req, res, request) {
    req.body.author = req.session.username;
    console.log(JSON.stringify(req.body));
    request.write( JSON.stringify(req.body) );
    request.end();
    request.on('response', function (response) {
        response.on('data', function (data) {
            res.header('Content-Type', 'application/json');
            
            res.send(data);
        });
    });
}

app.put('/data/:id/:rev?', function(req, res) {
	fs.writeFile('./tom.loga', sys.inspect(req) );
	var request_url = '/app/' + req.params.id + (req.params.rev ? "?rev=" + req.params.rev : "");
    app_db_handler(req, res, couchdb_request(req, request_url) );
});
app.post('/data', function(req, res) {
    console.log("add new shit nigger");
	fs.writeFile('./tom.loga', sys.inspect(req) );
	var request_url = '/app';
    app_db_handler(req, res, couchdb_request(req, request_url) );
});

app.get('/data/:id/:rev?', function(req, res) {
    var request_url = '/app/' + req.params.id + (req.params.rev ? "?rev=" + req.params.rev : "");
    var request = couchdb_request(req, request_url);

    request.end();
    request.on('response', function (response) {
        response.setEncoding('utf8');
        response.on('data', function (data) {
            var parsed_data = JSON.parse(data);
            if( parsed_data.author == req.session.username ) {
                res.header('Content-Type', 'application/json');
                
                res.send(data);
            } else {
                res.writeHead(401);
                console.log("DAMMIT HACKER!");
                redirect = {
                    redirect: "/"
                }
                res.end( JSON.stringify( redirect ) );
                return;
            }
        });
    });
});

app.delete('/data/:id/:rev?', function(req, res) {
    var request_url = '/app/' + req.params.id + (req.params.rev ? "?rev=" + req.params.rev : "");
    var authorcheck = couchdb_request(req, request_url, "GET");
    
    console.log("url-"+ '/app/' + req.params.id );
    authorcheck.end();
    authorcheck.on('response', function (response) {
        response.setEncoding('utf8');
        response.on('data', function (data) {
            console.log(data);
            author = JSON.parse(data).author;
            console.log("checking the " + author );
            if( req.session.username == author ) {
                var deleterequest = couchdb_request(req, '/app/' + req.params.id + (req.params.rev ? "?rev=" + req.params.rev : ""), "DELETE");
                deleterequest.end();
                deleterequest.on('response', function (responsea) {
                    responsea.on('data', function (data) {
                        res.header('Content-Type', 'application/json');
                        res.send(data);
                    })
                })
            
            }
            
        });
    });
});

app.delete('/delete/:controller/:id/:rev', function(req, res) {
    console.log(req.session.username);
    var cloudanturl = '/app/_design/' + req.params.controller + "/_view/list?key=[\""+ req.params.id + "\",\""+ req.params.rev+"\"]";
    console.log(cloudanturl);
    var request = couchdb_request(req, cloudanturl, "GET");
    
    request.end(req.rawBody);
    request.on('response', function (response) {
        response.setEncoding('utf8');
        rowsa = ""
        response.on('data', function (data) {
            rowsa += data;
        });
        response.on('end', function (){
            console.log(rowsa);
            relationshipid = (JSON.parse(rowsa).rows[0].id);
            relationshiprev = (JSON.parse(rowsa).rows[0].value._rev);
            var url = '/app/' +relationshipid+"?rev=" + relationshiprev;
			var requestdelete = couchdb_request(req, url, "DELETE");
    
			requestdelete.end();
			requestdelete.on('response', function (responsea) {
				responsea.on('data', function (data) {
					res.header('Content-Type', 'application/json');
					res.send(data);
				})
			})
        });
    });
});

var generic_list_retrieve = function(req, res, request) {
    if( typeof req.method == "POST" ) {
		// Used for selecting multiple keys on POST.
		request.end(req.rawBody);
	} else {
		request.end();
	}
    
    request.on('response', function (response) {
        response.setEncoding('utf8');
        rows = ""
        response.on('data', function (data) {
            rows += data;
        });
        response.on('end', function (){
           res.send(rows); 
        });
    });
}

app.get('/related/:view/:id', function( req, res ){
	var request_url = '/app/_design/' + req.params.view + "/_view/listfees?key=\"" + req.params.id + "\"";
	generic_list_retrieve(req, res, couchdb_request(req, request_url));
});

app.get('/:list_type/:view', function(req, res) {
	var request_url = '/app/_design/' + req.params.view + "/_view/" + req.params.list_type + "?key=\"" + req.session.username + "\"";
    generic_list_retrieve(req, res, couchdb_request(req, request_url));
});
app.post('/:list_type/:view', function(req, res) {
	var request_url = '/app/_design/' + req.params.view + "/_view/" + req.params.list_type;
    generic_list_retrieve(req, res, couchdb_request(req, request_url));
});


app.listen(3000);
