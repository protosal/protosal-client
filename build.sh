#BLAH MY NIGGER
rm _attachments/media/templates/all.jst
find . -name '*.jst' '!' -name 'all.jst' -exec cat '{}' >> _attachments/media/templates/all.jst ';'
couchapp push http://ryth:abCD--12@ryth.cloudant.com/app
