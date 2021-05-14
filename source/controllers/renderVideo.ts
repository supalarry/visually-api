import { NextFunction, Request, Response } from 'express';
import { transcribe, analyseTranscription } from '../services/watson';
import { fetchVideos } from '../services/pexelsFetcher';
import logging from '../config/logging';
import { submitVideosForRendering, pollShotstackForRenderedVideo, ShotstackResponse } from '../services/shotstackEditor';
import path from 'path';

const NAMESPACE = 'Render video controller';
enum LogMessages {
    START_TRANSCRIPTION = 'Starting video transcription',
    NO_FILE = 'Request does not have file attached'
}
/*
 ** Before this controller multer middleware is used.
 ** To access attached file: req.file
 ** To access property of text body: req.body.textKey
 */

const renderVideo = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.file?.filename) {
        logging.error(NAMESPACE, LogMessages.NO_FILE);
        return res.status(400).json({
            status: LogMessages.NO_FILE
        });
    }

    logging.info(NAMESPACE, LogMessages.START_TRANSCRIPTION);
    try {
        const transcription = await transcribe(req.file.filename, req.file.mimetype, 'en-US_BroadbandModel');
        // logging.deepLog(transcription.text);
        // logging.deepLog(transcription.sentences);
        await analyseTranscription(transcription);
        await fetchVideos(transcription);
        // logging.debug(NAMESPACE, 'T R A N S C R I P T I O N');
        // logging.deepLog(transcription);
        const audioUrl = path.join(__dirname, '..', '..', 'uploads', req.file.mimetype);
        // const response = await submitVideosForRendering(transcription, audioUrl);
        // const renderedVideoUrl = await pollShotstackForRenderedVideo(response);
        return res.status(200).json({
            // url: renderedVideoUrl,
            url: audioUrl
        });
    } catch (error) {
        logging.error(NAMESPACE, error.message);
        return res.status(500).json({
            error: error.message
        });
    }
};

export { renderVideo };