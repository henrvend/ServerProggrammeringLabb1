'use strict';
//Adam Brattström
//Henrik Vendel
//Alex Håkman Skoglöf

const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const jsDOM = require('jsdom');
const cookieParser = require('cookie-parser');
const globalObject = require('./servermodules/game-modul.js');
const fs = require('fs');


// Sätter rot-access från '/', så att man kommer åt filerna från webben
// och man kan skriva in ex. localhost:3000/html/index.html och nå sidan, 
// utan att man skickas dit.
app.use('/public', express.static(__dirname + ('/static')));
app.use(express.urlencoded({ extended: true }));

//använder cookieParser som middleware.
app.use(cookieParser());
//Öppnar upp en server på port 3000 och skriver ett meddelande till konsolen.
let server = http.listen(3000, () => {
  console.log('Server startad på ', server.address().port);
});

/*Vid inladdning på sida så beroende på ifall det finns kakor hos klienten så hänvisas spelaren till logga in sidan eller startsidan 
för spelet*/
app.get('/', (req, res) => {
  if (req.cookies.name != undefined && req.cookies.color != undefined) {
    res.sendFile(__dirname + '/static/html/index.html');
  } else {
    res.sendFile(__dirname + '/static/html/loggaIn.html');
  }
});


// tar bort alla loggade cookies på sidan
app.get('/reset', (req, res) => {

  //kollar vilken spelare det är som vi rensa cookies, tar bort spelarens attribut  från globalObjekt
  if (req.cookies.name == globalObject.playerOneNick) {
    resetPlayer1();
  } else if (req.cookies.name == globalObject.playerTwoNick) {
    resetPlayer2();
  }

  //tar bort sparade cookies
  res.clearCookie('color');
  res.clearCookie('name');
  clearInterval(globalObject.timerId);
  res.redirect('/');
});


//skapar ett post-anrop 
//här ska valideringen av uppgifter ske när de hämtas in från formuläret
app.post('/', (req, res) => {

  //Hämtat namn och färg som sätts i formuläret
  let name = req.body.nick_1;
  let color = req.body.color_1;


  //Här startar kontrollen av data som kommer in
  try {
    if (name === undefined || name === '') {
      throw { element: name, message: 'Namn måste vara ifyllt' }
    }
    if (name.length < 3) {
      throw { element: name, message: 'Namn måste vara längre än 3 tecken' }
    }
    if (color.length != 7) {
      throw { element: color, message: 'Färg ska innehålla 7 tecken!' }
    }
    if (color === '#ffffff' || color === '#000000') {
      throw { element: color, message: 'Ogiltlig färg!' }
    }

    //Stämmer all info tilldelas den till spelare ett och är den redan tagen
    //sätts den till spelare två
    if (globalObject.playerOneNick == null && globalObject.playerOneColor == null) {
      globalObject.playerOneNick = name;
      globalObject.playerOneColor = color;
    } else if (globalObject.playerTwoNick == null && name != globalObject.playerOneNick) {
      if (globalObject.playerTwoColor == null && color != globalObject.playerOneColor) {
        globalObject.playerTwoNick = name;
        globalObject.playerTwoColor = color;
      } else {
        throw { message: 'Färg redan tagen!' }
      }

    } else if (globalObject.playerTwoNick == null && name == globalObject.playerOneNick) {
      throw { message: 'Namn redan taget!' }
    }
    //Kollar om det finns två spelare anslutna, kommer man förbi den här delen via tex postman görs en disconnect av socketanslutningen.
    //Vi är osäkra på huruvida man ska göra kollen eller om man ska låta formuläret passera om värdena är okej för att få en disconnect
    //och inte få någon feedback eller skickas vidare. Vill ni handledare se om disconnecten fungerar kan ni kommentera bort "else if:en" nedanför.
    else if (globalObject.playerOneNick != null && globalObject.playerTwoNick != null) {
      throw { message: 'Redan två spelare anslutna!' }
    }
    //kommentera bort hit vid test av socket.disconnect() vid fler än 2 spelare

  }
  catch (err) {
    fs.readFile(__dirname + '/static/html/loggain.html', (error, data) => {
      if (error) {
        res.send(error.message);

      } else {
        console.log(err.message);
        let serverDOM = new jsDOM.JSDOM(data);
        serverDOM.window.document.querySelector('#errorMsg').textContent = err.message;
        serverDOM.window.document.querySelector('#nick_1').setAttribute('value', name);
        serverDOM.window.document.querySelector('#color_1').setAttribute('value', color);

        data = serverDOM.serialize();
        res.send(data);
      }
    });
    return;
  }

  console.log('inloggad');

  //Om all information stämmer sätts kakorna till namn och färg, server only med httpOnly:true.
  res.cookie('color', color, { maxAge: 1000 * 60 * 120, httpOnly: true });
  res.cookie('name', name, { maxAge: 1000 * 60 * 120, httpOnly: true });

  res.redirect('/');
});


//function som sätter alla spelarvärden till null
function resetPlayers() {
  resetPlayer1();
  resetPlayer2();
}


function resetPlayer1() {
  globalObject.playerOneNick = null;
  globalObject.playerOneColor = null;
  globalObject.playerOneSocketId = null;
}

function resetPlayer2() {
  globalObject.playerTwoNick = null;
  globalObject.playerTwoColor = null;
  globalObject.playerTwoSocketId = null;
}





//------------------Här börjar socket.io-----------------------//
//-------------------------------------------------------------//


io.on('connection', (socket) => {

  let cookieString = socket.handshake.headers.cookie;
  let cookielist = globalObject.parseCookies(cookieString);


  if (cookielist.name == null || cookielist.color == null) {
    socket.disconnect("Kakorna saknas!");
  }

  if (cookielist.name != null) {
    socket.name = cookielist.name;
  }
  if (cookielist.color != null) {
    socket.color = cookielist.color;
  }

  if (globalObject.playerOneSocketId == null) {

    globalObject.playerOneSocketId = socket.id;
    globalObject.playerOneNick = socket.name;
    globalObject.playerOneColor = socket.color;

  } else if (globalObject.playerTwoSocketId == null) {

    globalObject.playerTwoSocketId = socket.id;
    globalObject.playerTwoNick = socket.name;
    globalObject.playerTwoColor = socket.color;

    globalObject.resetGameArea();


    //Skickar newgame till spelare ett, med motståndarens data och spelarens egen färg
    io.to(globalObject.playerOneSocketId).emit('newGame', {
      opponentNick: globalObject.playerTwoNick,
      opponentColor: globalObject.playerTwoColor,
      myColor: globalObject.playerOneColor
    });
    //Skickar newgame till spelare två, med motståndarens data och spelarens egen färg
    io.to(globalObject.playerTwoSocketId).emit('newGame', {
      opponentNick: globalObject.playerOneNick,
      opponentColor: globalObject.playerOneColor,
      myColor: globalObject.playerTwoColor
    });


    //Sätter spelare ett till currentPlayer och skickar yourMove
    globalObject.currentPlayer = globalObject.playerOneSocketId;
    socket.to(globalObject.currentPlayer).emit('yourMove');
    //startar timer direkt när 2 spelare har anslutit
    globalObject.timerId = setInterval(timeout, 5000);

  } else {
    
    socket.disconnect('Redan två spelare anslutna');
  }

  socket.on('newMove', (data) => {

    //fillCell ska sättas för att hålla koll på vad som ska fyllas i spelplanen
    let fillCell;




    //kollar vilken den aktuella spelaren är och byter spelare, sätter fillCell med korrekt värde för vad som 
    //ska sättas i gameArea:arrayen
    if (globalObject.currentPlayer == globalObject.playerOneSocketId) {

      globalObject.currentPlayer = globalObject.playerTwoSocketId;
      fillCell = 1;

    } else if (globalObject.currentPlayer == globalObject.playerTwoSocketId) {

      globalObject.currentPlayer = globalObject.playerOneSocketId;
      fillCell = 2;
    }

    //vid en ny newMove rensas intervall och börjar om på 5s.
    clearInterval(globalObject.timerId);
    globalObject.timerId = setInterval(timeout, 5000);


    socket.to(globalObject.currentPlayer).emit('yourMove', {
      cellId: data.cellId
    });

    //Sätter en 1:a eller 2:a beroende på vilken spelares tur det är
    globalObject.gameArea[data.cellId] = fillCell;

    let x = globalObject.checkForWinner();
    let vinnare;

    //Utifrån vad som returneras ifrån funktionen checkForWinner så tilldelas variabeln vinnare vinnarens nick.
    if (x == 1) {
      vinnare = 'Vinnare är ' + globalObject.playerOneNick + '!';
      winner(vinnare);
    }
    else if (x == 2) {
      vinnare = 'Vinnare är ' + globalObject.playerTwoNick + '!';
      winner(vinnare);
    }
    else if (x == 3) {
      vinnare = 'Det blev oavgjort!';
      winner(vinnare);
    }
  });
});

function winner(vinnare) {
  io.emit('gameover',
    vinnare
  );
  //stoppar timern vid spelets slut, rensar spelare från globalObject
  clearInterval(globalObject.timerId);
  resetPlayers();
}

// timeout-funktionen emittar 'timeout' till de nuvarande spelarna. Sedan sätts currentPlayer till motståndaren, för att sedan avslutas med att 'yourMove' emittas.
// Detta resulterar i att beroende på den tidsintervall som bestäms så kommer spelturen att gå över till motståndaren om tidsintervallen överskrids.
function timeout() {

  io.to(globalObject.currentPlayer).emit('timeout');

  if (globalObject.currentPlayer == globalObject.playerOneSocketId) {
    globalObject.currentPlayer = globalObject.playerTwoSocketId;
  } else if (globalObject.currentPlayer == globalObject.playerTwoSocketId) {
    globalObject.currentPlayer = globalObject.playerOneSocketId;
  }
  io.to(globalObject.currentPlayer).emit('yourMove');


};



/*app.listen('3000', () => {
  console.log('Server startat på port 3000');
});*/

//Filen app.js är den enda ni skall och tillåts skriva kod i.