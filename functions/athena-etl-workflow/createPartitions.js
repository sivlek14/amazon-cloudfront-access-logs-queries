// Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { runQuery } from '../utils/athena.js';

// AWS Glue Data Catalog database and table
const { TABLE, DATABASE } = process.env;

// creates partitions for the hour after the current hour
export const handler = async () => {
  const nextHour = new Date(Date.now() + 60 * 60 * 1000);
  const year = nextHour.getUTCFullYear();
  const month = (nextHour.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = nextHour.getUTCDate().toString().padStart(2, '0');
  const hour = nextHour.getUTCHours().toString().padStart(2, '0');
  const createPartitionStatement = `
    ALTER TABLE \`${DATABASE}\`.\`${TABLE}\`
    ADD IF NOT EXISTS
    PARTITION (
        year = '${year}',
        month = '${month}',
        day = '${day}',
        hour = '${hour}' );`;

  await runQuery(createPartitionStatement);
}
