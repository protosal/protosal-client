rm public/media/templates/all.jst
rm public/media/templates/all.js
find public/media/templates -name '*.jst' '!' -name 'all.jst' -exec cat '{}' >> public/media/templates/all.jst ';'
find public/media/templates -name '*.js' '!' -name 'all.js' -exec cat '{}' >> public/media/templates/all.js ';'

docco public/media/templates/**/*.js
