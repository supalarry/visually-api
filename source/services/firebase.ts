import * as admin from 'firebase-admin';
import path from 'path';
import logging from '../config/logging';

// Initialize firebase admin SDK
const serviceAccount = require('./firebase-credentials.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'gs://visually-de279.appspot.com'
});

// Cloud storage
const bucket = admin.storage().bucket();

async function uploadFile(audioPath: string) {
    const metadata = {
        contentType: 'audio/mpeg',
        cacheControl: 'public, max-age=31536000'
    };
    const audioUrl = path.join(__dirname, '..', '..', 'uploads', 'tigers.mp3');
    const res = await bucket.upload(audioUrl, {
        // Support for HTTP requests made with `Accept-Encoding: gzip`
        gzip: true,
        metadata: metadata
    });

    console.log(`${res}`);
}

uploadFile('../../uploads/audio.mp3');
