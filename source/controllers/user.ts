import { NextFunction, Request, Response } from 'express';
import logging from '../config/logging';
import { sendEmail } from '../services/email';

const NAMESPACE = 'User controller';
enum LogMessages {
    ADD_USER_TO_WAITING_LIST = 'Sign up user for waiting list'
}

const addUserToWaitingList = async (req: Request, res: Response, next: NextFunction) => {
    logging.info(NAMESPACE, LogMessages.ADD_USER_TO_WAITING_LIST);
    try {
        await sendEmail('lauris.skraucis@gmail.com', 'lauris.skraucis@gmail.com', `Visually: ${req.body.email} added to waiting list`, `${req.body.email} added to waiting list`);
    } catch (error) {
        logging.error(NAMESPACE, error.message, error);
        return res.status(500).json({
            error: error.message
        });
    }
};

export { addUserToWaitingList };
