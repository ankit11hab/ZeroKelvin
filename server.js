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
const storage = multer.diskStorage({
  destination: (req,file,cb)=>{
    cb(null,'public/auction_images');
  },
  filename: (req,file,cb)=>{
    cb(null,String(Date.now()).substring(0,10)+'.jpg');
  }
});

const upload = multer({storage: storage})

const schedule = require('node-schedule');
const serviceAccount = require('./e-auction-788fe-firebase-adminsdk-ezaf4-ba148ec705.json');

initializeApp({
  credential: cert(serviceAccount)
});
const db = getFirestore();

function isLoggedIn(req, res, next) {
  checkStatus();
  req.user ? next() : res.redirect('/login');
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

async function checkStatus(){

  const currentDatetimesecs = new Date().getTime();
  const AuctionsRef = db.collection('Auctions');

   // checkIfCuming
   const nameQueryRescoming = await AuctionsRef.where('StartingTimeSecs', '>=', currentDatetimesecs).get();
   if (nameQueryRescoming.empty) {
     console.log('No matching documents.');
   }  

  // checkIfStarted
  const nameQueryRes = await AuctionsRef.where('StartingTimeSecs', '<=', currentDatetimesecs).get();
  if (nameQueryRes.empty) {
    console.log('No matching documents.');
  }  

  // checkIfEnded
  const nameQueryResended = await AuctionsRef.where('EndingTimeSecs', '<=', currentDatetimesecs).get();
  if (nameQueryResended.empty) {
    console.log('No matching documents. end');
  }  

  await nameQueryRescoming.forEach(doc => {
    console.log("DONEDONEDO")
   AuctionsRef.doc(doc.id).update({status:"Upcoming"})
  });
  await nameQueryRes.forEach(doc => {
    console.log("DONEDONEDO")
   AuctionsRef.doc(doc.id).update({status:"Started"})
    console.log("DONEDONEDONEDONEDONEDONEDONEDONEDONEDONEDONEDONEDONEDONEDONE")
  });
  await nameQueryResended.forEach(doc => {
    AuctionsRef.doc(doc.id).update({status:"Ended"})
    console.log("DONEDONEDONEDONEDONEDONEDONEDONEDONEDONEDONEDONEDONEDONEDONE__EMDED")
  });
}

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
    if(item.status=='Upcoming') 
      upcomingAuctions.push(item);
    else if(item.status=='Ended')
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
  loggedin= req.user ? true : false;
  res.render('auction_detail',{docID:req.params.id,auction:auction.data(),auctionItem:list,isLoggedIn:loggedin})
})
app.get('/winners/:id', async (req, res) => {
  const auction = await db.collection('Auctions').doc(req.params.id).get();
  const auctionItems = await db.collection('Auctions').doc(req.params.id).collection('Items').get();
  const list = auctionItems.docs.map((doc)=>({id:doc.id,...doc.data()}));
  console.log(list);
  loggedin= req.user ? true : false;
  res.render('auction_detail_winner',{docID:req.params.id,auction:auction.data(),auctionItem:list,isLoggedIn:loggedin})
})

app.get('/detail/:id/item/:itemID', isLoggedIn, async (req, res) => {
  const item = await db.collection('Auctions').doc(req.params.id).collection('Items').doc(req.params.itemID).get();
  const bids = await db.collection('Auctions').doc(req.params.id).collection('Items').doc(req.params.itemID).collection('Bids').get();
  const bidlist = bids.docs.map((doc)=>({id:doc.id,...doc.data()}));
  res.render('item_detail',{item:item.data(),userName:req.user.displayName,auctionid:req.params.id,itemid:req.params.itemID,Bids:bidlist});
})

app.post('/placeBid/:id/item/:itemID', async (req, res) => {
  const auction= await db.collection('Auctions').doc(req.params.id).collection('Items').doc(req.params.itemID).collection('Bids').add({Author : {
    id : req.user.id,
    displayName : req.user.displayName,
    email : req.user.email,
  },value:req.body.bidamount});
  console.log(req.body);
  await db.collection('Auctions').doc(req.params.id).collection('Items').doc(req.params.itemID).update({Currentbid:req.body.bidamount});
  res.redirect(req.get('referer'));
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

function scheduleAuctionEvents(eventData,id) {
  var StartingTime = new Date(eventData.StartingTime);
  var EndingTime = new Date(eventData.EndingTime);
  const jobStarting = schedule.scheduleJob(StartingTime, function(){
    const res1 = db.collection('Auctions').add(req.body);
    db.collection('Auctions').doc(id).update({
      "status" : "Ongoing"
    })
  });
  const jobEnded = schedule.scheduleJob(EndingTime, function(){
    const res1 = db.collection('Auctions').add(req.body);
    db.collection('Auctions').doc(id).update({
      "status" : "Ended"
    });
  });
};

app.post('/auctionRegister', upload.single("image"), isLoggedIn, async (req,res)=>{
  const res1 = await db.collection('Auctions').add(req.body);
  const StartingSecs = new Date(req.body.StartingTime).getTime();
  const EndingSecs = new Date(req.body.EndingTime).getTime();
  await db.collection('Auctions').doc(res1.id).update({
    Author : {
      id : req.user.id,
      displayName : req.user.displayName,
      email : req.user.email,
    },
    status : "Upcoming",
    StartingTimeSecs : StartingSecs,
    EndingTimeSecs : EndingSecs,
    image: String(Date.now()).substring(0,10)+'.jpg'
  });
  await db.collection('Users').doc(req.user.id).collection('Auctions').doc(res1.id).set({
    id : res1.id,
    data : req.body
  });
  scheduleAuctionEvents(req.body,res1.id);
  res.redirect('/schedule');
});

app.post('/UpdateAuction/:room', isLoggedIn, async (req,res)=>{
  const auctionRef = db.collection('Auctions').doc(req.params.room);
  const res1 = await auctionRef.update(req.body);
  const res2=await auctionRef.update({
    StartingTimeSecs :  new Date(req.body.StartingTime).getTime(),
    EndingTimeSecs : new Date(req.body.EndingTime).getTime(),
  });
  const userItems = db.collection('Users').doc(req.user.id).collection('Auctions').doc(req.params.room);
  await userItems.update({
    "data.title" : req.body.title,
    "data.name" : req.body.name,
    "data.Heading" : req.body.heading,
    "data.description" : req.body.description,
  })
  res.redirect(`/editauctiondetails/${req.params.room}`);
});
app.get('/DeleteAuction/:room', isLoggedIn, async (req,res)=>{
  const auctionRef = db.collection('Auctions').doc(req.params.room);
  const userItems = db.collection('Users').doc(req.user.id).collection('Auctions').doc(req.params.room);
  await userItems.delete();
  await auctionRef.delete();
  res.redirect(`/schedule`);
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
  console.log(Users)
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

app.post('/auctionItems/:room', upload.single("image"), isLoggedIn, async (req,res)=>{
  const auctionRef = db.collection('Auctions').doc(req.params.room).collection('Items').add({
    name:req.body.name,
    description:req.body.description,
    Startingbid:req.body.Startingbid,
    Multiple:req.body.Multiple,
    Currentbid:req.body.Startingbid,
    image: String(Date.now()).substring(0,10)+'.jpg'
  });
  res.redirect(req.get('referer'));
})

app.post('/test', upload.single("image"), (req,res)=>{
  res.send("Image uploaded");
})

app.get('/test', (req,res)=>{
  res.render("test_image");
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
