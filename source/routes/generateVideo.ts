import express from 'express';
import controller from '../controllers/generateVideo';

const router = express.Router();

router.get('/videos/generate', controller.generateVideo);

export = router;
