import express from 'express';
import controller from '../controllers/generateText';

const router = express.Router();

router.post('/videos/transcribe', controller.generateText);

export = router;
