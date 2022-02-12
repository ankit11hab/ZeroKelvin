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
// const multer=require('multer');
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



app.get('/', (req,res) => {
  res.redirect('/home');
})
app.get('/home', async (req, res) => {
  const Auctions = await db.collection('Auctions').get();
  const list = Auctions.docs.map((doc)=>({id:doc.id,...doc.data()}));
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
  loggedin= req.user ? true : false;
  res.render('index',{Auctions:list,moment:moment,upcomingAuctions:upcomingAuctions,ongoingAuctions:ongoingAuctions,
    pastAuctions:pastAuctions,isLoggedIn:loggedin});
})

app.get('/detail/:id', async (req, res) => {
  const auction = await db.collection('Auctions').doc(req.params.id).get();
  const auctionItems = await db.collection('Auctions').doc(req.params.id).collection('Items').get();
  const list = auctionItems.docs.map((doc)=>({id:doc.id,...doc.data()}));
  console.log(list);
  res.render('auction_detail',{docID:req.params.id,auction:auction.data(),auctionItem:list})
})

app.get('/detail/:id/item/:itemID', async (req, res) => {
  const item = await db.collection('Auctions').doc(req.params.id).collection('Items').doc(req.params.itemID).get();
  const Authors = await db.collection('Auctions').doc(req.params.id).collection('Items').doc(req.params.itemID).collection('Bids').get();
  const list = Authors.docs.map((doc)=>({id:doc.id,...doc.data()}));
  console.log(list);
  res.render('item_detail',{item:item.data(),bids:list});
})

app.set('view engine', 'ejs')
app.use(express.static('public'))

app.get('/login',  (req, res) => {
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
});

app.post('/UpdateAuction/:room', isLoggedIn, async (req,res)=>{
  const auctionRef = db.collection('Auctions').doc(req.params.room);
  const res1 = await auctionRef.update(req.body);
  const userItems = db.collection('Users').doc(req.user.id).collection('Auctions').doc(req.params.room);
  await userItems.update({data : req.body})
  res.redirect(`/editauctiondetails/${req.params.room}`);
});

app.get('/profile', isLoggedIn, (req,res)=>{
  res.render('profile',{user:req.user})
})

app.get('/productDetail', isLoggedIn, (req,res)=>{
  console.log(req.user);
  res.render('product_detail',{user:req.user})
})

app.get('/editauctiondetails/:room', isLoggedIn, async (req, res) => {
  const userRef = db.collection('Users').doc(req.user.id);
  Users = await userRef.get();
  const auctionRef = db.collection('Auctions').doc(req.params.room);
  Auction = await auctionRef.get();
  res.render('editauction', { roomId: req.params.room, Auction : Auction.data(), Users : Users})
})

app.post('/editauctiondetails/:room',isLoggedIn, async (req, res) => {
    db.collection('Auctions').doc(req.params.room).update({
      name:req.body.name,
      title:req.body.title,
      Heading:req.body.heading
    });
    res.redirect(req.get('referer'));
});

app.get('/auctionItems/:room', isLoggedIn, async (req, res) => {
  const userRef = db.collection('Users').doc(req.user.id);
  Users = await userRef.get();
  const itemsRef = db.collection('Auctions').doc(req.params.room).collection('Items');
  const snapshot = await itemsRef.get();
  itemids=[]
  snapshot.forEach(doc => {
    itemids.push(doc.id)
  });
  res.render('auctionItems', { roomId: req.params.room,Itemids:itemids, Items : snapshot, Users : Users})
})
app.get('/deleteItems/:room/:itemid', isLoggedIn, async (req, res) => {
  const itemsRef = db.collection('Auctions').doc(req.params.room).collection('Items').doc(req.params.itemid.toString()).delete();
  res.redirect(req.get('referer'));
})

app.post('/auctionItems/:room', isLoggedIn, async (req,res)=>{
  const auctionRef = db.collection('Auctions').doc(req.params.room).collection('Items').add(req.body);
  res.redirect(req.get('referer'));
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
