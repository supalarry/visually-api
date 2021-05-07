import fs from 'fs';
import path from 'path';
import SpeechToTextV1 from 'ibm-watson/speech-to-text/v1';
import { IamAuthenticator } from 'ibm-watson/auth';
import logging from '../config/logging';

const NAMESPACE = 'Watson';

enum LoggingMessages {
    RECEIVED_DATA = 'Received data',
    ERROR = 'An error occured',
    FINISHED = 'Fetching finished'
}

function transcribe(filename: string, mimetype: string, model: string) {
    const speechToText = new SpeechToTextV1({
        authenticator: new IamAuthenticator({
            apikey: process.env.WATSON_API_KEY!
        }),
        serviceUrl: process.env.WATSON_API_URL!
    });

    const params = {
        objectMode: true,
        contentType: mimetype,
        model: model,
        timestamps: true
    };

    return new Promise((resolve, reject) => {
        // Create the stream.
        const recognizeStream = speechToText.recognizeUsingWebSocket(params);

        // Pipe in the audio.
        const filePath = path.join(__dirname, '..', '..', 'uploads', filename);

        logging.info(NAMESPACE, `Start transcribing audio from ${filePath}`);
        fs.createReadStream(filePath).pipe(recognizeStream);

        const data: any = [];
        // Listen for events.
        recognizeStream.on('data', function (event: unknown) {
            data.push(event);
            logging.info(NAMESPACE, LoggingMessages.RECEIVED_DATA);
        });
        recognizeStream.on('error', function (event: unknown) {
            logging.info(NAMESPACE, LoggingMessages.ERROR, event);
            reject(event);
        });
        recognizeStream.on('close', function (event: unknown) {
            logging.info(NAMESPACE, LoggingMessages.FINISHED);
            resolve({ Data: data });
        });
    });
}

export { transcribe };
