rm public/media/templates/all.jst
find public -name '*.jst' '!' -name 'all.jst' -exec cat '{}' >> public/media/templates/all.jst ';'

node server.js
