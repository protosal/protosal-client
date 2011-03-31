var restler = require('./restler/restler');

var username = 'ryankirkman';
var api_key = 'a4e60e5dc9b00d298fd5f57a6b9c1c3e';

exports.generate_pdf = function(src_data, pdf_name) {
    pdf_name = pdf_name || 'proposal';

    return restler.post('http://pdfcrowd.com/api/pdf/convert/html/', {
        binary: true,
        data: {
            username: username,
            pdf_name: pdf_name,
            key: api_key,
            src: src_data
        },
    });
}
