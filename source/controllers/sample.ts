import { NextFunction, Request, Response } from 'express';
import logging from '../config/logging';

const NAMESPACE = 'Sample controller';

const serverHealthCheck = (req: Request, res: Response, next: NextFunction) => {
    logging.info(NAMESPACE, 'Sample health check controller called');

    return res.status(200).json({
        message: 'pong'
    });
};

export default { serverHealthCheck };
