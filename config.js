const { initializeApp, applicationDefault, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');

const serviceAccount = require('./e-auction-788fe-firebase-adminsdk-ezaf4-ba148ec705.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();