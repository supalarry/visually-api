import S3, { ManagedUpload, DeleteObjectOutput } from 'aws-sdk/clients/s3';
import fs from 'fs';
import logging from '../config/logging';

const NAMESPACE = 'AWS';

const bucketName = process.env.AWS_BUCKET_NAME!;
const region = process.env.AWS_BUCKET_REGION!;
const accessKeyId = process.env.AWS_ACCESS_KEY!;
const secretAccessKey = process.env.AWS_SECRET_KEY!;

const s3 = new S3({
    region,
    accessKeyId,
    secretAccessKey
});

function uploadFile(file: Express.Multer.File): Promise<ManagedUpload.SendData> {
    const fileStream = fs.createReadStream(file.path);

    const uploadParams = {
        Bucket: bucketName,
        Body: fileStream,
        Key: file.filename
    };

    logging.info(NAMESPACE, 'Starting file upload to s3...');
    // return s3.upload(uploadParams).promise();
    return new Promise((resolve, reject) => {
        s3.upload(uploadParams, (err: Error, data: ManagedUpload.SendData) => {
            if (err) {
                reject(err);
            }
            logging.info(NAMESPACE, 'Successfully uploaded file to s3: ', data);
            resolve(data);
        });
    });
}

async function deleteFile(Key: string) {
    const deleteParams = {
        Bucket: bucketName,
        Key
    };
    logging.info(NAMESPACE, 'Deleting file from s3...');
    // return s3.deleteObject(deleteParams).promise();
    return new Promise((resolve, reject) => {
        s3.deleteObject(deleteParams, (err: Error, data: DeleteObjectOutput) => {
            if (err) {
                reject(err);
            }
            logging.info(NAMESPACE, 'Successfully deleted file from s3');
            resolve(data);
        });
    });
}

export { uploadFile, deleteFile };
