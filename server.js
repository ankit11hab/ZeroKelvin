const express = require('express')
const session = require('express-session');
const passport = require('passport');
require('./auth');
const app = express()
const server = require('http').Server(app)
const { ExpressPeerServer } = require('peer');
require('dotenv').config()
const { initializeApp, applicationDefault, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');
var bodyParser = require('body-parser');

const serviceAccount = require('./e-auction-788fe-firebase-adminsdk-ezaf4-ba148ec705.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

const peerServer = ExpressPeerServer(server, {
  debug: true
});

function isLoggedIn(req, res, next) {
  req.user ? next() : res.sendStatus(401);
  // next()
}

app.use(session({ secret: 'cats', resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());
app.use('/peerjs', peerServer);
app.use(bodyParser.urlencoded({extended: false}));

app.get('/google', (req, res) => {
  res.render('login')
  // res.send('<a href="/auth/google">Authenticate with Google</a>');
});

app.get('/auth/google',
  passport.authenticate('google', { scope: [ 'email', 'profile' ] }
));

app.get( '/auth/google/callback',
  passport.authenticate( 'google', {
    successRedirect: '/view',
    failureRedirect: '/auth/google/failure'
  })
);

app.get('/view', isLoggedIn, async (req,res) => {
  const userRef = db.collection('Users').doc(req.user.id);
  doc = await userRef.get();
  if (!doc.exists) {
    doc = await db.collection('Users').doc(req.user.id).set(req.user);
  }
  res.redirect('/home');
})

app.get('/home', isLoggedIn, (req, res) => {
  res.render('index');
})

app.set('view engine', 'ejs')
app.use(express.static('public'))

app.get('/',  (req, res) => {
  res.render('login')
})



app.get('/schedule', isLoggedIn, async (req,res)=>{
  const userRef = db.collection('Users').doc(req.user.id);
  Users = await userRef.get();
  const auctionRef = db.collection('Users').doc(req.user.id).collection('Auctions');
  Auctions = await auctionRef.get();
  Auctions.forEach(doc => {
    console.log(doc.id, '=>', doc.data());
  });
  res.render('schedule',{ Users : Users, Auctions : Auctions})
})

app.post('/auctionRegister', isLoggedIn, async (req,res)=>{
  const res1 = await db.collection('Auctions').add(req.body);
  await db.collection('Auctions').doc(res1.id).update({
    Author : {
      id : req.user.id,
      displayName : req.user.displayName,
      email : req.user.email,
    }
  });
  console.log(req.user)
  await db.collection('Users').doc(req.user.id).collection('Auctions').doc(res1.id).set({
    id : res1.id,
    data : req.body
  });
  res.redirect('/schedule');
})

// app.get('/logout', function(req, res) {
//     req.session.destroy(function(e){
//         req.logout();
//         res.redirect('/');
//     });
// });

app.get('/auth/google/failure', (req, res) => {
  res.send('Failed to authenticate..');
  res.send('<a href="/auth/google">Authenticate with Google</a>');
  res.render('login');
});



server.listen( process.env.PORT || 3000)
