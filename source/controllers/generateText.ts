import { NextFunction, Request, Response } from 'express';
import { transcribe } from '../services/watsonSpeechToText';

const NAMESPACE = 'generateText controller';

/*
 ** Before this controller multer middleware is used.
 ** To access attached file: req.file
 ** To access property of text body: req.body.textKey
 */

const generateText = async (req: Request, res: Response, next: NextFunction) => {
    console.log(req.file);
    console.log(req.body.name);
    // transcribe();
    return res.status(200).json({
        status: 'transcribed'
    });
};

export default { generateText };
