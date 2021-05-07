import multer from 'multer';
import logging from '../config/logging';

const NAMESPACE = 'Multer';
enum LoggingMessages {
    INVALID_FILE_TYPE = 'Invalid file type'
}

const REQUEST_FILE_KEY = 'video';
const DESTINATION_FOLDER = 'uploads/';

// Tell where to store the file & with what name
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, DESTINATION_FOLDER);
        logging.info(NAMESPACE, `Audio destination folder: ${DESTINATION_FOLDER}`);
    },
    filename: (req, file, cb) => {
        cb(null, `${new Date().toISOString()}-${file.originalname}`);
        logging.info(NAMESPACE, `Audio name: ${new Date().toISOString()}-${file.originalname}`);
    }
});

// Filter out unwanted files
const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = ['audio/mpeg'];

    if (!allowedTypes.includes(file.mimetype)) {
        logging.error(NAMESPACE, LoggingMessages.INVALID_FILE_TYPE);
        cb(null, false);
    }
    cb(null, true);
};

// Create object allowing to create middlewares
const upload = multer({
    storage,
    fileFilter
});

export { upload, REQUEST_FILE_KEY };
