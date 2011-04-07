# Replicate the database
curl -X POST -H 'Content-Type: application/json' http://ryth:abCD--12@127.0.0.1:5984/_replicate \
    -d '{"source": "http://ryth:abCD--12@ryth.cloudant.com/app", "target": "app"}'

# Start the server
NODE_ENV=production node server.js --type production
