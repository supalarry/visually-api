import express from 'express';
import controller from '../controllers/generateVideo';

const router = express.Router();

router.post('/videos/generate', controller.generateVideo);

export = router;
