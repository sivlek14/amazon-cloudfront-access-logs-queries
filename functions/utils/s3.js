import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { streamToString } from './index.js';

const s3 = new S3Client({ apiVersion: '2006-03-01' });

export const getQueryResultFromS3Location = async queryResultS3Location => {
    const s3LocationURI = new URL(queryResultS3Location);
    const s3ObjectParams = {
        Bucket: s3LocationURI.host,
        Key: s3LocationURI.pathname.slice(1),
    };
    const getObjectCommand = new GetObjectCommand(s3ObjectParams);
    const queryResult = await s3.send(getObjectCommand);
    const resultBody = await streamToString(queryResult?.Body);

    return resultBody?.trim()?.split('\n')?.slice(1);
};
