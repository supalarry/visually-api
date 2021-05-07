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

interface Transcription {
    text: string;
    data: TranscriptionResponse[];
}

/* Transcription response interfaces */
interface TranscriptionResponse {
    result_index: number;
    results: Sentence[];
}

interface Sentence {
    final: boolean;
    alternatives: Alternative[];
}

interface Alternative {
    transcript: string;
    confidence: number;
    timestamps: Timestamp[];
}

// Word, it's starting time, it's ending time
type Timestamp = [string, number, number];

function transcribe(filename: string, mimetype: string, model: string): Promise<Transcription> {
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

        let text: string = '';
        const data: TranscriptionResponse[] = [];
        // Listen for events.
        recognizeStream.on('data', function (event: TranscriptionResponse) {
            data.push(event);
            event.results.forEach((sentence) => {
                sentence.alternatives.forEach((alternative) => {
                    text += `${alternative.transcript}.`;
                });
            });
            logging.info(NAMESPACE, LoggingMessages.RECEIVED_DATA);
        });
        recognizeStream.on('error', function (event: unknown) {
            logging.info(NAMESPACE, LoggingMessages.ERROR, event);
            reject(event);
        });
        recognizeStream.on('close', function (event: unknown) {
            logging.info(NAMESPACE, LoggingMessages.FINISHED);
            resolve({
                text,
                data
            });
        });
    });
}

export { transcribe, TranscriptionResponse };
