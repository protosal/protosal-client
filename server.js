// Require the orm and framework
var express = require('express');
var http = require('http');
var rCommon = require('./common')
var app = express.createServer();
var connect = require('connect');
var _ = require('underscore');
var Exceptional = require('./exceptional').Exceptional;
var cradle = require('cradle');

cradle.setup(rCommon.cradle_config);

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
    if( typeof msg == "object" ) {
        /* Stringify couchdb error objects. */
        this.message = "Error: " + msg.error + ". Reason: " + msg.reason;
    }
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
    } else {
        console.log("shiiiiiiiiiiiiiit, what is this new error?");
    }

    Exceptional.handle(err);
    console.log(err);
}); 

function couch_response(err, doc, res) {
    if( err ) {
        throw new ServerError( err );
    } else {
        res.send(doc);
    }
}

function get_property(doc, prop_name) {
    /* Get a property from a couchdb document.
     * This function is only designed for getting
     * the id or rev of a document.
     *
     * We want to search in this order:
     * doc.id
     * doc._id
     * doc.value._id
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
    console.log("Before docid");
    var docid = get_property(doc, 'id');
    console.log("Doc Id: " + docid);

    if( doc.template ) {
        console.log("archive it");
        db.merge(docid, {archived: true, last_modified: Date.now()}, function(err, doc) {
            if( !res ) {
                if( err )
                    throw new ServerError( err );
            } else {
                couch_response(err, doc, res);
            }
        });
    } else {
        console.log("REMOVE IT!");
        var revid = get_property(doc, 'rev');

        db.remove(docid, revid,
            function(err, doc) {
                if( !res ) {
                    if( err ) {
                        console.log("Real Error Message: ");
                        console.log(err);
                        throw new ServerError( err );
                    }
                } else {
                    couch_response(err, doc, res);
                }
            }
        );
    }
}

function emit_doc(id, res) {
    if( res != null ) {
        var db = new(cradle.Connection)().database('app');

        db.get(id,  function(err, doc) {
            if( err ) {
                throw new ServerError( err );
            } else {
                res.send(doc);
            }
        });
    } else {
        return false;
    }
}

function create_new_proposal_section(proposal_id, section_id, author) {
    /* Create a relationship between the proposal and the
     * section instance.
     */
    var db = new(cradle.Connection)().database('app');

    var new_proposal_section = {
        'proposal_id' : proposal_id,
        'section_id' : section_id,
        'type' : 'proposal_section',
        'author' : author 
    }

    db.save(new_proposal_section, function(err, doc) {
        if( err ) {
            throw new ServerError( err );
        }
    });
}

app.get('/data/newinstance/:proposal_id/:section_id', function(req, res) {
    var db = new(cradle.Connection)().database('app');

    db.get(req.params.section_id, function(err, doc) {
        if( err ) {
            throw new ServerError( err );
        } else {
            if( doc.author == req.session.username ) {
                /* Remove the _id and _rev from the document
                 * as we are going to clone it.
                 */
                var docid = doc._id;
                doc.template = false;
                doc.template_id = req.params.section_id;
                doc.created_at = Date.now();
                doc.last_modified = Date.now();
                delete doc._id;
                delete doc._rev;

                db.save(doc, function(err, new_doc) {
                    if( err ) {
                        throw new ServerError( err );
                    } else {
                       create_new_proposal_section(
                           req.params.proposal_id,
                           new_doc._id,
                           req.session.username
                        ); 

                        /* Instantiate all fees related to the section. */
                        db.view('section_fee/list_by_parent', { key: docid }, function(err, res_arr) {
                            if( err ) {
                                throw new ServerError( err );
                            } else {
                                res_arr.forEach(function(row) {
                                    db.save(row, function(err, response) {
                                        if( err ) {
                                            throw new ServerError( err );
                                        }
                                    });
                                });
                            } 
                        });

                        /* Return a value to the client. */
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
            throw new ServerError( err );
        } else {
            if( doc.author == req.session.username ) {
                res.send(doc);
            } else {
                res.send({"error": "authorization required"}, 401);
            }
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
                throw new ServerError( err );
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

app.put('/user', function(req, res) {
    /* Updated the supplied user record. */
    if( req.session && typeof req.session.username != 'undefined' ) {
        var db = new(cradle.Connection)().database('_users');
        var docid = 'org.couchdb.user:' + req.session.username;
        req.body.last_modified = Date.now();

        db.merge(docid, req.body, function(err, doc) {
            couch_response(err, doc, res); 
        });
    } else {
        throw new AuthError;
    }
});

app.put('/data/:id', function(req, res) {
    var db = new(cradle.Connection)().database('app');

    db.get(req.params.id, function(err, doc) {
        if( err ) {
            throw new ServerError( err );
        } else if( doc.author == req.session.username ) {
            /* Only save if the author of the document is
             * trying to update it.
             */

            req.body.last_modified = Date.now();
            db.merge(req.params.id, req.body, function(err, doc) {
                    couch_response(err, doc, res);
                }
            );        
        } else {
            throw new AuthError;
        }
    });
    
});

app.post('/data', function(req, res) {
    var db = new(cradle.Connection)().database('app');

    /* Set the author. */
    req.body.author = req.session.username;
    req.body.created_at = Date.now();
    req.body.last_modified = Date.now();

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
            throw new ServerError( err );
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
app.delete('/delete/:controller/:parent_id/:child_id', function(req, res) {
    var db = new(cradle.Connection)().database('app');

    var key = {key: [req.params.parent_id, req.params.child_id]};
    db.view(req.params.controller + '/list', key, function(err, rel_doc) {
        if( err ) {
            throw new ServerError( err );
        } else {
            /* Delete the relationship document.
             * Views always return an array of objects.
             */
            couch_remove(db, rel_doc[0], res);
        }
    });
});

app.listen(3000);

process.on('uncaughtException', function (err) {
    console.log(err);
    Exceptional.handle(err);
});
