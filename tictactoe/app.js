'use strict';
//Adam Brattström
//Henrik Vendel

const express = require('express');
const jsDOM = require('jsdom');
const cookieParser = require('cookie-parser');
const globalObject = require('./servermodules/game-modul.js');
const fs = require('fs');

const app = express();

// Använd det här istället
// Sätter rot-access från '/', så att man kommer åt filerna från webben
// och man kan skriva in ex. localhost:3000/html/index.html och nå sidan, 
// utan att man skickas dit.
app.use('/public', express.static(__dirname + ('/static')));
app.use(express.urlencoded({ extended: true }));

//använder coockieParser som middleware
//app.use(cookieParser());


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
  try {
    if (name === undefined || name === '') {
       throw{element:name,message:'Namn måste vara ifyllt'}
    }
    if (name.length < 3) {
      throw {element:name,message:'Namn måste vara längre än 3 tecken'}
    }
    if(color.length!=7){
      throw {element:color, message:'Färg ska innehålla 7 tecken!'}
    }
    if(color==='#ffffff' || color==='#000000'){
      throw{element:color, message:'Ogiltlig färg!'}
    }

  } catch (err) {
    fs.readFile(__dirname + '/static/html/loggain.html', (error, data) => {
      if (error) {
        res.send(error.message);

      } else {
        console.log(err.message);
        let serverDOM = new jsDOM.JSDOM(data);
        serverDOM.window.document.querySelector('#errorMsg').textContent=err.message;
        data = serverDOM.serialize();

        res.send(data);
      }
    });
    return;
  }

  console.log(name);
  console.log(color);
  res.sendFile(__dirname + '/static/html/index.html');
});




app.listen('3000', () => {
  console.log('Server startat på port 3000');
});

//Filen app.js är den enda ni skall och tillåts skriva kod i.