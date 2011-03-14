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
var cradle = require('cradle');

cradle.setup({
    host: '127.0.0.1',
    port: 5984,
    auth: { username: 'ryth', password: 'abCD--12' }
});

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
 
function BadJSON(msg) {
    this.name = 'BadJSON';
    Error.call(this, msg);
    Error.captureStackTrace(this, arguments.callee);
}

BadJSON.prototype.__proto__ = Error.prototype;

function AuthRequired(msg) {
    this.name = 'AuthRequired';
    Error.call(this, msg);
    Error.captureStackTrace(this, arguments.callee);
}

AuthRequired.prototype.__proto__ = Error.prototype;

function ServerError(msg) {
    this.name = 'ServerError';
    Error.call(this, msg);
    Error.captureStackTrace(this, arguments.callee);
}

ServerError.prototype.__proto__ = Error.prototype;


app.error(function(err, req, res, next){
    if(err instanceof BadJSON) {
        res.send(err, 400);
    } else if(err instanceof AuthRequired) {
        res.send({"error":"authorization required"}, 401);
    } else if(err instanceof ServerError) {
        res.send({"error":"internal server error"}, 500);
    }

    Exceptional.handle(err);
    console.log(err);
}); 

function couch_response(err, doc, res) {
    if( err ) {
        res.send(err, 500);
    } else {
        res.send(doc);
    }
}

function couch_remove(db, doc, res) {
    var docid = "";
    if( typeof doc.id != "undefined" ) {
        docid = doc.id;
    } else if( typeof doc._id != "undefined" ) {
        docid = doc._id;
    } else if( typeof doc.value != "undefined" && typeof doc.value._id != "undefined" ) {
        docid = doc.value._id
    }

    if( doc.template ) {
        db.merge(docid, {archived: true}, function(err, doc) {
            if( !res ) {
                if( err )
                    throw new ServerError;
            } else {
                couch_response(err, doc, res);
            }
        });
    } else {
        var revid = "";
        if( typeof doc.rev != "undefined" ) {
            revid = doc.rev;
        } else if( typeof doc._rev != "undefined" ) {
            revid = doc._rev;
        } else if( typeof doc.value != "undefined" && typeof doc.value._rev != "undefined" ) {
            revid = doc.value._rev;
        }

        db.remove(docid, revid,
            function(err, doc) {
                if( !res ) {
                    if( err ) {
                        throw new ServerError;
                    }
                } else {
                    couch_response(err, doc, res);
                }
            }
        );
    }
}

_.mixin({
    to_json: function (obj) {
        try {
            return JSON.parse(obj);
        } catch(err) {
            throw new BadJSON;
        }
    }
});

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
            var parsed_data = _(data).to_json();

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

            section_data = _(section_data).to_json();

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
                        new_section_data = _(new_section_data).to_json();

                        emit_doc(req, res, new_section_data.id);
                    });
                });
            } else {
                res.send({"error":"instance creation failed"}, 401);
            }
        });
    });

});

app.get('/data/:id', function(req, res) {
    var db = new(cradle.Connection)().database('app');

    db.get(req.params.id, function(err, doc) {
        if( err ) {
            res.send(err, 500);
        } else {
            if( doc.author == req.session.username ) {
                res.send(doc);
            } else {
                res.send({"error": "authorization required"}, 401);
            }
        }
    });
});

app.put('/data/:id', function(req, res) {
    var db = new(cradle.Connection)().database('app');

    /* Set the author. */
    req.body.author = req.session.username;

    db.save(req.params.id, req.params.rev, req.body,
        function(err, doc) {
            couch_response(err, doc, res);
        }
    );
});

app.post('/data', function(req, res) {
    var db = new(cradle.Connection)().database('app');

    /* Set the author. */
    req.body.author = req.session.username;

    db.save(req.body,
        function(err, doc) {
            couch_response(err, doc, res);
        }
    );
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
            res.send(_(archive_data).to_json());
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
                res.send(_(data).to_json());
            }
        })
    });
}

app.delete('/data/:id/:rev', function(req, res) {
    var db = new(cradle.Connection)().database('app');
    db.get(req.params.id, function(err, doc) {
        if( err ) {
            res.send(err, 500);
        } else {
            if( doc.author == req.session.username ) {
                couch_remove(db, doc, res);
            } else {
                res.send({"error": "delete failed"}, 401);
            }
        }
    });
});

/* Delete the relationship */
app.delete('/delete/:controller/:id/:id2', function(req, res) {
    var db = new(cradle.Connection)().database('app');

    var key = {key: [req.params.id, req.params.id2]};
    db.view(req.params.controller + '/list', key, function(err, rel_doc) {
        if( err ) {
            res.send(err, 500);
            return;
        } else {
            /* Delete foreign relation. This is always id2. */
            db.get(req.params.id2, function(err, doc) {
                if( err ) {
                    res.send(err, 500);
                    return;
                } else {
                    couch_remove(db, doc, res);
                }
            });

            /* Delete the relationship document.
             * Views always return an array of objects.
             */
            couch_remove(db, rel_doc[0]);
        }
    });
});

    /*
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
            // Delete the relationship record.
            var parsed_data = _(data).to_json();
            console.log(parsed_data);

            if( parsed_data && parsed_data.rows && parsed_data.rows[0] ) {
                var relationshipid = (parsed_data.rows[0].id);
                var relationshiprev = (parsed_data.rows[0].value._rev);
                var relationship_url = '/app/' + relationshipid + '?rev=' + relationshiprev;
                delete_request(req, res, relationship_url);

                var childid = (parsed_data.rows[0].key[1]);

                var child_request_url = '/app/' + childid;

                // Cascade the delete to the child record.
                var child_request = rCommon.couchdb_request(req, res, child_request_url,
                    {"method" : "GET"});
                child_request.end();
                child_request.on('response', function(response) {
                    data = '';

                    response.on('data', function(chunk) {
                        data += chunk;
                    });

                    response.on('end', function() {
                        data = _(data).to_json();
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
    */

app.get('/related2/:view/:id', function( req, res ){
    var db = new(cradle.Connection)().database('app');

    var child = req.params.view.split('_')[1];

    db.view(req.params.view + '/list_by_parent',
        { key: req.params.id },
        function(err, doc) {
            if( err ) {
                res.send(err, 500);
            } else {
                var keys = _.map(doc.rows, function( row ) {
                    var property = child + '_id';
                    return row.value[property];
                });    

                db.view(child + '/list_by_id', {'keys': keys}, function(err, doc) {
                    couch_response(err, doc, res);
                });
            }
        }
    );
});

app.get('/:list_type/:view', function(req, res) {
    var db = new(cradle.Connection)().database('app');

    db.view(req.params.view + '/' + req.params.list_type,
        { key: req.session.username },
        function(err, doc) {
            couch_response(err, doc, res);
        }
    );
});

app.listen(3000);

process.on('uncaughtException', function (err) {
    console.log(err);
    Exceptional.handle(err);
});
