var sys = require('sys');
var fs = require('fs');
var restler = require('restler');

exports.generate_pdf = function(username, api_key, src_data, res) {
    console.log("starting to generate pdf");

    console.log(username);
    console.log(api_key);
    console.log(src_data);

    restler.post('http://pdfcrowd.com/api/pdf/convert/html/', {
        multipart: true,
        data: {
            username: username,
            key: api_key,
            src: 'A'
        },
    }).on('complete', function(data, response) {
        console.log("we are complete, but do we have data?");
        //fs.writeFile('data.out', sys.inspect(data));

        /* Actually send the data. Hack it so that the
         * headers and status code are what pdfcrowd
         * responded with.
         */
        fs.writeFile('thisisapdf.pdf', data, 'binary');

        res.send(data, response.headers, response.statusCode);

    }).on('error', function(data, response) {
        console.log("ERROR FUCK");
        fs.writeFile('data.out', sys.inspect(data));
        fs.writeFile('response.out', sys.inspect(response));
    });
}
