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
  app.use(express.logger());
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

app.put('/data/:id/:rev?', function(req, res) {
fs.writeFile('./tom.loga', sys.inspect(req) );
    var couchdb = http.createClient(5984, 'localhost', true);
    var request = couchdb.request(req.method, '/app/' + req.params.id + (req.params.rev ? "?rev=" + req.params.rev : ""), {
        'Host': 'localhost',
        'Authorization': 'Basic ' + rCommon.base64_encode(rCommon.credentials)
    });
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
});
app.post('/data', function(req, res) {
    console.log("add new shit nigger");
fs.writeFile('./tom.loga', sys.inspect(req) );
    var couchdb = http.createClient(5984, 'localhost', true);
    var request = couchdb.request(req.method, '/app', {
        'Host': 'localhost',
        'Authorization': 'Basic ' + rCommon.base64_encode(rCommon.credentials),
        'Content-Type': 'application/json'
    });
    req.body.author = req.session.username;
    
    console.log( JSON.stringify(req.body) );
    request.write( JSON.stringify(req.body) );
    request.end();
    request.on('response', function (response) {
        response.on('data', function (data) {
            res.header('Content-Type', 'application/json');
            
            res.send(data);
        });
    });
});

app.get('/list/:controller', function(req, res) {
    console.log(req.session.username);
    var cloudanturl = '/app/_design/' + req.params.controller + "/_view/list?key=\"" + req.session.username + "\"";
    console.log(cloudanturl);
    var couchdb = http.createClient(5984, 'localhost', true);
    var request = couchdb.request(req.method, cloudanturl, {
        'Host': 'localhost',
        'Authorization': 'Basic ' + rCommon.base64_encode(rCommon.credentials)
        
    });

    request.end();
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
});
app.get('/data/:id/:rev?', function(req, res) {

    var couchdb = http.createClient(5984, 'localhost', true);
    var request = couchdb.request(req.method, '/app/' + req.params.id + (req.params.rev ? "?rev=" + req.params.rev : ""), {
        'Host': 'localhost',
        'Authorization': 'Basic ' + rCommon.base64_encode(rCommon.credentials)
    });

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

    var couchdb = http.createClient(5984, 'localhost', true);
    var request = couchdb.request(req.method, '/app/' + req.params.id + (req.params.rev ? "?rev=" + req.params.rev : ""), {
        'Host': 'localhost',
        'Authorization': 'Basic ' + rCommon.base64_encode('ryth:123')
    });
    req.body.author = req.session.username
    console.log( JSON.stringify(req.body) );    
    request.write( JSON.stringify(req.body) );    
    request.end();
    request.on('response', function (response) {
        response.on('data', function (data) {
            res.header('Content-Type', 'application/json');
            
            res.send(data);
        });
    });
});

app.listen(3000);
