'use strict';
//Adam Brattström
//Henrik Vendel

const express = require('express');
const jsDOM = require('jsdom');
const cookieParser = require('cookie-parser');
const globalObject = require('./servermodules/game-modul.js');
const fs = require('fs');
const bodyParser = require('body-parser');

const app = express();

// Använd det här istället
// Sätter rot-access från '/', så att man kommer åt filerna från webben
// och man kan skriva in ex. localhost:3000/html/index.html och nå sidan, 
// utan att man skickas dit.
app.use('/', express.static(__dirname +('/static')));

//använder coockieParser som middleware
app.use(cookieParser());

//använder bodyparser som middleware, låter post functionen automatiskt omvandla 
//json till strängar som kan hämtas 
app.use(bodyParser());


app.get('/', (req, res) => {
  console.log('hello there');
  res.sendFile(__dirname + '/static/html/loggaIn.html');
});


//skapar ett post-anrop 
//här ska valideringen av uppgifter ske när de hämtas in från formuläret
app.post('/', (req, res) => {
    console.log('inloggad');
    let name = req.body.nick_1;
    let color = req.body.color_1;
    console.log(name);
    console.log(color);
    res.sendFile(__dirname + '/static/html/index.html');
});




app.listen('3000', () => {
    console.log('Server startat på port 3000');
});

//Filen app.js är den enda ni skall och tillåts skriva kod i.