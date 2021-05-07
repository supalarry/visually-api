import multer from 'multer';

const REQUEST_FILE_KEY = 'video';
const DESTINATION_FOLDER = 'uploads/';

// Tell where to store the file & with what name
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, DESTINATION_FOLDER);
    },
    filename: (req, file, cb) => {
        cb(null, `${new Date().toISOString()}-${file.originalname}`);
    }
});

// Filter out unwanted files
const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = ['audio/mpeg'];

    if (!allowedTypes.includes(file.mimetype)) {
        return cb(null, false);
    }
    cb(null, true);
};

// Create object allowing to create middlewares
const upload = multer({
    storage,
    fileFilter
});

export { upload, REQUEST_FILE_KEY };
