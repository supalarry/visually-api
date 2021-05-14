import express from 'express';
import { renderVideo } from '../controllers/renderVideo';
import { upload, REQUEST_FILE_KEY } from './multer';

const router = express.Router();

/*
 ** For multer middleware 'upload.single()' as an argument you must pass
 ** the same name as the key in request storing the file
 */
router.post('/videos/render', upload.single(REQUEST_FILE_KEY), renderVideo);

export = router;
