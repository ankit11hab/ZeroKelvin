const express = require('express')
var moment = require('moment');
const session = require('express-session');
const passport = require('passport');
const path = require("path");
require('./auth');
const app = express()
const server = require('http').Server(app)
require('dotenv').config()
const { initializeApp, applicationDefault, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');
var bodyParser = require('body-parser');
const multer=require('multer');
const serviceAccount = require('./e-auction-788fe-firebase-adminsdk-ezaf4-ba148ec705.json');

initializeApp({
  credential: cert(serviceAccount)
});
const db = getFirestore();

function isLoggedIn(req, res, next) {
  req.user ? next() : res.sendStatus(401);
  // next()
}

app.use(session({ secret: 'cats', resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());
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

app.get('/home', isLoggedIn, async (req, res) => {
  const Auctions = await db.collection('Auctions').get();
  const list = Auctions.docs.map((doc)=>doc.data());
  let upcomingAuctions = [], ongoingAuctions = [], pastAuctions=[];
  var currTime = new Date();
  console.log(currTime);
  list.map((item)=>{
    if(item.StartingTime>currTime) 
      upcomingAuctions.push(item);
    else if(item.endingTime<currTime)
      pastAuctions.push(item);
    else
      ongoingAuctions.push(item);
  });
  res.render('index',{Auctions:list,moment:moment,upcomingAuctions:upcomingAuctions,ongoingAuctions:ongoingAuctions,
    pastAuctions:pastAuctions});
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
  //add image upload code here
  const res1 =  db.collection('Auctions').add({data:req.body,FileType: path.extname(req.file.originalname.toLowerCase()),});
  db.collection('Auctions').doc(res1.id).update({
      Author : {
        id : req.user.id,
        displayName : req.user.displayName,
        
        email : req.user.email,
      }
    });
    console.log(req.user)
    db.collection('Users').doc(req.user.id).collection('Auctions').doc(res1.id).set({
      id : res1.id,
      data : req.body,
      FileType: path.extname(req.file.originalname.toLowerCase()),
    });
});

app.get('/profile', isLoggedIn, (req,res)=>{
  console.log(req.user);
  res.render('profile',{user:req.user})
})

app.get('/editauctiondetails/:room', isLoggedIn, async (req, res) => {
  const userRef = db.collection('Users').doc(req.user.id);
  Users = await userRef.get();
  const auctionRef = db.collection('Auctions').doc(req.params.room);
  Auction = await auctionRef.get();
  res.render('editauction', { roomId: req.params.room, Auction : Auction, Users : Users})
})

app.get('/auctionItems/:room', isLoggedIn, async (req, res) => {
  const userRef = db.collection('Users').doc(req.user.id);
  Users = await userRef.get();
  const auctionRef = db.collection('Auctions').doc(req.params.room);
  Auction = await auctionRef.get();
  res.render('auctionItems', { roomId: req.params.room, Auction : Auction, Users : Users})
})

app.post('/auctionItems/:room', isLoggedIn, async (req,res)=>{
  const auctionRef = db.collection('Auctions').doc(req.params.room).collection('Items').add(req.body);
  res.redirect('/auctionItems/:room');
})

app.get('/logout', function(req, res) {
    req.session.destroy(function(e){
        req.logout();
        res.redirect('/');
    });
});

app.get('/auth/google/failure', (req, res) => {
  res.send('Failed to authenticate..');
  res.send('<a href="/auth/google">Authenticate with Google</a>');
  res.render('login');
});


server.listen( process.env.PORT || 3000)
