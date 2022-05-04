import { runQuery } from '../utils/athena.js';

const { SOURCE_TABLE, TARGET_TABLE, DATABASE } = process.env;

export const handler = async () => {
  const partitionHour = new Date(Date.now() - 120 * 60 * 1000);
  const year = partitionHour.getUTCFullYear();
  const month = (partitionHour.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = partitionHour.getUTCDate().toString().padStart(2, '0');
  const hour = partitionHour.getUTCHours().toString().padStart(2, '0');
  const ctasStatement = `
    INSERT INTO "${DATABASE}"."${TARGET_TABLE}"
    SELECT *
    FROM "${DATABASE}"."${SOURCE_TABLE}"
    WHERE year = '${year}'
        AND month = '${month}'
        AND day = '${day}'
        AND hour = '${hour}';`;

  await runQuery(ctasStatement);
};
