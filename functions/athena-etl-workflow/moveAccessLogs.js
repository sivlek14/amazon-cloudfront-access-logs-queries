import { S3Client, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({ apiVersion: '2006-03-01' });
const { TARGET_KEY_PREFIX } = process.env;
const datePattern = '[^\\d](\\d{4})-(\\d{2})-(\\d{2})-(\\d{2})[^\\d]';
const filenamePattern = '[^/]+$';

export const handler = async (event, _context, callback) => {
  const moves = event.Records.map(record => {
    const bucket = record.s3.bucket.name;
    const sourceKey = record.s3.object.key;

    const sourceRegex = new RegExp(datePattern, 'g');
    const match = sourceRegex.exec(sourceKey);

    if (match == null) {
      console.log(`Object key ${sourceKey} does not look like an access log file, so it will not be moved.`);
    } else {
      const [, year, month, day, hour] = match;
      const filenameRegex = new RegExp(filenamePattern, 'g');
      const filename = filenameRegex.exec(sourceKey)[0];
      const targetKey = `${TARGET_KEY_PREFIX}year=${year}/month=${month}/day=${day}/hour=${hour}/${filename}`;

      const copyParams = {
        CopySource: bucket + '/' + sourceKey,
        Bucket: bucket,
        Key: targetKey
      };
      const copyObjectCommand = new CopyObjectCommand(copyParams);
      const copy = s3.send(copyObjectCommand);
      const deleteParams = { Bucket: bucket, Key: sourceKey };

      return copy.then(() => {
        const deleteObjectCommand = new DeleteObjectCommand(deleteParams);

        const del = s3.send(deleteObjectCommand);

        return del;
      }, reason => {
        const error = new Error(`Error while copying ${sourceKey}: ${reason}`);

        callback(error);
      });
    }
  });
  await Promise.all(moves);
};
