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
var _ = require('underscore');

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

function app_db_handler(req, res, request) {
    req.body.author = req.session.username;
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
	var request_url = '/app/' + req.params.id + (req.params.rev ? "?rev=" + req.params.rev : "");
    app_db_handler(req, res, rCommon.couchdb_request(req, request_url) );
});
app.post('/data', function(req, res) {
	var request_url = '/app';
    app_db_handler(req, res, rCommon.couchdb_request(req, request_url) );
});

app.get('/data/:id/:rev?', function(req, res) {
    var request_url = '/app/' + req.params.id + (req.params.rev ? "?rev=" + req.params.rev : "");
    var request = rCommon.couchdb_request(req, request_url);
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

function delete_request(req, res, request_url) {
	var deleterequest = rCommon.couchdb_request(req, request_url, "DELETE");
	deleterequest.end();
	
	deleterequest.on('response', function (responsea) {
		responsea.on('data', function (data) {
			res.header('Content-Type', 'application/json');
			res.send(data);
		})
	});
}

app.delete('/data/:id/:rev?', function(req, res) {
    var request_url = '/app/' + req.params.id + (req.params.rev ? "?rev=" + req.params.rev : "");
    var authorcheck = rCommon.couchdb_request(req, request_url, "GET");
    authorcheck.end();
    
    authorcheck.on('response', function (response) {
        response.setEncoding('utf8');
        response.on('data', function (data) {
            console.log(data);
            author = JSON.parse(data).author;
            console.log("checking the " + author );
            if( req.session.username == author ) {
				var url = '/app/' + req.params.id + (req.params.rev ? "?rev=" + req.params.rev : "");
				delete_request(req, res, url);
            }
        });
    });
});


//Delete the relationship
app.delete('/delete/:controller/:id/:id2', function(req, res) {
    var request_url = '/app/_design/' + req.params.controller + "/_view/list?key=[\""+ req.params.id + "\",\""+ req.params.id2 +"\"]";
    var request = rCommon.couchdb_request(req, request_url, "GET");
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
            delete_request(req, res, url);
        });
    });
});

var generic_list_retrieve = function(req, res, request) {
    if( req.method == "POST" ) {
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
	var request_url = '/app/_design/' + req.params.view + "/_view/list_by_parent?key=\"" + req.params.id + "\"";
	generic_list_retrieve(req, res, rCommon.couchdb_request(req, request_url));
});

app.get('/related2/:view/:id', function( req, res ){
	var request_url = '/app/_design/' + req.params.view + "/_view/list_by_parent?key=\"" + req.params.id + "\"";
	var request = rCommon.couchdb_request(req, request_url);
	request.end();
	/* The relationship request format is now parent_child.
	 * The script figures out how to call the right views.
	 */
	 
    var child = req.params.view.split('_')[1];
    
    
    request.on('response', function (response) {
        response.setEncoding('utf8');
        all_data = ""
        response.on('data', function (data) {
            all_data += data;
        });
        response.on('end', function (){
			var asd = JSON.parse(all_data).rows;
			
            keys = _.map(JSON.parse(all_data).rows, function( row ) {
				var property = child + '_id';
				return row.value[property];
			});
			
			req.rawBody = JSON.stringify({
				"keys": keys
			});
			
			var request_url2 = '/app/_design/' + child + "/_view/list_by_id";
			req.method = "POST";
			generic_list_retrieve(req, res, rCommon.couchdb_request(req, request_url2));
        });
    });
});

app.get('/:list_type/:view', function(req, res) {
	var request_url = '/app/_design/' + req.params.view + "/_view/" + req.params.list_type + "?key=\"" + req.session.username + "\"";
    generic_list_retrieve(req, res, rCommon.couchdb_request(req, request_url));
});
app.post('/:list_type/:view', function(req, res) {
	var request_url = '/app/_design/' + req.params.view + "/_view/" + req.params.list_type;
    generic_list_retrieve(req, res, rCommon.couchdb_request(req, request_url));
});


app.listen(3000);
