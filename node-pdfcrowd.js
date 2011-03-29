var restler = require('./restler/restler');

var username = 'ryankirkman';
var api_key = 'a4e60e5dc9b00d298fd5f57a6b9c1c3e';

exports.generate_pdf = function(src_data) {
    return restler.post('http://pdfcrowd.com/api/pdf/convert/html/', {
        binary: true,
        data: {
            username: username,
            key: api_key,
            src: src_data
        },
    });
}
