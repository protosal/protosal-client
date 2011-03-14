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

function get_property(doc, prop_name) {
    /* Get a property from a couchdb document.
     * This function is only design for getting
     * the id or rev of a document.
     */
    var property = "";
    if( typeof doc[prop_name] != "undefined" ) {
        property = doc[prop_name];
    } else if( typeof doc['_' + prop_name] != "undefined" ) {
        property = doc['_' + prop_name];
    } else if( typeof doc.value != "undefined"
            && typeof doc.value['_' + prop_name] != "undefined" ) {
        property = doc.value['_' + prop_name];
    }
    
    return property;
}

function couch_remove(db, doc, res) {
    var docid = get_property(doc, 'id');

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
        var revid = get_property(doc, 'rev');

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

function emit_doc(id, res) {
    if( res != null ) {
        var db = new(cradle.Connection)().database('app');

        db.get(id,  function(err, doc) {
            if( err ) {
                res.send(err, 500);
            } else {
                res.send(doc);
            }
        });
    } else {
        return false;
    }
}

app.get('/data/newinstance/:id', function(req, res) {
    var db = new(cradle.Connection)().database('app');

    db.get(req.params.id, function(err, doc) {
        if( err ) {
            res.send(err, 500);
        } else {
            if( doc.author && doc.author == req.session.username ) {
                /* Remove the _id and _rev from the document
                 * as we are going to clone it.
                 */
                delete doc._id;
                delete doc._rev;

                db.save(doc, function(err, new_doc) {
                    if( err ) {
                        res.send(err, 500);
                    } else {
                        emit_doc(new_doc._id, res);
                    }
                });
            } else {
                res.send({"error":"unauthorized", "reason":"incorrect user"}, 401);
            }
        }
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
