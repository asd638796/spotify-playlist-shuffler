an app that *actually* shuffles a spotify playlist that you give it, adding the songs to your current queue.

demo: https://youtu.be/J2x7G3bfd7A

if you want to use this app yourself, you will need to do the following things:

-clone the repo
-create a .env file in the root directory.
  -in this .env file you need to add the following things:
  PORT
  SPOTIFY_CLIENT_ID
  SPOTIFY_CLIENT_SECRET
  SPOTIFY_REDIRECT_URI
  PSQL_PASSWORD
  DB_HOST
  -in order to get the spotify variables, go to here: https://developer.spotify.com/dashboard and create an app
  -set the redirect uri to: http://localhost:3001/api/callback

-next you need to create the psql database, you can do this by running these commands in the root directory:
  -psql -U postgres -c "CREATE DATABASE spotify_shuffler;"
  -psql -U postgres -d spotify_shuffler -f schema.sql

-finally, run the dockerfile using docker-compose up --build

