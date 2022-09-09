
import { runQuery } from '../utils/athena.js';
import { formattedRecords, yesterdayFormattedDate, getQueryFormattedDate } from '../utils/index.js';
import { getQueryResultFromS3Location } from '../utils/s3.js';
import { sendMessageToOVPChannelSecurityAlerts } from '../utils/slack.js';

const { DATABASE, NAME_TABLE_VIEW, WAF_IP_LIST } = process.env;

export const handler = async event => {
    let year, month, day;

    if (event?.fromDate) {
        const dateFromEvent = new Date(event?.fromDate);

        ({ year, month, day } = getQueryFormattedDate(dateFromEvent));
    } else {
        ({ year, month, day } = yesterdayFormattedDate());
    }

    try {
        const ctasStatement = `
            SELECT
                SUM("bytes")/1000000000.00 as sumGB,
                request_ip
            FROM
                "${DATABASE}"."${NAME_TABLE_VIEW}"
            WHERE
                status < 400
                AND year = '${year}'
                AND month = '${month}'
                AND day = '${day}'
            GROUP BY
                request_ip
            ORDER BY
                sumGB DESC
            LIMIT 100;
        `;
        const queryResultS3Location = await runQuery(ctasStatement, true);
        const records = await getQueryResultFromS3Location(queryResultS3Location);
        const topTen = records.slice(0, 10);
        const resRecords = records.slice(10);
        const formattedResRecords = resRecords.map(formattedRecords);
        const lenResRecords = formattedResRecords.length;
        const sumResRecordsGB = formattedResRecords.reduce((acc, curr) => acc + curr[0], 0);
        const avgResRecordsGB = sumResRecordsGB / lenResRecords;
        const formattedTopTen = topTen.map(formattedRecords);
        const topTenListAttachment = {
            text: '',
            color: '#FF3200',
        };

        formattedTopTen.forEach(([sumGB, requestIP]) => {
            const percentOverUsage = parseInt((sumGB * 100 / avgResRecordsGB) - 100);

            topTenListAttachment.text += `IP <https://ip-api.com/#${requestIP}|${requestIP}> has used *${sumGB.toFixed(2)} GB* which represents a *${percentOverUsage}%* over the AVG\n`;
        });


        const slackBodyMessage = {
            text: `Top 10 Consumer IP Address from ${year}-${month}-${day}`,
            attachments: [
                {
                    text: `AVG consumed is *${avgResRecordsGB.toFixed(2)} GB*`,
                    color: '#00FF00'
                },
                {
                    text: `Please, check each IP addresses listed and block if necessary in <${WAF_IP_LIST}|WAF rule> after review and detect bad behavior`,
                    color: '#FFD700'
                },
                topTenListAttachment,
            ],
        };

        await sendMessageToOVPChannelSecurityAlerts(slackBodyMessage);
    } catch (error) {
        console.error('🚀 ~ file: topUsageByIp.js ~ line 78 ~ handler ~ error', error);
    }
};
