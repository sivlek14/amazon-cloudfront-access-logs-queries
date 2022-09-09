import UAParser from 'ua-parser-js';
import { getQueryResultFromS3Location } from '../utils/s3.js';
import { formattedRecords, yesterdayFormattedDate, getQueryFormattedDate } from '../utils/index.js';
import { runQuery } from '../utils/athena.js';
import { sendMessageToOVPChannelSecurityAlerts } from '../utils/slack.js';

const { DATABASE, NAME_TABLE_VIEW, WAF_UA_BLOCK_LIST } = process.env;

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
                COUNT(user_agent) as count_user_agent, url_decode(user_agent)
            FROM
                "${DATABASE}"."${NAME_TABLE_VIEW}"
            WHERE
                status < 400
                AND year = '${year}'
                AND month = '${month}'
                AND day = '${day}'
                AND user_agent <> '-'
            GROUP BY
                user_agent
            ORDER BY
                user_agent DESC;
        `;

        const queryResultS3Location = await runQuery(ctasStatement, true);
        const records = await getQueryResultFromS3Location(queryResultS3Location);
        const formattedAllRecords = records.map(formattedRecords);
        const unknownUserAgentListAttachment = {
            text: '',
            color: '#FF3200',
        };

        formattedAllRecords.forEach(([ _, userAgent ]) => {
            const userAgentParser = new UAParser(userAgent);
            const { vendor } = userAgentParser.getDevice();
            const { name } = userAgentParser.getOS();

            if (!vendor && !name && !/AirPlay\//.test(userAgent)) {
                unknownUserAgentListAttachment.text += `*User Agent:* ${userAgent}\n`;
            }
        });


        const slackBodyMessage = {
            text: `Unknown UserAgent ${year}-${month}-${day}`,
            attachments: [
                {
                    text: `Please, check each UserAgent listed and block if necessary in <${WAF_UA_BLOCK_LIST}|WAF rule> after review and detect bad behavior`,
                    color: '#FFD700'
                },
                unknownUserAgentListAttachment,
            ],
        };

        await sendMessageToOVPChannelSecurityAlerts(slackBodyMessage);
    } catch (error) {
        console.error('🚀 ~ file: userAgentHeaderUnknown.js ~ line 72 ~ handler ~ error', error);
    }
};
