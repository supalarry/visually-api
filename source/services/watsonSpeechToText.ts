import fs from 'fs';
import path from 'path';
import SpeechToTextV1 from 'ibm-watson/speech-to-text/v1';
import { IamAuthenticator } from 'ibm-watson/auth';

const speechToText = new SpeechToTextV1({
    authenticator: new IamAuthenticator({
        apikey: process.env.WATSON_API_KEY!
    }),
    serviceUrl: process.env.WATSON_API_URL!
});

const params = {
    objectMode: true,
    contentType: 'audio/mp3',
    model: 'en-US_BroadbandModel',
    timestamps: true
};

function transcribe(filename: string) {
    return new Promise((resolve, reject) => {
        // Create the stream.
        const recognizeStream = speechToText.recognizeUsingWebSocket(params);

        // Pipe in the audio.
        const filePath = path.join(__dirname, '..', '..', 'uploads', filename);
        fs.createReadStream(filePath).pipe(recognizeStream);

        /*
         * Uncomment the following two lines of code ONLY if `objectMode` is `false`.
         *
         * WHEN USED TOGETHER, the two lines pipe the final transcript to the named
         * file and produce it on the console.
         *
         * WHEN USED ALONE, the following line pipes just the final transcript to
         * the named file but produces numeric values rather than strings on the
         * console.
         */
        // recognizeStream.pipe(fs.createWriteStream('transcription.txt'));

        /*
         * WHEN USED ALONE, the following line produces just the final transcript
         * on the console.
         */
        // recognizeStream.setEncoding('utf8');

        const data: any = [];
        // Listen for events.
        recognizeStream.on('data', function (event: unknown) {
            data.push(event);
        });
        recognizeStream.on('error', function (event: unknown) {
            reject({ Error: event });
        });
        recognizeStream.on('close', function (event: unknown) {
            resolve({ Data: data });
        });
    });
}

export { transcribe };
