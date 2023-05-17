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
  console.log('hello there');
  if (req.cookies.name != undefined && req.cookies.color != undefined) {
    res.sendFile(__dirname + '/static/html/index.html');
  } else {
    res.sendFile(__dirname + '/static/html/loggaIn.html');
  }
});

app.get('/reset', (req, res) => {
  res.clearCookie('color');
  res.clearCookie('name');
  res.redirect('/');
  //Kan man på något sätt rensa alla kakor med en rad kod?
});


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

  console.log(name);
  console.log(color);
  res.redirect('/');
});

io.on('connection', (socket) => {


  let cookieString = socket.handshake.headers.cookie;
  let cookielist = globalObject.parseCookies(cookieString);

  if (cookielist.name != null) {
    socket.name = cookielist.name;
  }
  if (cookielist.color != null) {
    socket.color = cookielist.color;
  }

  let opponentNick;
  let opponentColor;
  let myColor;

  if (globalObject.playerOneNick == null) {

    globalObject.playerOneSocketId = socket.id;
    globalObject.playerOneNick = socket.name;
    globalObject.playerOneColor = socket.color;


    
    console.log("--------------Spelare 1-------------");
    console.log("Spelare 1 socketID: " + globalObject.playerOneSocketId);
    console.log("Spelare 1 Nick: " + globalObject.playerOneNick);
    console.log("Spelare 1 Color: " + globalObject.playerOneColor);

  } else if (globalObject.playerTwoNick == null) {

    globalObject.playerTwoSocketId = socket.id;
    globalObject.playerTwoNick = socket.name;
    globalObject.playerTwoColor = socket.color;



    console.log("--------------Spelare 2-------------");
    console.log("Spelare 2 socketID: " + globalObject.playerTwoSocketId);
    console.log("Spelare 2 Nick: " + globalObject.playerTwoNick);
    console.log("Spelare 2 Color: " + globalObject.playerTwoColor);


    if (globalObject.playerOneSocketId == socket.id) {

      opponentNick = globalObject.playerTwoNick;
      opponentColor = globalObject.playerTwoColor;
      myColor = globalObject.playerOneColor;

    } else if (globalObject.playerTwoSocketId == socket.id) {

      opponentNick = globalObject.playerOneNick;
      opponentColor = globalObject.playerOneColor;
      myColor = globalObject.playerTwoColor;

    }

    socket.emit('newGame', {
      opponentNick: opponentNick,
      opponentColor: opponentColor,
      myColor: myColor
    });

    globalObject.resetGameArea();
    
    globalObject.currentPlayer = globalObject.playerOneSocketId;

    socket.to(globalObject.currentPlayer).emit('yourMove');

  } else {
    console.log('Redan två spelare anslutna!');
    socket.disconnect();
  }



  socket.on('newMove', (data) => {
    console.log(cookieString);

    let fillCell;

    if (cookieString == null) {
      console.log("Kakorna saknas!");
      socket.disconnect();
    }

    if (globalObject.currentPlayer == globalObject.playerOneSocketId) {
      globalObject.currentPlayer = globalObject.playerTwoSocketId;
      fillCell = 2;

    } else if (globalObject.currentPlayer == globalObject.playerTwoSocketId) {
      globalObject.currentPlayer = globalObject.playerOneSocketId;
      fillCell = 1;
    }


    socket.to(globalObject.currentPlayer).emit('yourMove', {
      cellId: data.cellId
    });
    
    globalObject.gameArea[data.cellId]=fillCell;

    let x = globalObject.checkForWinner();
    let vinnare;

    if(x==1){
      vinnare = 'Vinnare är '+globalObject.playerOneNick + '!';
      io.emit('gameover', 
        vinnare
      );
      globalObject.playerOneNick=null;
      globalObject.playerTwoNick=null;
      globalObject.playerOneColor=null;
      globalObject.playerTwoColor=null;
    }
    else if(x==2) {
      vinnare = 'Vinnare är ' + globalObject.playerTwoNick + '!';
      io.emit('gameover', 
        vinnare
      );
      globalObject.playerOneNick=null;
      globalObject.playerTwoNick=null;
      globalObject.playerOneColor=null;
      globalObject.playerTwoColor=null;
    }
    else if(x==3){
      vinnare = 'Det blev oavgjort!';
      io.emit('gameover', 
        vinnare
      );
      globalObject.playerOneNick=null;
      globalObject.playerTwoNick=null;
      globalObject.playerOneColor=null;
      globalObject.playerTwoColor=null;

    }
    console.log('testing ' + x);

  });
});




/*app.listen('3000', () => {
  console.log('Server startat på port 3000');
});*/

//Filen app.js är den enda ni skall och tillåts skriva kod i.