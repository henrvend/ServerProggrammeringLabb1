'use strict';
//Adam Brattström
//Henrik Vendel

const express = require('express');
const jsDOM = require('jsdom');
const cookieParser = require('cookie-parser');
const globalObject = require('./servermodules/game-modul.js');
const fs = require('fs');

const app = express();


app.use(express.static('static'));

app.get('/', (req, res) => {
  console.log('hello there');
  res.sendFile(__dirname + '/static/html/index.html');
});


app.listen('3000', () => {
    console.log('Server startat på port 3000');
});

//Filen app.js är den enda ni skall och tillåts skriva kod i.