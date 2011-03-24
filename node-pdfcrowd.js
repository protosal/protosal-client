var sys = require('sys');
var fs = require('fs');
var restler = require('./restler/restler');

exports.generate_pdf = function(username, api_key, src_data, res) {
    restler.post('http://pdfcrowd.com/api/pdf/convert/html/', {
        binary: true,
        data: {
            username: username,
            key: api_key,
            src: src_data
        },
    }).on('complete', function(data, response) {
        /* Actually send the data. Hack it so that the
         * headers and status code are what pdfcrowd
         * responded with.
         */
        res.send(data, response.headers, response.statusCode);
    }).on('error', function(data, response) {
        console.log("ERROR");
        fs.writeFile('data.out', sys.inspect(data));
        fs.writeFile('response.out', sys.inspect(response));
    });
}
