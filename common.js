var Base64 = require('base64');
var Buffer = require('buffer').Buffer;

exports.base64_encode = function(enc_string) {
    return Base64.encode( new Buffer(enc_string) );
}
