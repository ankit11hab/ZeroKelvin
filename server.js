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
const schedule = require('node-schedule');
const serviceAccount = require('./e-auction-788fe-firebase-adminsdk-ezaf4-ba148ec705.json');

initializeApp({
  credential: cert(serviceAccount)
});
const db = getFirestore();

function isLoggedIn(req, res, next) {

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

async function checkStatus(req, res, next){

  const currentDatetimesecs = new Date().getTime();
  const AuctionsRef = db.collection('Auctions');
  db.collection('Auctions').get().then(snapshot => {
    snapshot.docs.forEach(async (doc) => {
      const eachdoc = doc.data().StartingTimeSecs
      if(doc.data().StartingTimeSecs >=currentDatetimesecs && doc.data().EndingTimeSecs >=currentDatetimesecs && doc.data().status != "Upcoming")
      AuctionsRef.doc(doc.id).update({status:"Upcoming"});
      if(doc.data().StartingTimeSecs <=currentDatetimesecs && doc.data().EndingTimeSecs >=currentDatetimesecs && doc.data().status != "Started")
      AuctionsRef.doc(doc.id).update({status:"Started"});
      if(doc.data().StartingTimeSecs <=currentDatetimesecs && doc.data().EndingTimeSecs <=currentDatetimesecs && doc.data().status != "Ended"){
        AuctionsRef.doc(doc.id).update({status:"Ended"});
        const itemsRef = db.collection('Auctions').doc(doc.id).collection('Items');
        const snapshot = await itemsRef.get();
        snapshot.forEach(async (doc1) => {
          const itemRef1 = db.collection('Auctions').doc(doc.id).collection('Items').doc(doc1.id);
          const currentBid = await itemRef1.get().then((value)=> value.data().Currentbid);
          const BidsRef = db.collection('Auctions').doc(doc.id).collection('Items').doc(doc1.id).collection('Bids');
          const Bidssnapshot = await BidsRef.where('value', '==', currentBid).get();
          if (Bidssnapshot.empty) {
            console.log('No matching documents.');
            itemRef1.update({winner : "Unsold"})
          }else{
            Bidssnapshot.forEach(doc3 => {
              const winnerName = doc3.data().Author.displayName;
              itemRef1.update({winner : winnerName})
            });
          }
        });
      }
    })
  })
  next();
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

app.get('/view',checkStatus, isLoggedIn, async (req,res) => {
  const userRef = db.collection('Users').doc(req.user.id);
  doc = await userRef.get();
  if (!doc.exists) {
    doc = await db.collection('Users').doc(req.user.id).set(req.user);
  }
  res.redirect('/home');
})



app.get('/', checkStatus,(req,res) => {
  res.redirect('/home');
})
app.get('/home',checkStatus, async (req, res) => {
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

app.get('/detail/:id',checkStatus, async (req, res) => {
  const auction = await db.collection('Auctions').doc(req.params.id).get();
  const auctionItems = await db.collection('Auctions').doc(req.params.id).collection('Items').get();
  const list = auctionItems.docs.map((doc)=>({id:doc.id,...doc.data()}));
  console.log(list);
  loggedin= req.user ? true : false;
  res.render('auction_detail',{docID:req.params.id,auction:auction.data(),auctionItem:list,isLoggedIn:loggedin})
})

app.get('/winners/:id',checkStatus, async (req, res) => {
  const auction = await db.collection('Auctions').doc(req.params.id).get();
  const auctionItems = await db.collection('Auctions').doc(req.params.id).collection('Items').get();
  // await db.collection('Auctions').doc(req.params.id).collection('Items').get().then(snapshot => {
  //   snapshot.docs.forEach(doc => {
  //     db.collection('Auctions').doc(req.params.id).collection('Items').doc(doc.id).collection('Bids').where('value', '==', doc.Currentbid).get().then
  //       (querySnapshot => {
  //         if(!querySnapshot.empty) {
  //           const winner = querySnapshot.docs[0].data().Author
  //           db.collection('Auctions').doc(req.params.id).collection('Items').doc(doc.id).update({winner:winner})
  //           // rest of your code 
  //         }
  //     })
      
  //   })
  // })
  const list = auctionItems.docs.map((doc)=>({id:doc.id,...doc.data()}));
  console.log(list);
  loggedin= req.user ? true : false;
  res.render('auction_detail_winner',{docID:req.params.id,auction:auction.data(),auctionItem:list,isLoggedIn:loggedin})
})

app.get('/detail/:id/item/:itemID',checkStatus, isLoggedIn, async (req, res) => {
  const item = await db.collection('Auctions').doc(req.params.id).collection('Items').doc(req.params.itemID).get();
  const bids = await db.collection('Auctions').doc(req.params.id).collection('Items').doc(req.params.itemID).collection('Bids').get();
  const bidlist = bids.docs.map((doc)=>({id:doc.id,...doc.data()}));
  res.render('item_detail',{item:item.data(),userName:req.user.displayName,auctionid:req.params.id,itemid:req.params.itemID,Bids:bidlist});
})

app.post('/placeBid/:id/item/:itemID',checkStatus, async (req, res) => {
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



app.get('/schedule', isLoggedIn,checkStatus, async (req,res)=>{
  const userRef = db.collection('Users').doc(req.user.id);
  Users = await userRef.get();
  const auctionRef = db.collection('Users').doc(req.user.id).collection('Auctions');
  Auctions = await auctionRef.get();
  Auctions.forEach(doc => {
    console.log(doc.id, '=>', doc.data());
  });
  res.render('schedule',{ Users : Users, Auctions : Auctions})
})

// function scheduleAuctionEvents(eventData,id) {
//   var StartingTime = new Date(eventData.StartingTime);
//   var EndingTime = new Date(eventData.EndingTime);
//   const jobStarting = schedule.scheduleJob(StartingTime, function(){
//     const res1 = db.collection('Auctions').add(req.body);
//     db.collection('Auctions').doc(id).update({
//       "status" : "Ongoing"
//     })
//   });
//   const jobEnded = schedule.scheduleJob(EndingTime, function(){
//     const res1 = db.collection('Auctions').add(req.body);
//     db.collection('Auctions').doc(id).update({
//       "status" : "Ended"
//     });
//   });
// };

app.post('/auctionRegister',checkStatus, isLoggedIn, async (req,res)=>{
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
  });
  await db.collection('Users').doc(req.user.id).collection('Auctions').doc(res1.id).set({
    id : res1.id,
    data : req.body
  });
  // scheduleAuctionEvents(req.body,res1.id);
  res.redirect('/schedule');
});

app.post('/UpdateAuction/:room',checkStatus, isLoggedIn, async (req,res)=>{
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
app.get('/DeleteAuction/:room',checkStatus, isLoggedIn, async (req,res)=>{
  const auctionRef = db.collection('Auctions').doc(req.params.room);
  const userItems = db.collection('Users').doc(req.user.id).collection('Auctions').doc(req.params.room);
  await userItems.delete();
  await auctionRef.delete();
  res.redirect(`/schedule`);
});

app.get('/profile',checkStatus, isLoggedIn, (req,res)=>{
  res.render('profile',{user:req.user})
})

app.get('/productDetail',checkStatus,  isLoggedIn, (req,res)=>{
  console.log(req.user);
  res.render('product_detail',{user:req.user})
})

app.get('/editauctiondetails/:room',checkStatus,  isLoggedIn, async (req, res) => {
  const userRef = db.collection('Users').doc(req.user.id);
  Users = await userRef.get();
  const auctionRef = db.collection('Auctions').doc(req.params.room);
  Auction = await auctionRef.get();
  console.log(Users)
  res.render('editauction', { roomId: req.params.room, Auction : Auction.data(), Users : Users})
})

app.post('/editauctiondetails/:room',checkStatus, isLoggedIn, async (req, res) => {
    db.collection('Auctions').doc(req.params.room).update({
      name:req.body.name,
      title:req.body.title,
      Heading:req.body.heading
    });
    res.redirect(req.get('referer'));
});

app.get('/auctionItems/:room',checkStatus, isLoggedIn, async (req, res) => {
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
app.get('/deleteItems/:room/:itemid', checkStatus,isLoggedIn, async (req, res) => {
  const itemsRef = db.collection('Auctions').doc(req.params.room).collection('Items').doc(req.params.itemid.toString()).delete();
  res.redirect(req.get('referer'));
})

app.post('/auctionItems/:room',checkStatus,  isLoggedIn, async (req,res)=>{
  const auctionRef = db.collection('Auctions').doc(req.params.room).collection('Items').add({
    name:req.body.name,
    description:req.body.description,
    Startingbid:req.body.Startingbid,
    Multiple:req.body.Multiple,
    Currentbid:req.body.Startingbid
  });
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
