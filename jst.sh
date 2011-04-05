rm public/media/templates/all.html
rm public/media/templates/all.js
find public/media/templates -name '*.html' '!' -name 'all.html' -exec cat '{}' >> public/media/templates/all.html ';'
find public/media/templates -name '*.js' '!' -name 'all.js' -exec cat '{}' >> public/media/templates/all.js ';'

docco public/media/templates/**/*.js
