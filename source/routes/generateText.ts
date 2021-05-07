import express from 'express';
import controller from '../controllers/generateText';
import { upload, REQUEST_FILE_KEY } from './multer';

const router = express.Router();

/*
 ** For multer middleware 'upload.single()' as an argument you must pass
 ** the same name as the key in request storing the file
 */
router.post('/videos/transcribe', upload.single(REQUEST_FILE_KEY), controller.generateText);

export = router;
