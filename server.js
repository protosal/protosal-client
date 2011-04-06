// Require the orm and framework
var express = require('express');
var http = require('http');
var ryth = require('./node-server/ryth')
var connect = require('connect');
var _ = require('underscore');
var Exceptional = require('./node-server/exceptional').Exceptional;
var cradle = require('cradle');
var form = require('connect-form');
var async = require('async');
var fs = require('fs');
var sys = require('sys');
var pdfcrowd = require('./node-server/node-pdfcrowd');
var postmark = require('postmark')('473b864e-b165-473c-9435-68981a3bbeef');
var Hash = require('./node-server/sha1');

var app = express.createServer(
  // connect-form (http://github.com/visionmedia/connect-form)
  // middleware uses the formidable middleware to parse urlencoded
  // and multipart form data
  form({ keepExtensions: true })
);

cradle.setup(ryth.cradle_config);

app.configure(function() {
    app.use(express.responseTime());  
    app.use(express.bodyParser());

    // Enable static file serving
    app.use(express.static(__dirname + '/public'));

    app.use(express.errorHandler({ dumpExceptions: true }));
    app.use(connect.cookieParser());
    app.use(connect.session({ secret: 'foobar' }));

    // Our custom authentication check
    app.use(ryth.authCheck);
});

function AuthRequired(msg) {
    this.name = 'AuthRequired';
    Error.call(this, msg);
    Error.captureStackTrace(this, arguments.callee);
}

AuthRequired.prototype.__proto__ = Error.prototype;

function ServerError(msg) {
    this.name = 'ServerError';
    if( typeof msg == 'object' ) {
        // Stringify couchdb error objects.
        this.message = 'Error: ' + msg.error + '. Reason: ' + msg.reason;
    }
    Error.call(this, msg);
    Error.captureStackTrace(this, arguments.callee);
}

ServerError.prototype.__proto__ = Error.prototype;

// Should exceptions thrown from within the application.
// May have to re-think the exception handling paradigm.
app.error(function(err, req, res, next){
    if(err instanceof AuthRequired) {
        ryth.auth_error(res);
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
        res.send( doc, 200 );
    }
}

// Get a property from a couchdb document.
// This function is only designed for getting
// the id or rev of a document.
//
// We want to search in this order:
//
// * `doc.id`
// * `doc._id`
// * `doc.value._id`
function get_doc_property(doc, prop_name) {
    
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
    var docid = get_doc_property(doc, 'id');
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
        var revid = get_doc_property(doc, 'rev');

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

function async_error( err, res ) {
    if( err ) {
        console.log( err );
        console.log( new Error().stack );

        res.send( err, 500 );
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

// Check auth details, returning the associated document.
function get_doc(docid, username, callback) {

    var db = new(cradle.Connection)().database('app');
    
    db.get(docid, function(err, doc) {
        if( err ) return callback( err );

        if( doc.author == username ) {
            return callback( null, doc );
        } else {
            return callback( {error: 'unauthorized' } );
        }
    });
}

function new_doc_instance(doc, callback) {
    var db = new(cradle.Connection)().database('app');

    // Indicate the new document is an instance.
    doc.template = false;
    // Record the template this document was generated from.
    doc.template_id = doc._id;

    // Delete _id and _rev so we create a new record.
    delete doc._id;
    delete doc._rev;

    // Set the new created and modified times.
    doc.created_at = Date.now();
    doc.last_modified = Date.now();

    console.log('new doc');
    console.log(doc);

    db.save(doc, function(err, doc) {
        if( err ) {
            return callback( err );
        } else {
            return callback( null, doc );
        }
    });
}

function clone_docs_series(doc_arr, callback) {
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
    if( doc_ids.length < 1 ) {
        return callback( null, [] );
    }

    var db = new(cradle.Connection)().database('app');

    db.get( doc_ids, function(err, docs) {
        if( err ) {
            return callback( err );
        } else {
            return callback( null, docs );
        }
    });
}

// Create and return the new section instance document with
// all associated fees instantiated.
function new_section_instance( section_id, username, cb ) {
    var template_section_doc = {};
    var instance_section_id = '';

    async.waterfall([
        function( callback ) {
            get_doc(
                section_id,
                username,
                callback
            );
        },
        function( section_doc, callback ) {
            template_section_doc = section_doc;
            
            new_doc_instance( section_doc, callback );
        },
        function( section_instance_doc, callback ) {
            instance_section_id = section_instance_doc.id;

            get_docs( template_section_doc.feelist, callback );
        },
        function( template_fee_docs, callback ) {
            console.log('template_fee_docs');
            console.log(template_fee_docs);

            var template_fee_docs = template_fee_docs.map(function( doc ) {
                return doc;
            });

            console.log('template_fee_docs');
            console.log(template_fee_docs);

            clone_docs_series( template_fee_docs, callback ); 
        },
        function( instance_fee_docs, callback ) {
            new_fee_list( instance_section_id, instance_fee_docs, callback );
        },
        function( doc, callback ) {
            get_doc( instance_section_id, username, callback );
        },
        function( doc, callback ) {
            cb( null, doc );
            callback( null );
        }
    ],
    function( err ) {
        if( err ) return cb( err );
    });
}

// Create a new instance of the supplied section, attaching it to the
// supplied proposal.
// 
// **Returns:** Section instance document, HTTP 200
//
// **Error:** error object, HTTP 500
app.get('/data/newinstance/:section_id', function(req, res) {
    async.waterfall([
        function( callback ) {
            new_section_instance(
                req.params.section_id,
                req.session.username,
                callback 
            );
        },
        function( doc, callback ) {
            res.send( doc, 200 );
            return callback( null );
        },
    ],
    function( err ) {
        async_error( err, res );
    }); 
});

// Get the document with the specified id.
//
// **Returns:** document, HTTP 200
//
// **Error:** error object, HTTP 500
app.get('/data/:id', function(req, res) {
    async.waterfall([
        function( callback ) {
            get_doc( req.params.id, req.session.username, callback );
        },
        function( doc, callback ) {
            res.send( doc, 200 );
            return callback( null );
        }
    ],
    function( err ) {
        async_error( err, res );
    });
});

// Assumes that related documents are stored in a property
// called `[doc_type]list`, e.g. `feelist` or `sectionlist`.
//
// We should assume that this list is an array.
function get_related_doc_ids(parent_id, doc_type, callback) {
    var db = new(cradle.Connection)().database('app');

    db.get(parent_id, function(err, doc) {
        if( err ) {
            return callback( err );
        } else {
            var doc_list = doc[doc_type + 'list'];
            return callback( null, doc_list );
        }
    });
}

// Return the documents corresponding to the document ids in
// `doc_ids` from the `view`.
function get_docs_from_view( view, doc_ids, callback ) {
    if( doc_ids.length == 0 ) return callback( null, [] );

    var db = new(cradle.Connection)().database('app');

    // Return all corresponding child documents.
    db.view(view + '/list_by_id', {'keys': doc_ids}, function(err, docs) {
        if( err ) {
            return callback( err );
        } else {
            return callback( null, docs );
        }
    });
}

// This route returns all child documents in a relationship.
//
// **Example:** `/related2/section_fee/GUID`
//
// **Returns:** array of child documents, HTTP 200
//
// **Error:** error object, HTTP 500
app.get('/related2/:view/:id', function( req, res ){
    var db = new(cradle.Connection)().database('app');

    var child = req.params.view.split('_')[1];

    async.waterfall([
        function( callback ) {
            get_related_doc_ids( req.params.id, child, callback );
        },
        function( doc_ids, callback ) {
            get_docs_from_view( child, doc_ids, callback );
        },
        function( docs, callback ) {
            res.send( docs, 200 );
        }
    ],
    function( err ) {
        async_error( err, res );
    });
});

function send_attachment( doc_id, attachment_name, res ) {
    // Proxy the response from couchdb to the res object.
    db.getAttachment(doc_id, attachment_name).on('response', function(response) {
        response.on('data', function(chunk) {
            res.write(chunk, 'binary');
        }); 

        response.on('end', function() {
            res.end();
        });
    });
}

// Return the user's logo document.
//
// **Returns:** Some type of image called `logo.[ext]`, HTTP 200
//
// **Error:** error object, HTTP 404
app.get('/logo/:user_id', function(req, res) {
    var db = new(cradle.Connection)().database('app');
    var docid = ryth.username_docid( req.params.user_id );

    db.get(docid, function(err, doc) {
        if (err) return res.send(err, 404);

        // Loop through all attachment documents.
        for( var name in doc._attachments ) {
            // Stopping at the first document containing 'logo'.
            // This works because every time a new logo is updated,
            // all other attachements on the user profile document
            // are deleted.
            if( name.indexOf('logo') != -1 ) {
                console.log(doc._id);
                console.log(name);
                
                return send_attachment( doc._id, name, res );
            }
        }

        // If we didn't find a logo, return a default logo.
        res.sendfile('public/media/images/default_logo.png');
    });
});

// Get the user profile document for the currently logged in user.
//
// **Returns:** User profile document, HTTP 200
//
// **Error:** error document, HTTP 500
app.get('/user', function(req, res) {
    var db = new(cradle.Connection)().database('app');
    var docid = ryth.username_docid( req.session.username );

    db.get(docid, function(err, doc) {
        couch_response(err, doc, res); 
    });
});

// Activate the user's account.
//
// **Returns:** _Nothing_, user is redirected to login page for
// client side handling.
//
// **Error:** error object, HTTP 500
app.get('/register/:activation_key', function(req, res) {
    var db = new(cradle.Connection)().database('app');
    var key = { key: req.params.activation_key };

    db.view('user/register', key, function(err, doc_arr) {
        // If a document is returned, the activation link was valid.
        if( doc_arr.length == 1 ) {
            db.merge(encodeURIComponent( doc_arr[0].id ), {activated: true}, function(err, doc) {
                if( err ) {
                    throw new ServerError( err );
                } else {
                    var user_login = doc_arr[0].id.replace('org.couchdb.user:', '');
                    res.redirect('#/dashboard/login/' + user_login);
                }
            });
        }
    });
});

// Get the sum of proposals grouped by proposal status.
//
// **Returns:** array of proposal status counts, HTTP 200
//
// **Error:** error object, HTTP 500
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

// Return the details of proposals, with the follow _optional_ parameters:
//
// * `limit`: Number of proposals to return. Specify `all` to get everything.
// * `status`: Filter by status, e.g. `accepted`
// * `startdate`: Epoch value for the start of the date range
// * `enddate`: Epoch value for the end of the date range
//
// _NB: Parameters cannot be specified out of order._
//
// **Returns:** Array of proposal documents, HTTP 200
//
// **Error:** error object, HTTP 500
app.get('/proposal/:limit?/:status?/:startdate?/:enddate?', function(req, res) {
    var db = new(cradle.Connection)().database('app');
    var options = {
        startkey: [req.session.username],
        endkey: [req.session.username, {}],
    };

    // If a limit is present and not set to all, add it to the key.
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

// Proxy requests from the client to the appropriate design doc
// and view, filtered for the current user.
//
// e.g. `/list_by_author/user`
//
// **Returns:** array of documents, HTTP 200
//
// **Error:** error object, HTTP 500
app.get('/:list_type/:view', function(req, res) {
    var db = new(cradle.Connection)().database('app');

    db.view(req.params.view + '/' + req.params.list_type,
        { key: req.session.username },
        function(err, doc) {
            couch_response(err, doc, res);
        }
    );
});

// Merge the document with the specified id with the
// supplied fields.
//
// **Returns:** _id and _rev of updated doc, HTTP 200
//
// **Error:** error object, HTTP 500
app.put('/data/:id', function(req, res) {
    var db = new(cradle.Connection)().database('app');

    db.get(req.params.id, function(err, doc) {
        if( err ) {
            throw new ServerError( err );
        } else if( doc.author == req.session.username ) {
            // Only save if the author of the document is
            // trying to update it.

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

// Change a user's password.
function change_password(
        username,
        old_password,
        new_password,
        confirm_password,
        parent_callback) {

    var docid = ryth.username_docid( username );

    var user_db = new(cradle.Connection)().database('_users');
    
    async.waterfall([
        function( callback ) {
            // If all password fields have been provided.

            if( old_password && new_password && confirm_password ) {
                if( new_password == confirm_password ) {
                    return callback( null );
                } else {
                    return callback( {'error': 'password_mistyped'} );
                }
            } else if( old_password || new_password || confirm_password ) {
                // If we get here, it means a user has filled out some,
                // but not all password fields.
                return callback( {'error': 'missing_password_fields'} );
            } else {
                // Otherwise, they don't want to change their password.
                // In that case, carry on processing the parent callback chain. 
                return parent_callback( null );
            }
        },
        function( callback ) {
            // Retreive the user document.

            user_db.get(docid, function(err, doc) {
                if( err ) {
                    return callback( err );
                } else {
                    return callback( null, doc );
                }
            });
        },
        function( doc, callback ) {
            // If the old password and the password in the database match.

            if( doc.password_sha == Hash.hex_sha1(old_password + doc.salt) ) {
                return callback( null, doc ); 
            } else {
                return callback( {error: 'old_password_incorrect'} );
            }
        },
        function( doc, callback ) {
            // Save the new password.

            var user_doc = {
                password_sha: Hash.hex_sha1(new_password + doc.salt)
            };

            user_db.merge(docid, user_doc, function(err, doc) {
                if( err ) {
                    return callback( err );
                } else {
                    return callback( null );
                }
            });
        }
    ],
    function( err ) {
        if( err ) {
            return parent_callback( err );
        } else {
            return parent_callback( null );
        }
    });
}

// This route handles the user settings form.
// As part of the request object, it expects:
//
// * `old_password`
// * `new_password`
// * `conform_password`
// * _image_ as an attachment
//
// **Returns:** _Nothing_, user is redirected to login page for
// client side handling.
//
// **Error:** error object, HTTP 500
app.post('/user', function(req, res) {
    var con = new(cradle.Connection)();
    var db = con.database('app');
    var docid = ryth.username_docid( req.session.username );

    req.form.complete(function(err, fields, files) {
        if( err ) throw new ServerError( err );
 
        async.waterfall([
            function( callback ) {
                // Change password if the user specifies.
                change_password(
                    req.session.username,
                    fields.old_password,
                    fields.new_password,
                    fields.confirm_password,
                    callback
                );
            },
            function( callback ) {
                // Merge the uploaded form fields with the user profile doc.

                fields.last_modified = Date.now();

                db.merge(docid, fields, function(err, doc) {
                    if( err ) {
                        return callback( err );
                    } else {
                        if( typeof files.image != 'undefined' ) {
                            return callback( null, doc );
                        } else {
                            // We terminate here, as no image was uploaded.
                            res.redirect('#/user/edit');
                        }
                    }
                });
            },
            function( doc, callback ) {
                // Get attachment details.
                db.get(doc.id, function(err, doc) {
                    if( err ) {
                        return callback( err );
                    } else {
                        return callback( null, doc );
                    }
                });
            },
            function( doc, callback ) {
                // Delete the previous attachment.
                // There should only ever be one, as the previous
                // attachment is always deleted here when a new
                // one is uploaded.

                // Extract filenames from attachments.
                // There should only be one.
                var files = [];
                for( var file in doc._attachments ) {
                    files.push(file);
                }

                if( files.length > 0 ) {
                    var path = '/app/' + escape(doc._id) + '/' + files[0];

                    var options = {rev: doc._rev};

                    con.request('DELETE', path, options, function(err, doc) {
                        if( err ) {
                            return callback( err );
                        } else {
                            // Send the new new revision returned by CouchDB.
                            return callback( null, doc.rev );
                        }
                    });
                } else {
                    // Send the existing revision, as the doc hasn't been updated.
                    return callback( null, doc._rev );
                }
            },
            function( rev, callback ) {
                // Upload the image to the database.

                var logo_filename = 'logo.' + files.image.name.split('.').pop();

                db.saveAttachment(docid,
                    rev,
                    logo_filename,
                    files.image.type,
                    fs.createReadStream(files.image.path),
                    function(err, doc) {
                        if( err ) {
                            return callback( err );
                        } else {
                            // Delete the file once we have finished uploading.
                            fs.unlink(files.image.path);

                            return callback( null );
                        }
                    }
                );
            }
        ],
        function(err) {
            if( err ) {
                res.send(err, 500);
            } else {
                // TODO: Implement AJAX submission on the client so
                // this isn't so clunky.
                res.redirect('#/user/edit');
            }
        });
    });
});

// Generate a pdf and return it to the client.
//
// **Expects:**
//
// * pdfdata: HTML to generate pdf from
// * ProposalName: name of the proposal (with the .pdf extension)
//
// _NB: names are case sensitive._
// 
// **Returns:** Pdf document, HTTP 200
//
// **Error:** error object, HTTP 500
app.post('/pdf', function(req, res) {
    pdfcrowd.generate_pdf(
        req.body.pdfdata,
        req.body.ProposalName
    ).on('complete', function(data, response) {
        // Actually send the data. Hack it so that the
        // headers and status code are what pdfcrowd
        // responded with.
        res.send(data, response.headers, response.statusCode);
    }).on('error', function(data, response) {
        console.log('error generating pdf');
        res.send({error: 'pdf generation failed'}, 500);
    });
});

// Email a pdf to the client.
//
// **Expects:**
//
// * `pdfdata`: HTML to generate pdf from
// * `to`: Email address to send the email to
// * `subject`: Email subject
// * `HtmlBody`: HTML body of the email
// * `ProposalName`: Name of the attached pdf
//
// _NB: names are case sensitive._
// 
// **Returns:** {}, HTTP 200
//
// **Error:** error object, HTTP 500
app.post('/pdf/email', function(req, res) {
    pdfcrowd.generate_pdf(
        req.body.pdfdata
    ).on('complete', function(data, response) {
        try {
            // Send an email with the pdf as an attachment.
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
        
        // Indicate success.
        res.send({}, 200);

    }).on('error', function(data, response) {
        console.log('error generating pdf for email');
        res.send({error: 'pdf_generation_failed'}, 500);
    });
});

// Get 1 or more documents at once.
//
// **Expects:**
//
// * `keys`: Array of document ids
//
// **Returns:** Array of documents, HTTP 200
//
// **Error:** error object, HTTP 500
app.post('/data/bulk_docs', function(req, res) {
    var db = new(cradle.Connection)().database('app');

    db.get(req.body.keys, function(err, docs) {
        if( err ) {
            throw new ServerError( err );
        } else {
            // Ensure all documents are owned by the
            // user who requested them.
            docs.forEach(function(row) {
                if( row.author != req.session.username ) {
                    throw new AuthRequired;
                }
            });

            // If they are, return the documents.
            return res.send( docs, 200 );
        }
    });
});

// Store the supplied JSON object in CouchDB.
//
// **Expects:**
// JSON object to be used as the new document
//
// **Returns:** _id and _rev of the newly created document, HTTP 200
//
// **Error:** error object, HTTP 500
app.post('/data', function(req, res) {
    var db = new(cradle.Connection)().database('app');

    // Set the author.
    req.body.author = req.session.username;
    req.body.created_at = Date.now();
    req.body.last_modified = Date.now();

    db.save(req.body,
        function(err, doc) {
            couch_response(err, doc, res);
        }
    );
});

// Delete the specified document. A document revision must be provided.
//
// **Returns:** Details of the deleted document, HTTP 200
//
// **Error:** error object, HTTP 500
app.delete('/data/:id/:rev', function(req, res) {
    var db = new(cradle.Connection)().database('app');
    db.get(req.params.id, function(err, doc) {
        if( err ) {
            throw new ServerError( err );
        } else {
            if( doc.author == req.session.username ) {
                couch_remove(db, doc, res);
            } else {
                ryth.auth_error(res);
            }
        }
    });
});

// Start the server on port 3000.
app.listen(3000);

// Ensure we don't crash by catching all uncaught exceptions.
process.on('uncaughtException', function (err) {
    console.log(err);
    console.log(err.stack);
    Exceptional.handle(err);
});
