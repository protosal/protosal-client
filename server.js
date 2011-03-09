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
    app.use(express.responseTime());  
    app.use(express.bodyParser());

    app.use(express.methodOverride());
    //app.use(express.logger());

    // Enable static file serving
    app.use(express.static(__dirname + '/public'));
    //app.use(express.errorHandler({ dumpExceptions: true }));
    //app.use(connect.logger({ format: ':method :url' }));
    app.use(connect.cookieParser());
    app.use(connect.session({ secret: 'foobar' }));
    app.use(rCommon.authCheck );
});

app.error(function(err, req, res) {
    var error = {
        "error": "You done fucked up",
        "message": "Bad request. Or something."
    };

    res.send(JSON.stringify(error));
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

function get_data(url, method) {
    var request = '';
}

app.get('/data/:id/:rev?', function(req, res) {
    var request_url = '/app/' + req.params.id + (req.params.rev ? "?rev=" + req.params.rev : "");
    var request = rCommon.couchdb_request(req, res, request_url,
        {"method" : req.method});
    request.end();
    
    request.on('response', function (response) {
        response.setEncoding('utf8');
        var data = '';

        response.on('data', function(chunk) {
            data += chunk;    
        });

        response.on('end', function () {
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

app.put('/data/:id/:rev?', function(req, res) {
    var request_url = '/app/' + req.params.id + (req.params.rev ? "?rev=" + req.params.rev : "");
    app_db_handler(req, res,
        rCommon.couchdb_request(req, res, request_url, {"method" : req.method}) );
});

app.post('/data', function(req, res) {
    var request_url = '/app';
    app_db_handler(req, res,
        rCommon.couchdb_request(req, res, request_url, {"method" : req.method}) );
});

app.post('/data/newinstance/:id', function(req, rest) {
    var request_url = 'app';
    /* Set the template id for the new record. */
    req.body.template = req.params.id;
    /* Set the HTTP request method to COPY so we can leverage CouchDB's
     * inbuilt functionality.
     */
    req.method = 'COPY';

    var url = "";
    var fee_request = "";
    /* Copy all fees. */
    switch(req.body.type) {
        case "section":
            url = '/app/_design/section_fee/_view/list_by_parent?key="' + req.params.id + '"';
            fee_request = rCommon.couchdb_request(req, res, url,
                {"method" : req.method});
            break;
        default:
            break;
    }

    app_db_handler(req, res, rCommon.couchdb_request(req, res, request_url,
            {"method" : req.method}) );
});
 

function delete_request(req, res, request_url, return_value) {
    if( return_value == null )
        return_value = true;
    var deleterequest = rCommon.couchdb_request(req, res, request_url,
            {"method" : "DELETE"});
    deleterequest.end();
    
    deleterequest.on('response', function (response) {
        response.on('data', function (data) {
            if( return_value ) {
                res.header('Content-Type', 'application/json');
                res.send(data);
            }
        })
    });
}

app.delete('/data/:id/:rev?', function(req, res) {
    var request_url = '/app/' + req.params.id + (req.params.rev ? "?rev=" + req.params.rev : "");
    var authorcheck = rCommon.couchdb_request(req, res, request_url,
        {"method" : "GET"});
    authorcheck.end();
    
    authorcheck.on('response', function (response) {
        response.setEncoding('utf8');
        data = "";

        response.on('data', function (chunk) {
            data += chunk;
        });

        response.on('end', function () {
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
    var request = rCommon.couchdb_request(req, res, request_url,
        {"method" : "GET"});
    request.end();
    
    request.on('response', function (response) {
        response.setEncoding('utf8');
        data = ""

        response.on('data', function (chunk) {
            data += chunk;
        });

        response.on('end', function (){
            console.log(data);
            /* Delete the relationship record. */
            var parsed_data = JSON.parse(data);
            var relationshipid = (parsed_data.rows[0].id);
            var relationshiprev = (parsed_data.rows[0].value._rev);
            var relationship_url = '/app/' + relationshipid + '?rev=' + relationshiprev;
            delete_request(req, res, relationship_url);

            var childid = (parsed_data.rows[0].key[1]);

            var child_request_url = '/app/' + childid;

            /* Cascade the delete to the child record. */
            var child_request = rCommon.couchdb_request(req, res, child_request_url,
                {"method" : "GET"});
            child_request.end();
            child_request.on('response', function(response) {
                data = '';

                response.on('data', function(chunk) {
                    data += chunk;
                });

                response.on('end', function() {
                    data = JSON.parse(data);
                    // Only delete instances
                    if( data.template && data.template == false ) {
                        var del_url = '/app/' + data._id + '?rev=' + data._rev;
                        delete_request(req, res, del_url, false);
                    }
                });
            });
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
        data = "";

        response.on('data', function (chunk) {
            data += chunk;
        });

        response.on('end', function (){
            res.send(data); 
        });
    });
}

app.get('/related/:view/:id', function( req, res ){
    var request_url = '/app/_design/' + req.params.view + "/_view/list_by_parent?key=\"" + req.params.id + "\"";
    generic_list_retrieve(req, res, rCommon.couchdb_request(req, res, request_url,
            {"method" : req.method}));
});

app.get('/related2/:view/:id', function( req, res ){
    var request_url = '/app/_design/' + req.params.view + "/_view/list_by_parent?key=\"" + req.params.id + "\"";
    var request = rCommon.couchdb_request(req, res, request_url,
        {"method" : req.method});
    request.end();
    /* The relationship request format is now parent_child.
     * The script figures out how to call the right views.
     */
     
    var child = req.params.view.split('_')[1];

    request.on('response', function (response) {
        response.setEncoding('utf8');
        data = "";
        response.on('data', function (chunk) {
            data += chunk;
        });
        response.on('end', function (){
            
            keys = _.map(JSON.parse(data).rows, function( row ) {
                var property = child + '_id';
                return row.value[property];
            });
            
            req.rawBody = JSON.stringify({
                "keys": keys
            });

            req.method = "POST";
            
            var request_url2 = '/app/_design/' + child + "/_view/list_by_id";
            generic_list_retrieve(req, res, rCommon.couchdb_request(req, res,
                    request_url2, {"method" : req.method}));
        });
    });
});

app.all('/:list_type/:view', function(req, res) {
    var request_url = "";

    switch(req.method) {
        case "GET":
            request_url = '/app/_design/' + req.params.view + "/_view/" + req.params.list_type + "?key=\"" + req.session.username + "\"";
            break;
        case "POST":
            var request_url = '/app/_design/' + req.params.view + "/_view/" + req.params.list_type;
            break;
        default:
            res.header('Content-Type', 'application/json');
            res.send(JSON.stringify({"error": "Only GET and POST are supported for " + req.params.list_type + "/" + req.params.view}));
            return;
    }

    generic_list_retrieve(req, res, rCommon.couchdb_request(req, res, request_url,
            {"method" : req.method}));
});

app.listen(3000);
