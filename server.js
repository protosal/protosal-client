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
    var couchdb = http.createClient(80, 'ryth.cloudant.com', true);
    var request = couchdb.request(req.method, '/app/' + req.params.id + (req.params.rev ? "?rev=" + req.params.rev : ""), {
        'Host': 'ryth.cloudant.com',
        'Authorization': 'Basic ' + rCommon.base64_encode('ryth:abCD--12')
    });
    console.log(req.rawBody);
    request.write( req.rawBody );
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
    var couchdb = http.createClient(80, 'ryth.cloudant.com', true);
    var request = couchdb.request(req.method, '/app', {
        'Host': 'ryth.cloudant.com',
        'Authorization': 'Basic ' + rCommon.base64_encode('ryth:abCD--12'),
        'Content-Type': 'application/json'
    });
    console.log(req.rawBody);
    request.write( req.rawBody );
    request.end();
    request.on('response', function (response) {
        response.on('data', function (data) {
            res.header('Content-Type', 'application/json');
            
            res.send(data);
        });
    });
});
app.get('/list/:controller', function(req, res) {
    var cloudanturl = '/app/_design/' + req.params.controller + "/_view/list";
    //console.log(cloudanturl);
    var couchdb = http.createClient(80, 'ryth.cloudant.com', true);
    var request = couchdb.request(req.method, cloudanturl, {
        'Host': 'ryth.cloudant.com',
        'Authorization': 'Basic ' + rCommon.base64_encode('ryth:abCD--12')
        
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

    var couchdb = http.createClient(80, 'ryth.cloudant.com', true);
    var request = couchdb.request(req.method, '/app/' + req.params.id + (req.params.rev ? "?rev=" + req.params.rev : ""), {
        'Host': 'ryth.cloudant.com',
        'Authorization': 'Basic ' + rCommon.base64_encode('ryth:abCD--12')
    });

    request.end();
    request.on('response', function (response) {
        response.on('data', function (data) {
            res.header('Content-Type', 'application/json');
            
            res.send(data);
        });
    });
});

app.delete('/data/:id/:rev?', function(req, res) {

    var couchdb = http.createClient(80, 'ryth.cloudant.com', true);
    var request = couchdb.request(req.method, '/app/' + req.params.id + (req.params.rev ? "?rev=" + req.params.rev : ""), {
        'Host': 'ryth.cloudant.com',
        'Authorization': 'Basic ' + rCommon.base64_encode('ryth:abCD--12')
    });

    request.end();
    request.on('response', function (response) {
        response.on('data', function (data) {
            res.header('Content-Type', 'application/json');
            
            res.send(data);
        });
    });
});

app.listen(3000);
