var Base64 = require('base64');
var Buffer = require('buffer').Buffer;
var urlpaser = require('url');
var http = require('http');

exports.base64_encode = function(enc_string) {
    return Base64.encode( new Buffer(enc_string) );
}

exports.authCheck = function (req, res, next) {
    url = req.urlp = urlpaser.parse(req.url, true);

    // ####
    // Logout
    if ( url.pathname == "/logout" ) {
      req.session.destroy();
      res.redirect("/");
    }

    // ####
    // Is User already validated?
    if (req.session && req.session.auth == true) {
      next(); // stop here and pass to the next onion ring of connect
      return;
    }
    
    // ########
    // Auth - Replace this simple if with you Database or File or Whatever...
    // If Database, you need a Async callback...
    if ( url.pathname == "/user/login" ) {
        var couchdb = http.createClient(80, 'ryth.cloudant.com', true);
        var request = couchdb.request("GET", '/_users', {
            'Host': 'ryth.cloudant.com',
            'Content-Type': 'application/json',
            'Authorization': 'Basic ' + exports.base64_encode(req.body.username + ":"+ req.body.password)
        });

        request.end();
        request.on('response', function (response) {
            response.setEncoding('utf8');
            response.on('data', function (data) {
                res.header('Content-Type', 'application/json');
                data = JSON.parse(data);
                if( typeof data.error == "undefined" ) {
                    req.session.auth = true;
                    req.session.username = req.body.username
                    redirect = {
                        redirect: "home/dashboard"
                    }
                    res.end( JSON.stringify( redirect ) );
                  return;
                } 
                
                res.writeHead(401);
                console.log("Wrong password or some shit");
                redirect = {
                    redirect: "user/login"
                }
                res.end( JSON.stringify( redirect ) );
                return;
            });

        });
    } else {
        res.writeHead(401);
        console.log("Default error, not validted redirect this fool to user/login");
        redirect = {
            redirect: "user/login"
        }
        res.end( JSON.stringify( redirect ) );
        return;   
     }   
    
    
    /*
    if ( url.pathname == "/user/login" && 
         req.body.username == "max" && 
         req.body.password == "herewego"  ) {
      req.session.auth = true;
        redirect = {
            redirect: "home/dashboard"
        }
        res.end( JSON.stringify( redirect ) );
      return;
    }

    // ####
    // User is not unauthorized. Stop talking to him.
    res.writeHead(401);
    redirect = {
        redirect: "user/login"
    }
    res.end( JSON.stringify( redirect ) );
    return;
    * */
}
