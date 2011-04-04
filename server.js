// Require the orm and framework
var express = require('express');
var http = require('http');
var rCommon = require('./common')
var connect = require('connect');
var _ = require('underscore');
var Exceptional = require('./exceptional').Exceptional;
var cradle = require('cradle');
var form = require('connect-form');
var async = require('async');
var fs = require('fs');
var sys = require('sys');
var pdfcrowd = require('./node-pdfcrowd');
var postmark = require('postmark')('473b864e-b165-473c-9435-68981a3bbeef');
var Hash = require('./sha1');

var app = express.createServer(
  // connect-form (http://github.com/visionmedia/connect-form)
  // middleware uses the formidable middleware to parse urlencoded
  // and multipart form data
  form({ keepExtensions: true })
);

cradle.setup(rCommon.cradle_config);

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
    if( typeof msg == 'object' ) {
        /* Stringify couchdb error objects. */
        this.message = 'Error: ' + msg.error + '. Reason: ' + msg.reason;
    }
    Error.call(this, msg);
    Error.captureStackTrace(this, arguments.callee);
}

ServerError.prototype.__proto__ = Error.prototype;

app.error(function(err, req, res, next){
    if(err instanceof BadJSON) {
        res.send(err, 400);
    } else if(err instanceof AuthRequired) {
        rCommon.auth_error(res);
    } else if(err instanceof ServerError) {
        res.send({'error':'internal server error'}, 500);
    } else {
        console.log('shiiiiiiiiiiiiiit, what is this new error?');
    }

    Exceptional.handle(err);
    console.log(err);
    console.log(err.stack);
}); 

function couch_response(err, doc, res) {
    if( err ) {
        res.send( err, 500 );
    } else {
        res.send( doc );
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
    var property = '';
    if( typeof doc[prop_name] != 'undefined' ) {
        property = doc[prop_name];
    } else if( typeof doc['_' + prop_name] != 'undefined' ) {
        property = doc['_' + prop_name];
    } else if( typeof doc.value != 'undefined'
            && typeof doc.value['_' + prop_name] != 'undefined' ) {
        property = doc.value['_' + prop_name];
    }
    
    return property;
}

function couch_remove(db, doc, res) {
    console.log('Before docid');
    var docid = get_property(doc, 'id');
    console.log('Doc Id: ' + docid);

    if( doc.template ) {
        console.log('archive it');
        db.merge(docid, {archived: true, last_modified: Date.now()}, function(err, doc) {
            if( !res ) {
                if( err )
                    throw new ServerError( err );
            } else {
                couch_response(err, doc, res);
            }
        });
    } else {
        console.log('REMOVE IT!');
        var revid = get_property(doc, 'rev');

        db.remove(docid, revid,
            function(err, doc) {
                if( !res ) {
                    if( err ) {
                        console.log('Real Error Message: ');
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

function new_section_fee( section_id, fee_id, author, callback ) {
    var db = new(cradle.Connection)().database('app');

    /* Generate the new section_fee document. */
    var new_section_fee = {
        section_id: section_id,
        fee_id: fee_id,
        created_at: Date.now(),
        last_modified: Date.now(),
        type: 'sectionfee',
        author: author
    }


    /* Finally, create the new section_fee document. */
    db.save(new_section_fee, function(err, new_doc) {
        if( err ) {
            return callback( err );
        } else {
            return callback( null, new_doc );
        }
    });
}

function new_section_fees_from_array( section_id, fee_doc_arr, author, callback ) { 
    async.forEach(
        fee_doc_arr,
        function( instance_fee_doc, local_callback ) {
            new_section_fee(
                section_id,
                instance_fee_doc.id,
                author,
                local_callback
            );
        },
        function( err ) {
            if( err ) return callback( err );
        }
    );
}

function get_section_fee_records(template_section_id, callback) {
    /* Get all section_fee records associated with the section. */
    var db = new(cradle.Connection)().database('app');

    db.view('section_fee/list_by_parent', { key: docid }, function(err, doc_arr) {
        if( err ) {
            return callback( err );
        } else {
            return callback(null, doc_arr);
        }
    });
}

function check_doc_auth(docid, username, callback) {
    /* Check auth details, returning the associated document. */

    var db = new(cradle.Connection)().database('app');
    
    db.get(docid, function(err, doc) {
        if( err ) return callback( err );

        if( doc.author == username ) {
            return callback( null, doc );
        } else {
            /* Indicate failure. */
            return callback( false );
        }
    });
}

function new_doc_instance(doc, callback) {
    var db = new(cradle.Connection)().database('app');

    /* Save a copy of the doc._id as we will delete it. */
    var template_id = doc._id;

    /* Delete _id and _rev so we create a new record. */
    delete doc._id;
    delete doc._rev;

    /* Indicate the new document is an instance. */
    doc.template = false;
    /* Record the template this document was generated from. */
    doc.template_id = template_id;

    /* Set the new created and modified times. */
    doc.created_at = Date.now();
    doc.last_modified = Date.now();

    db.save(doc, function(err, doc) {
        if( err ) {
            return callback( err );
        } else {
            /* Return the template id and the saved doc details. */
            return callback( null, doc );
        }
    });
}

function new_proposal_section(proposal_id, section_id, author, callback) {
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
            return callback( err );
        } else {
            return callback( null, doc );
        }
    });
}

function clone_docs_series(doc_arr, callback) {
    console.log("doc_arr:");

    async.mapSeries(doc_arr, new_doc_instance, function(err, result) {
        if( err ) {
            return callback( err );
        } else {
            return callback( null, result );
        }
    });
}

function new_fee_list( section_id, fee_docs, callback ) {
    var db = new(cradle.Connection)().database('app');

    console.log("fee docs:");

    var fee_ids = fee_docs.map(function( doc ) {
        return doc.id;
    });

    db.merge( section_id, { feelist: fee_ids }, function( err, doc ) {
        if( err ) {
            return callback( err );
        } else {
            return callback( null, doc );
        }
    });
}

function get_docs( doc_ids, callback ) {
    var db = new(cradle.Connection)().database('app');

    db.get( doc_ids, function(err, docs) {
        if( err ) {
            return callback( err );
        } else {
            return callback( null, docs );
        }
    });
}

app.get('/data/newinstance/:proposal_id/:section_id', function(req, res) {
    var db = new(cradle.Connection)().database('app');
    var template_section_doc = {};
    var instance_section_id = '';

    async.waterfall([
        function( callback ) {
            check_doc_auth(
                req.params.section_id,
                req.session.username,
                callback
            );
        },
        function( section_doc, callback ) {
            console.log("new section instance");

            template_section_doc = section_doc;
            
            new_doc_instance( section_doc, callback );
        },
        function( section_instance_doc, callback ) {
            console.log("get fee docs");
            console.log(template_section_doc);

            instance_section_id = section_instance_doc.id;

            get_docs( template_section_doc.feelist, callback );
        },
        function( template_fee_docs, callback ) {
            console.log("clone docs series");

            console.log(template_fee_docs);

            clone_docs_series( template_fee_docs, callback ); 
        },
        function( instance_fee_docs, callback ) {
            console.log("new fee list");
            console.log(instance_fee_docs);
            
            new_fee_list( instance_section_id, instance_fee_docs, callback );
        },
        function( doc, callback ) {
            console.log("new proposal section");
            console.log(doc);

            new_proposal_section(
                req.params.proposal_id,
                instance_section_id,
                req.session.username,
                callback
            );
        }
    ],
    function( err ) {
        if( err ) {
            console.log( err );
            console.log( new Error().stack );

            res.send({}, 500);
        } else {
            res.send({}, 200);
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
                rCommon.auth_error(res);
            }
        }
    });
});

app.get('/related2/:view/:id', function( req, res ){
    /* This route returns all child documents in a relationship.
     *
     * It takes a relationship view expected to be named
     * 'parent_child', where both parent and child are
     * valid views. For example 'section_fee', where both
     * 'section' and 'fee' are valid views.
     */

    var db = new(cradle.Connection)().database('app');

    var child = req.params.view.split('_')[1];

    /* Get all relationship documents. */
    db.view(req.params.view + '/list_by_parent',
        { key: req.params.id },
        function(err, doc) {
            if( err ) {
                throw new ServerError( err );
            } else {
                /* Extract all child ids from the returned relationship documents. */
                var keys = _.map(doc.rows, function( row ) {
                    var property = child + '_id';
                    return row.value[property];
                });    

                /* Return all corresponding child documents. */
                db.view(child + '/list_by_id', {'keys': keys}, function(err, doc) {
                    couch_response(err, doc, res);
                });
            }
        }
    );
});

app.get('/logo/:user_id', function(req, res) {
    var db = new(cradle.Connection)().database('app');
    var docid = 'org.couchdb.user:' + req.params.user_id;

    db.get(docid, function(err, doc) {
        if (err) return res.send(err, 404);

        /* Loop through all attachment documents. */
        for( var name in doc._attachments ) {
            /* Stopping at the first document containing 'logo'.
             * This works because every time a new logo is updated,
             * all other attachements on the user profile document
             * are deleted.
             */
            if( name.indexOf('logo') != -1 ) {
                console.log(doc._id);
                console.log(name);
                /* Proxy the response from couchdb. */
                db.getAttachment(doc._id, name).on('response', function(response) {
                    response.on('data', function(chunk) {
                        res.write(chunk, 'binary');
                    }); 

                    response.on('end', function() {
                        res.end();
                    });
                });

                return;
            }
        }

        /* If we didn't find a logo, return a default logo. */
        res.sendfile('public/media/images/default_logo.png');
    });
});

app.get('/user', function(req, res) {
    var db = new(cradle.Connection)().database('app');
    var docid = 'org.couchdb.user:' + req.session.username;

    db.get(docid, function(err, doc) {
        couch_response(err, doc, res); 
    });
});

app.get('/register/:activation_key', function(req, res) {
    var db = new(cradle.Connection)().database('app');
    var key = { key: req.params.activation_key };

    db.view('user/register', key, function(err, doc_arr) {
        /* If a document is returned, the activation link was valid. */
        if( doc_arr.length == 1 ) {
            db.merge(doc_arr[0].id, {activated: true}, function(err, doc) {
                if( err ) {
                    throw new ServerError( err );
                } else {
                    var user_login = doc_arr[0].id.replace('org.couchdb.user:', '');
                    res.redirect('#/dashboard/login/activated/' + user_login);
                }
            });
        }
    });
});

app.get('/proposal/stats', function(req, res) {
    var db = new(cradle.Connection)().database('app');
    var options = {
        startkey: [req.session.username],
        endkey: [req.session.username, {}],
        group: true
    };
         
    db.view('proposal/status_count', options, function(err, doc) {
        couch_response(err, doc, res);
    });
});

app.get('/proposal/:limit?/:status?/:startdate?/:enddate?', function(req, res) {
    var db = new(cradle.Connection)().database('app');
    var options = {
        startkey: [req.session.username],
        endkey: [req.session.username, {}],
    };

    /* If a limit is present and not set to all, add it to the key. */
    if( req.params.limit && req.params.limit != 'all' )
        options.limit = req.params.limit;
    
    if( req.params.status ) {
        options.startkey.push( req.params.status );
        options.endkey.pop();
        options.endkey.push( req.params.status, {} );
    }

    if( req.params.startdate && req.params.enddate) {
        options.startkey[2] = parseInt(req.params.startdate);
        options.endkey[2] = parseInt(req.params.enddate);
    }

    db.view('proposal/status_statistics', options, function(err, doc) {
        couch_response(err, doc, res);
    });
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
    var db = new(cradle.Connection)().database('app');
    var docid = 'org.couchdb.user:' + req.session.username;
    req.body.last_modified = Date.now();

    var new_contents = {};
    new_contents.author = req.session.username;

    if( typeof req.body.name != 'undefined' ) {
        new_contents.name = req.body.name;
    }
    if( typeof req.body.address != 'undefined' ) {
        new_contents.address = req.body.address;
    }
    
    db.merge(docid, new_contents, function(err, doc) {
        couch_response(err, doc, res); 
    });
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

function change_password(
        username,
        old_password,
        new_password,
        confirm_password,
        parent_callback) {

    var docid = 'org.couchdb.user:' + username;

    var user_db = new(cradle.Connection)().database('_users');
    
    async.waterfall([
        function( callback ) {
            /* If all password fields have been provided. */

            if( old_password && new_password && confirm_password ) {
                if( new_password == confirm_password ) {
                    return callback( null );
                } else {
                    return callback( {'error': 'password_mistyped'} );
                }
            } else if( old_password || new_password || confirm_password ) {
                /* If we get here, it means a user has filled out some,
                 * but not all password fields. */
                return callback( {'error': 'missing_password_fields'} );
            } else {
                /* Otherwise, they don't want to change their password.
                 * In that case, carry on processing the parent callback chain. 
                 */
                return parent_callback( null );
            }
        },
        function( callback ) {
            /* Retreive the user document. */

            user_db.get(docid, function(err, doc) {
                if( err ) {
                    callback( err );
                } else {
                    callback( null, doc );
                }
            });
        },
        function( doc, callback ) {
            /* If the old password and the password in the database match. */

            if( doc.password_sha == Hash.hex_sha1(old_password + doc.salt) ) {
                callback( null, doc ); 
            } else {
                callback( {error: 'old_password_incorrect'} );
            }
        },
        function( doc, callback ) {
            /* Save the new password. */

            var user_doc = {
                password_sha: Hash.hex_sha1(new_password + doc.salt)
            };

            user_db.merge(docid, user_doc, function(err, doc) {
                if( err ) {
                    callback( err );
                } else {
                    callback( null );
                }
            });
        }
    ],
    function( err ) {
        if( err ) {
            parent_callback( err );
        } else {
            parent_callback( null );
        }
    });
}

app.post('/user', function(req, res) {
    var con = new(cradle.Connection)();
    var db = con.database('app');
    var docid = 'org.couchdb.user:' + req.session.username;

    req.form.complete(function(err, fields, files) {
        if( err ) throw new ServerError( err );
 
        async.waterfall([
            function( callback ) {
                /* Change password if the user specifies. */
                change_password(
                    req.session.username,
                    fields.old_password,
                    fields.new_password,
                    fields.confirm_password,
                    callback
                );
            },
            function( callback ) {
                /* Merge the uploaded form fields with the user profile doc. */

                fields.last_modified = Date.now();

                db.merge(docid, fields, function(err, doc) {
                    if( err ) {
                        callback( err );
                    } else {
                        if( typeof files.image != 'undefined' ) {
                            callback( null, doc );
                        } else {
                            /* We terminate here, as no image was uploaded. */
                            res.redirect('#/user/edit');
                        }
                    }
                });
            },
            function( doc, callback ) {
                /* Get attachment details. */
                db.get(doc.id, function(err, doc) {
                    if( err ) {
                        callback( err );
                    } else {
                        callback( null, doc );
                    }
                });
            },
            function( doc, callback ) {
                /* Delete the previous attachment.
                 * There should only ever be one, as the previous
                 * attachment is always deleted here when a new
                 * one is uploaded.
                 */

                /* Extract filenames from attachments.
                 * There should only be one.
                 */
                var files = [];
                for( var file in doc._attachments ) {
                    files.push(file);
                }

                if( files.length > 0 ) {
                    var path = '/app/' + escape(doc._id) + '/' + files[0];

                    var options = {rev: doc._rev};

                    con.request('DELETE', path, options, function(err, doc) {
                        if( err ) {
                            callback( err );
                        } else {
                            /* Send the new new revision returned by CouchDB. */
                            callback( null, doc.rev );
                        }
                    });
                } else {
                    /* Send the existing revision, as the doc hasn't been updated. */
                    callback( null, doc._rev );
                }
            },
            function( rev, callback ) {
                /* Upload the image to the database. */

                var logo_filename = 'logo.' + files.image.name.split('.').pop();

                db.saveAttachment(docid,
                    rev,
                    logo_filename,
                    files.image.type,
                    fs.createReadStream(files.image.path),
                    function(err, doc) {
                        if( err ) {
                            callback( err );
                        } else {
                            /* Delete the file once we have finished uploading. */
                            fs.unlink(files.image.path);

                            callback( null );
                        }
                    }
                );
            }
        ],
        function(err) {
            /* Error handler. */
            if( err ) {
                res.send(err, 500);
            } else {
                /* Indicate success. */
                res.redirect('#/user/edit');
            }
        });
    });

    /* connect-form adds the req.form object.
     * We can (optionally) define onComplete, passing
     * the exception (if any) fields parsed, and files parsed.
     */
});

app.post('/pdf', function(req, res) {
    pdfcrowd.generate_pdf(
        req.body.pdfdata,
        req.body.ProposalName
    ).on('complete', function(data, response) {
        /* Actually send the data. Hack it so that the
         * headers and status code are what pdfcrowd
         * responded with.
         */
        res.send(data, response.headers, response.statusCode);
    }).on('error', function(data, response) {
        console.log('error generating pdf');
        res.send({error: 'pdf generation failed'}, 500);
    });
});

app.post('/pdf/email', function(req, res) {
    pdfcrowd.generate_pdf(
        req.body.pdfdata
    ).on('complete', function(data, response) {
        try {
            // Send an email with the pdf as an attachment.
            // var docid = 'org.couchdb.user:' + req.session.username;
            console.log(req.session.username);
            postmark.send({
                'From': req.session.username,
                'To': req.body.to,
                'Subject': 'Protosal - ' + req.body.subject,
                'HtmlBody': req.body.HtmlBody,
                'Attachments': [
                    {
                        'Name': req.body.ProposalName + '.pdf',
                        'ContentType': 'application/pdf',
                        'Content': data.toString('base64')
                    }
                ]
            });
        } catch(err) {
            console.log('Error sending email');
            return res.send({error: 'sending_email_failed'}, 500);
        }
        
        res.send({}, 200);
    }).on('error', function(data, response) {
        console.log('error generating pdf for email');
        res.send({error: 'pdf_generation_failed'}, 500);
    });
});

app.post('/data/bulk_docs', function(req, res) {
    var db = new(cradle.Connection)().database('app');

    db.get(req.body.keys, function(err, doc) {
        if( err ) {
            throw new ServerError( err );
        } else {
            /* Ensure all documents are owned by the
             * user who requested them.
             */
            doc.forEach(function(row) {
                if( row.author != req.session.username ) {
                    throw new AuthRequired;
                }
            });

            /* If they are, return the documents. */
            res.send(doc);
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
                rCommon.auth_error(res);
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
    console.log(err.stack);
    Exceptional.handle(err);
});
