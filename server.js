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
var uuid = require('node-uuid');
var Exceptional = require('./exceptional').Exceptional;

Exceptional.API_KEY = '05f3e5df3c4b21870836f019eff3d4e3fa49f0bb';

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

app.error(function(err, req, res, next){
    Exceptional.handle(err);
    console.log(err);
}); 

function app_db_handler(req, res, request) {
    req.body.author = req.session.username;
    request.write( JSON.stringify(req.body) );
    request.end();
    
    request.on('response', function (response) {
        var data = '';
        response.on('data', function(chunk) {
            data += chunk;
        });
        response.on('end', function () {
            res.send(JSON.parse(data));
        });
    });
}

function emit_doc(req, res, id, rev) {
    var database = '/app/';
    var request_url = database + id + (rev ? "?rev=" + rev : "");
    var request = rCommon.couchdb_request(req, res, request_url,
        {"method" : "GET"});
    request.end();
    
    request.on('response', function (response) {
        response.setEncoding('utf8');
        var data = '';

        response.on('data', function(chunk) {
            data += chunk;    
        });

        response.on('end', function () {
            var parsed_data = JSON.parse(data);
            console.log(parsed_data);

            if( parsed_data.author && parsed_data.author == req.session.username ) {
                res.send(parsed_data);
            } else {
                console.log("DAMMIT HACKER!");
                res.send( {"redirect" : "/"}, 401 );
            }
        });
    });
}

app.get('/data/newinstance/:id', function(req, res) {
    var section_url = '/app/' + req.params.id;
    var section_request = rCommon.couchdb_request(req, res, section_url, {"method" : "GET"});
    section_request.end();

    section_request.on('response', function(response) {
        var section_data = '';
        response.on('data', function(chunk) {
            section_data += chunk;
        });

        response.on('end', function() {
            response.setEncoding('utf8');

            section_data = JSON.parse(section_data);
            section_data.template = false;
            delete section_data._id;
            delete section_data._rev;

            if( section_data.author && section_data.author == req.session.username ) {

                var new_section_url = '/app/';
                var new_section_request = rCommon.couchdb_request(req, res, new_section_url, {"method" : "POST"} );
                new_section_request.write( JSON.stringify(section_data) );
                new_section_request.end();

                new_section_request.on('response', function(response) {
                    response.setEncoding('utf8');
                    var new_section_data = '';
                    
                    response.on('data', function(chunk) {
                        new_section_data += chunk;
                    });

                    response.on('end', function() {
                        new_section_data = JSON.parse(new_section_data);
                        console.log(new_section_data);
                        console.log("we good");
                        emit_doc(req, res, new_section_data.id);
                    });
                });
            } else {
                res.send({"error":"instance creation failed"}, 401);
            }
        });
    });

});

app.get('/data/:id/:rev?', function(req, res) {
    emit_doc(req, res, req.params.id, req.params.rev);
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

function archive_request(req, res, doc, request_url) {
    doc.archived = true;
    req.rawBody = JSON.stringify(doc);

    var archive_request = rCommon.couchdb_request(req, res, request_url,
        {"method" : "PUT"});
    archive_request.end();

    archive_request.on('response', function(response) {
        var archive_data = '';

        response.on('data', function(chunk) {
            archive_data += chunk;
        });

        response.on('end', function(end) {
           res.send(JSON.parse(archive_data)); 
        });
    });
}

function delete_request(req, res, request_url, return_value) {
    if( return_value == null )
        return_value = true;
    var deleterequest = rCommon.couchdb_request(req, res, request_url,
            {"method" : "DELETE"});
    deleterequest.end();
    
    deleterequest.on('response', function (response) {
        var data = '';

        response.on('data', function(chunk) {
            data += chunk;
        });

        response.on('end', function () {
            if( return_value ) {
                res.send(JSON.parse(data));
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
            data = JSON.parse(data);
            if( data.author && req.session.username == data.author ) {
                var url = '/app/' + req.params.id + (req.params.rev ? "?rev=" + req.params.rev : "");
                delete_request(req, res, url);
            } else {
                res.send({"error":"delete failed"}, 401);
            }
        });
    });
});

/* Delete the relationship */
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
            /* Delete the relationship record. */
            var parsed_data = JSON.parse(data);
            console.log(parsed_data);

            if( parsed_data && parsed_data.rows && parsed_data.rows[0] ) {
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
                        var url = '/app/' + data._id + '?rev=' + data._rev;
                        if( !data.template ) {
                            delete_request(req, res, url, false);
                        } else {
                            // Archive it.
                            archive_request(req, res, data, url);
                        }
                    });
                });
            } else {
                if( parsed_data ) {
                    res.send( parsed_data, 400 );
                } else {
                    res.send({"error":"deleted failed"}, 400);
                }
            }
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
            res.send(JSON.parse(data)); 
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
    var request_url = '/app/_design/' + req.params.view + "/_view/" + req.params.list_type;

    switch(req.method) {
        case "GET":
            request_url += "?key=\"" + req.session.username + "\"";
            break;
        case "POST":
            /* The request URL is already correct. */
            break;
        default:
            res.send({"error": "Only GET and POST are supported for " + req.params.list_type + "/" + req.params.view});
            return;
    }

    generic_list_retrieve(req, res, rCommon.couchdb_request(req, res, request_url,
            {"method" : req.method}));
});

app.listen(3000);

process.on('uncaughtException', function (err) {
    console.log(err);
    Exceptional.handle(err);
});
