import fs from 'fs';
import path from 'path';
import SpeechToTextV1 from 'ibm-watson/speech-to-text/v1';
import NaturalLanguageUnderstandingV1, { KeywordsResult, EntitiesResult, ConceptsResult, CategoriesResult } from 'ibm-watson/natural-language-understanding/v1';
import { IamAuthenticator } from 'ibm-watson/auth';
import logging from '../config/logging';
import { Video } from 'pexels';

const NAMESPACE = 'Watson';

enum LoggingMessages {
    RECEIVED_DATA = 'Received data',
    ERROR = 'An error occured',
    FINISHED = 'Fetching finished'
}

/* Transcription response interfaces */
interface TranscriptionResponse {
    result_index: number;
    results: Result[];
    processing_metrics?: any;
}

interface Result {
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

/* Transcription response converted to object for further usage */
interface Transcription {
    text: string;
    sentences: Sentence[];
    statistics: Statistics;
}

interface Sentence {
    transcript: string;
    duration: number;
    timestamps: Timestamp[];
    analysis?: NaturalLanguageUnderstandingV1.AnalysisResults;
    relevanceRank?: (KeywordsResult | EntitiesResult | ConceptsResult | CategoriesResultVisually)[];
    selectedForVideo?: KeywordsResult | EntitiesResult | ConceptsResult | CategoriesResultVisually;
    videos?: Video[];
}

interface Statistics {
    sentencesCount: number;
    audioDuration: number;
}

/* Watson interfaces modified */
interface CategoriesResultVisually extends CategoriesResult {
    text: string;
    relevance: number;
}

function transcribe(filename: string, mimetype: string, model: string): Promise<Transcription> {
    // Watson set up
    const speechToText = new SpeechToTextV1({
        authenticator: new IamAuthenticator({
            apikey: process.env.WATSON_TRANSCRIBE_API_KEY!
        }),
        serviceUrl: process.env.WATSON_TRANSCRIBE_API_URL!
    });
    // Describe transcription settings
    const params = {
        objectMode: true,
        contentType: mimetype,
        model: model,
        timestamps: true,
        processingMetrics: true,
        // Big number that needs to be longer than video length, so that the
        // metrics interval is the whole video.
        processingMetricsInterval: 99999999999999999999999999999999999
    };
    // Object that the function will return. It will store
    // extracted information returned by Watson
    let transcription: Transcription = {
        text: '',
        sentences: [],
        statistics: {
            audioDuration: 0,
            sentencesCount: 0
        }
    };

    return new Promise((resolve, reject) => {
        // Create the stream.
        const recognizeStream = speechToText.recognizeUsingWebSocket(params);

        // Pipe in the audio.
        const filePath = path.join(__dirname, '..', '..', 'uploads', filename);

        logging.info(NAMESPACE, `Start transcribing audio from ${filePath}`);
        fs.createReadStream(filePath).pipe(recognizeStream);

        // sentences length
        const shortSentenceLength = 5;
        // Listen for events.
        recognizeStream.on('data', function (event: TranscriptionResponse) {
            const results = event.results;
            if (event?.processing_metrics?.processed_audio?.received) {
                transcription.statistics.audioDuration = Math.ceil(event.processing_metrics.processed_audio.received);
            }
            event.results.forEach((result, index) => {
                result.alternatives.forEach((alternative) => {
                    // Calculate duration of the sentence
                    const startTimeOfFirsWord = alternative.timestamps[0][1];
                    const endTimeOfLastWord = alternative.timestamps[alternative.timestamps.length - 1][2];
                    const duration = endTimeOfLastWord - startTimeOfFirsWord;
                    // Create sentence object
                    let sentence: Sentence = {
                        transcript: `${alternative.transcript.trim()}. `,
                        duration,
                        timestamps: alternative.timestamps
                    };
                    // Add sentence to variable storing whole transcript
                    transcription.text += sentence.transcript;
                    // Merge current sentence with previous if previous sentence is short
                    // or it is the last sentence and the last sentence is short
                    const count = transcription.statistics.sentencesCount;
                    if ((count && transcription.sentences[count - 1].duration < shortSentenceLength) || (results[index + 1] === undefined && duration < 5)) {
                        transcription.sentences[count - 1].transcript += sentence.transcript;
                        transcription.sentences[count - 1].duration += sentence.duration;
                        transcription.sentences[count - 1].timestamps = transcription.sentences[count - 1].timestamps.concat(sentence.timestamps);
                    } else {
                        transcription.sentences.push(sentence);
                        transcription.statistics.sentencesCount += 1;
                    }
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
            resolve(transcription);
        });
    });
}

async function analyseTranscription(transcription: Transcription): Promise<Transcription> {
    logging.info(NAMESPACE, 'Starting transcription analysis');
    const naturalLanguageUnderstanding = new NaturalLanguageUnderstandingV1({
        version: process.env.WATSON_NLU_VERSION,
        authenticator: new IamAuthenticator({
            apikey: process.env.WATSON_NLU_API_KEY!
        }),
        serviceUrl: process.env.WATSON_NLU_API_URL!
    });

    let sentenceCounter = 0;
    const sentencesCount = transcription.sentences.length;
    for (let sentence of transcription.sentences) {
        const analyzeParams = {
            text: sentence.transcript,
            features: {
                keywords: {
                    // emotion: true
                },
                entities: {
                    // emotion: true
                },
                categories: {},
                concepts: {}
                // syntax: {
                //     sentences: true,
                //     tokens: {
                //         lemma: true,
                //         part_of_speech: true
                //     }
                // }
            }
        };

        const response = await naturalLanguageUnderstanding.analyze(analyzeParams);
        sentence.analysis = response.result;
        // Pack together keywords, entities & concepts because they are more specific than categories
        sentence.relevanceRank = [...sentence.analysis.keywords!, ...sentence.analysis.entities!, ...sentence.analysis.concepts!];
        // Filter out low confidence entries
        sentence.relevanceRank = sentence.relevanceRank.filter((item) => {
            if ('relevance' in item) {
                return item.relevance! > 0.6;
            }
            return false;
        });
        // Sort entries by relevance
        sentence.relevanceRank.sort((a, b) => {
            if ('relevance' in a && 'relevance' in b) {
                return b.relevance! - a.relevance!;
            }
            return 1;
        });
        // Add categories at the end of keywords, entities & concepts after
        // transforming categories returned from watson to a structure that matches
        // the structure of keywords, entitites & concepts
        const categories = sentence.analysis.categories!.map((category) => {
            let visuallyCategory: CategoriesResultVisually = {
                text: category.label!,
                relevance: category.score!
            };
            return visuallyCategory;
        });
        sentence.relevanceRank = [...sentence.relevanceRank, ...categories];
        // Adjust sentence length to fill the gaps between sentences
        if (sentenceCounter < 1) {
            // very first video
            const timestamps = sentence.timestamps;
            sentence.duration = timestamps[timestamps.length - 1][2];
        } else if (sentenceCounter + 1 !== sentencesCount) {
            // every video except first and last
            const previousSentence = transcription.sentences[sentenceCounter - 1];
            const previousSentenceTimestamps = previousSentence.timestamps;
            const previousSentenceLastTimestamp = previousSentenceTimestamps[previousSentenceTimestamps.length - 1][2];
            const timestamps = sentence.timestamps;
            sentence.duration = timestamps[timestamps.length - 1][2] - previousSentenceLastTimestamp;
        } else {
            const timestamps = sentence.timestamps;
            sentence.duration = transcription.statistics.audioDuration - timestamps[0][1];
        }
        sentenceCounter += 1;
    }
    logging.info(NAMESPACE, 'Finished transcription analysis');
    return transcription;
}

export { transcribe, analyseTranscription, Transcription, Sentence };
