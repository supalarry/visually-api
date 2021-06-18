import express from 'express';
import { addUserToWaitingList } from '../controllers/user';

const router = express.Router();

router.post('/users/waitinglist', addUserToWaitingList);

export = router;
