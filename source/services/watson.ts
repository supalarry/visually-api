import fs from 'fs';
import path from 'path';
import SpeechToTextV1 from 'ibm-watson/speech-to-text/v1';
import NaturalLanguageUnderstandingV1, { KeywordsResult, EntitiesResult, ConceptsResult, CategoriesResult, AnalysisResults } from 'ibm-watson/natural-language-understanding/v1';
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
    analysis: Analysis;
    videos?: Video[];
}

interface Analysis {
    results?: NaturalLanguageUnderstandingV1.AnalysisResults;
    rank?: (KeywordsResult | EntitiesResult | ConceptsResult | CategoriesResultVisually)[];
    fetchedVideoFor?: KeywordsResult | EntitiesResult | ConceptsResult | CategoriesResultVisually;
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

        recognizeStream.on('data', function (event: TranscriptionResponse) {
            if (event?.processing_metrics?.processed_audio?.received) {
                transcription.statistics.audioDuration = Math.ceil(event.processing_metrics.processed_audio.received);
            }
            event.results.forEach((result, index) => {
                result.alternatives.forEach((alternative) => {
                    let sentence = createSentenceFrom(alternative, transcription);
                    transcription.text += sentence.transcript;
                    const isLastSentence = event.results[index + 1] === undefined;
                    addSentence(sentence, isLastSentence, transcription);
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
            updateLastSentenceDuration(transcription);
            resolve(transcription);
        });
    });
}

function createSentenceFrom(watsonSentence: Alternative, transcription: Transcription): Sentence {
    // empty return object stub
    let sentence: Sentence = {
        transcript: '',
        timestamps: [],
        duration: 0,
        analysis: {}
    };

    // set transcript
    sentence.transcript = `${watsonSentence.transcript.trim()}. `;

    // set timestamps
    sentence.timestamps = watsonSentence.timestamps;

    // set duration
    const sentencesCount = transcription.statistics.sentencesCount;
    const timestamps = sentence.timestamps;
    const sentenceLastTimestamp = timestamps[timestamps.length - 1][2];
    if (sentencesCount === 0) {
        sentence.duration = sentenceLastTimestamp;
    } else {
        const previousSentence = transcription.sentences[sentencesCount - 1];
        const previousSentenceTimestamps = previousSentence.timestamps;
        const previousSentenceLastTimestamp = previousSentenceTimestamps[previousSentenceTimestamps.length - 1][2];
        sentence.duration = sentenceLastTimestamp - previousSentenceLastTimestamp;
    }

    return sentence;
}

function addSentence(sentence: Sentence, isLastSentence: boolean, transcription: Transcription) {
    // If sentence length is shorter than this many seconds, it needs to be merged
    // with another sentence
    const treshold = 5;

    const count = transcription.statistics.sentencesCount;
    const previousSentence = count > 0 ? transcription.sentences[count - 1] : null;
    /* Merge previous sentence with current if
     ** 1. previous sentence is shorter than treshold
     ** if current sentence is the last one and is shorter than treshold
     */
    if ((count && previousSentence!.duration < treshold) || (isLastSentence && sentence.duration < treshold)) {
        previousSentence!.transcript += sentence.transcript;
        previousSentence!.duration += sentence.duration;
        previousSentence!.timestamps = previousSentence!.timestamps.concat(sentence.timestamps);
    } else {
        transcription.sentences.push(sentence);
        transcription.statistics.sentencesCount += 1;
    }
}

function updateLastSentenceDuration(transcription: Transcription) {
    // Watson gives information about how long the whole audio is only at the end of transcription.
    // We want that time between last sentences last word timestamp & end of audio also counts
    // as a part of last sentence, so that a video can be fit there.

    const sentences = transcription.sentences;
    const lastSentence = sentences[sentences.length - 1];
    const lastWordEndingTimestamp = lastSentence.timestamps[0][2];

    lastSentence.duration = transcription.statistics.audioDuration - lastWordEndingTimestamp;
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

    const analyzeParams = {
        features: {
            keywords: {},
            entities: {},
            categories: {},
            concepts: {}
        }
    };
    for (let sentence of transcription.sentences) {
        const response = await naturalLanguageUnderstanding.analyze({ ...analyzeParams, text: sentence.transcript });
        sentence.analysis.results = response.result;
        addAnalysisRank(sentence);
    }
    logging.info(NAMESPACE, 'Finished transcription analysis');
    return transcription;
}

function addAnalysisRank(sentence: Sentence) {
    const lowestAcceptedRelevanceScore = 0.6;
    // Pack together keywords, entities & concepts because they are more specific than categories
    sentence.analysis.rank = [...sentence.analysis.results?.keywords!, ...sentence.analysis.results?.entities!, ...sentence.analysis.results?.concepts!];
    // Filter out low confidence entries
    sentence.analysis.rank = sentence.analysis.rank.filter((item) => {
        if ('relevance' in item) {
            return item.relevance! > lowestAcceptedRelevanceScore;
        }
        return false;
    });
    // Sort entries by relevance
    sentence.analysis.rank.sort((a, b) => {
        if ('relevance' in a && 'relevance' in b) {
            return b.relevance! - a.relevance!;
        }
        return 1;
    });
    // Add categories at the end of keywords, entities & concepts after
    // transforming categories returned from watson to a structure that matches
    // the structure of keywords, entitites & concepts
    const categories = sentence.analysis.results?.categories!.map((category) => {
        let visuallyCategory: CategoriesResultVisually = {
            text: category.label!,
            relevance: category.score!
        };
        return visuallyCategory;
    });
    sentence.analysis.rank = [...sentence.analysis.rank, ...categories!];
}

export { transcribe, analyseTranscription, Transcription, Sentence };
