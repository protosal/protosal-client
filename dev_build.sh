./mash.sh

docco public/media/templates/**/*.js public/index.js
cd public
ln -s ../docs docs
