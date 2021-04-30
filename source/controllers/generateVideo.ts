import { NextFunction, Request, Response } from 'express';
import logging from '../config/logging';

const NAMESPACE = 'generateVideo controller';

const generateVideo = (req: Request, res: Response, next: NextFunction) => {
    logging.info(NAMESPACE, 'Generate video');

    return res.status(200).json({
        message: 'videoURL'
    });
};

export default { generateVideo };
