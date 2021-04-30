import { NextFunction, Request, Response } from 'express';
import logging from '../config/logging';
import { fetchMultipleVideos } from '../services/pexelsFetcher';
import { submitVideosForRendering, pollShotstackForRenderedVideo, ShotstackResponse } from '../services/shotstackEditor';

const NAMESPACE = 'generateVideo controller';
const KEY_STORING_VIDEO_QUERIES = 'videos';

const generateVideo = async (req: Request, res: Response, next: NextFunction) => {
    // Validate request body
    if (!hasValidRequestBody(req)) {
        return res.status(400).json({
            error: `Missing or empty '${KEY_STORING_VIDEO_QUERIES}' key`
        });
    }
    // Start video generation
    logging.info(NAMESPACE, 'Starting video generation');
    try {
        const videos = await fetchMultipleVideos(req.body.videos);
        const response: ShotstackResponse = await submitVideosForRendering(videos);
        const renderedVideoUrl = await pollShotstackForRenderedVideo(response);
        return res.status(200).json({
            renderedVideoUrl
        });
    } catch (error) {
        return res.status(500).json({
            error: error.message
        });
    }
};

const hasValidRequestBody = (req: Request): boolean => {
    const videos = req.body[KEY_STORING_VIDEO_QUERIES];
    if (!videos || videos.constructor !== Array || !videos.length) {
        return false;
    }
    if (!videos.every((video: any) => typeof video === 'string')) {
        return false;
    }
    return true;
};

export default { generateVideo };
