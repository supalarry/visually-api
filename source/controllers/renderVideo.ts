import { NextFunction, Request, Response } from 'express';
import { transcribe, analyseTranscription } from '../services/watson';
import { fetchVideos } from '../services/pexelsFetcher';
import logging from '../config/logging';
import { submitVideosForRendering, pollShotstackForRenderedVideo, ShotstackResponse } from '../services/shotstackEditor';
import { uploadFile, deleteFile } from '../services/aws';
import fs from 'fs';
import util from 'util';

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
        // start uploading audio to s3 but also run transcription in parallel
        const uploadedAudio = uploadFile(req.file);
        // process transcription using watson
        const transcription = await transcribe(req.file, 'en-US_BroadbandModel');
        await analyseTranscription(transcription);
        // get stock footage
        const videosFetched = fetchVideos(transcription);
        // render the video after audio has been uploaded & videos fetched
        Promise.all([uploadedAudio, videosFetched])
            .then(async (results) => {
                const audio = results[0];
                const ticket = await submitVideosForRendering(transcription, audio.Location);
                const renderedVideoUrl = await pollShotstackForRenderedVideo(ticket);
                await deleteAudioLocallyAndCloud(req.file, audio.Key);
                return res.status(200).json({
                    url: renderedVideoUrl
                });
            })
            .catch((error) => {
                throw error;
            });
    } catch (error) {
        logging.error(NAMESPACE, error.message, error);
        return res.status(500).json({
            error: error.message
        });
    }
};

async function deleteAudioLocallyAndCloud(file: Express.Multer.File, cloudKey: string) {
    // delete locally
    const unlinkFile = util.promisify(fs.unlink);
    await unlinkFile(file.path);
    // delete from cloud
    await deleteFile(cloudKey);
}

export { renderVideo };
