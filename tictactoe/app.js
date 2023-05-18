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

//använder cookieParser som middleware, sätter signed
app.use(cookieParser());

let server = http.listen(3000, () => {
  console.log('Server startad på ', server.address().port);
});


app.get('/', (req, res) => {
  if (req.cookies.name != undefined && req.cookies.color != undefined) {
    res.sendFile(__dirname + '/static/html/index.html');
  } else {
    res.sendFile(__dirname + '/static/html/loggaIn.html');
  }
});


// tar bort alla loggade cookies på sidan
app.get('/reset', (req, res) => {
  console.log(req.cookies.name);

  //kollar vilken spelare det är som vi rensa cookies, tar bort spelarens attribut  från globalObjekt
  if (req.cookies.name == globalObject.playerOneNick) {
    resetPlayer1();
  } else if (req.cookies.name == globalObject.playerTwoNick) {
    resetPlayer2();
  }

  //tar bort alla sparade cookies
  Object.keys(req.cookies).forEach(cookieName => {
    res.clearCookie(cookieName);
  });
  clearInterval(globalObject.timerId);
  res.redirect('/');
});


// tar bort cookies med namnen color och name
/*app.get('/reset', (req, res) => {
  res.clearCookie('color');
  res.clearCookie('name');
  res.redirect('/');
  //Kan man på något sätt rensa alla kakor med en rad kod?
});*/


//skapar ett post-anrop 
//här ska valideringen av uppgifter ske när de hämtas in från formuläret
app.post('/', (req, res) => {


  let name = req.body.nick_1;
  let color = req.body.color_1;

  //Osäkra på hur vi ska lägga till och kolla namn innan de sätts
  // från clientsidan, gör så här och ändrar efter att labb2 startar.
  if (globalObject.playerOneNick == null) {
    globalObject.playerOneNick = name;
  } else {
    globalObject.playerTwoNick = name;
  }

  if (globalObject.playerOneColor == null) {
    globalObject.playerOneColor = color;
  } else {
    globalObject.playerTwoColor = color;
  }

  //Här startar kollen av data som kommer in
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
    if (globalObject.playerTwoNick == globalObject.playerOneNick) {
      throw { message: 'Nickname redan taget!' }
    }
    if (globalObject.playerTwoColor == globalObject.playerOneColor) {
      throw { message: 'Färg redan taget!' }
    }


    console.log('inloggad');
    /* Invänta feedback gällande ifall vi ska rensa kakor innan nya värden tilldelas befintliga kakor. 
    Oroligheterna ligger väl egentligen i att vi rensar även fast det inte exister några kakor.
    res.clearCookie.color;
    res.clearCookie.name;*/
    res.cookie('color', color, { maxAge: 1000 * 60 * 120 });
    res.cookie('name', name, { maxAge: 1000 * 60 * 120 });

  } catch (err) {
    fs.readFile(__dirname + '/static/html/loggain.html', (error, data) => {
      if (error) {
        res.send(error.message);

      } else {
        console.log(err.message);
        let serverDOM = new jsDOM.JSDOM(data);
        serverDOM.window.document.querySelector('#errorMsg').textContent = err.message;
        data = serverDOM.serialize();

        res.send(data);
      }
    });
    return;
  }
  res.redirect('/');
});


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

    io.to(globalObject.playerOneSocketId).emit('newGame', {
      opponentNick: globalObject.playerTwoNick,
      opponentColor: globalObject.playerTwoColor,
      myColor: globalObject.playerOneColor
    });

    io.to(globalObject.playerTwoSocketId).emit('newGame', {
      opponentNick: globalObject.playerOneNick,
      opponentColor: globalObject.playerOneColor,
      myColor: globalObject.playerTwoColor
    });


    //setting current player to player one and give the player yourMove
    globalObject.currentPlayer = globalObject.playerOneSocketId;
    socket.to(globalObject.currentPlayer).emit('yourMove');
    globalObject.timerId = setInterval(timeout, 5000);

  } else {
    console.log('Redan två spelare anslutna!');
    socket.disconnect();
  }

  socket.on('newMove', (data) => {

    //fillCell ska sättas för att hålla koll på vad som ska fyllas i spelplanen
    let fillCell;

    if (cookieString == null) {
      console.log("Kakorna saknas!");
      socket.disconnect();
    }


    //kollar vilken den aktuella spelaren är och byter spelare, sätter fillCell med korrekt värde för vad som 
    //ska sättas i gameArea:arrayen
    if (globalObject.currentPlayer == globalObject.playerOneSocketId) {

      globalObject.currentPlayer = globalObject.playerTwoSocketId;
      fillCell = 1;

    } else if (globalObject.currentPlayer == globalObject.playerTwoSocketId) {

      globalObject.currentPlayer = globalObject.playerOneSocketId;
      fillCell = 2;
    }

    clearInterval(globalObject.timerId);
    globalObject.timerId = setInterval(timeout, 5000);


    socket.to(globalObject.currentPlayer).emit('yourMove', {
      cellId: data.cellId
    });

    //Sätter en 1:a eller 2:a beroende på vilken spelares tur det är
    globalObject.gameArea[data.cellId] = fillCell;

    let x = globalObject.checkForWinner();
    let vinnare;

    if (x == 1) {
      vinnare = 'Vinnare är ' + globalObject.playerOneNick + '!';
      winner(vinnare);
      // io.emit('gameover',
      //   vinnare
      // );
      // clearInterval(globalObject.timerId);
      // resetPlayers();
    }
    else if (x == 2) {
      vinnare = 'Vinnare är ' + globalObject.playerTwoNick + '!';
      winner(vinnare);
      // io.emit('gameover',
      //   vinnare
      // );
      // clearInterval(globalObject.timerId);
      // resetPlayers();
    }
    else if (x == 3) {
      vinnare = 'Det blev oavgjort!';
      winner(vinnare);
      // io.emit('gameover',
      //   vinnare
      // );
      // clearInterval(globalObject.timerId);
      // resetPlayers();
    }
  });
});

function winner(vinnare){
  io.emit('gameover',
        vinnare
      );
      clearInterval(globalObject.timerId);
      resetPlayers();
}

function timeout() {
  console.log('Timer startas');
  io.to(globalObject.currentPlayer).emit('timeout');


  if (globalObject.currentPlayer == globalObject.playerOneSocketId) {
    globalObject.currentPlayer = globalObject.playerTwoSocketId;
  } else if (globalObject.currentPlayer == globalObject.playerTwoSocketId) {
    globalObject.currentPlayer = globalObject.playerOneSocketId;
  }
  io.to(globalObject.currentPlayer).emit('yourMove');

  console.log("5 sekunder har passerat!");


};



/*app.listen('3000', () => {
  console.log('Server startat på port 3000');
});*/

//Filen app.js är den enda ni skall och tillåts skriva kod i.