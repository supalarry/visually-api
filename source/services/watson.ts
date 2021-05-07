import fs from 'fs';
import path from 'path';
import SpeechToTextV1 from 'ibm-watson/speech-to-text/v1';
import NaturalLanguageUnderstandingV1 from 'ibm-watson/natural-language-understanding/v1';
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
    // duration is calculated manually
    duration?: number;
    confidence: number;
    timestamps: Timestamp[];
}

// Word, it's starting time, it's ending time
type Timestamp = [string, number, number];

function transcribe(filename: string, mimetype: string, model: string): Promise<Transcription> {
    const speechToText = new SpeechToTextV1({
        authenticator: new IamAuthenticator({
            apikey: process.env.WATSON_TRANSCRIBE_API_KEY!
        }),
        serviceUrl: process.env.WATSON_TRANSCRIBE_API_URL!
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
                    // Add sentence to variable storing whole transcript
                    text += `${alternative.transcript.trim()}. `;
                    // Calculate length of the sentence
                    const startTimeOfFirsWord = alternative.timestamps[0][1];
                    const endTimeOfLastWord = alternative.timestamps[alternative.timestamps.length - 1][2];
                    alternative.duration = endTimeOfLastWord - startTimeOfFirsWord;
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

/* Language analysis interfaces */
type NlpResponse = NaturalLanguageUnderstandingV1.Response<NaturalLanguageUnderstandingV1.AnalysisResults>;

function analyseTranscription(transcription: Transcription): Promise<NlpResponse> {
    logging.info(NAMESPACE, 'Starting transcription analysis');
    const naturalLanguageUnderstanding = new NaturalLanguageUnderstandingV1({
        version: '2021-03-25',
        authenticator: new IamAuthenticator({
            apikey: process.env.WATSON_NLU_API_KEY!
        }),
        serviceUrl: process.env.WATSON_NLU_API_URL!
    });

    logging.debug(NAMESPACE, transcription.text);
    const analyzeParams = {
        text: transcription.text,
        features: {
            keywords: {
                emotion: true
            },
            entities: {
                emotion: true
            },
            categories: {},
            concepts: {},
            syntax: {
                sentences: true,
                tokens: {
                    lemma: true,
                    part_of_speech: true
                }
            }
        }
    };

    return new Promise((resolve, reject) => {
        naturalLanguageUnderstanding
            .analyze(analyzeParams)
            .then((analysisResults) => {
                resolve(analysisResults);
            })
            .catch((err) => {
                reject(err);
                logging.error(NAMESPACE, err.message, err);
            });
    });
}

export { transcribe, analyseTranscription };
