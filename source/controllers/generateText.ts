import { NextFunction, Request, Response } from 'express';
import { transcribe } from '../services/watsonSpeechToText';

const NAMESPACE = 'generateText controller';

const generateText = async (req: Request, res: Response, next: NextFunction) => {
    transcribe();
    return res.status(200).json({
        status: 'transcribed'
    });
};

export default { generateText };
