
import { runQuery } from '../utils/athena.js';
import { formattedRecords, yesterdayFormattedDate, getQueryFormattedDate } from '../utils/index.js';
import { getQueryResultFromS3Location } from '../utils/s3.js';
import { sendMessageToOVPChannelSecurityAlerts } from '../utils/slack.js';

const { DATABASE, NAME_TABLE_VIEW, WAF_REFERRER_BLOCK_LIST } = process.env;

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
                COUNT(referrer) as count_referrer, url_decode(referrer)
            FROM
                "${DATABASE}"."${NAME_TABLE_VIEW}"
            WHERE
                status < 400
                AND year = '${year}'
                AND month = '${month}'
                AND day = '${day}'
                AND referrer <> '-'
            GROUP BY
                referrer
            ORDER BY
                referrer DESC;
        `;

        const queryResultS3Location = await runQuery(ctasStatement, true);
        const records = await getQueryResultFromS3Location(queryResultS3Location);
        const formattedAllRecords = records.map(formattedRecords);
        const unknownReferrerListAttachment = {
            text: '',
            color: '#FF3200',
        };

        const allowedDomains = [
            'fanatiz.com',
            'brasileiraoplay.com',
            'afaplay.com',
            'gstatic.com',
            'apple.com',
            'nunchee.tv',
            'nunchee.com',
            'cdomas.cl',
            'atafootball.com',
            'bblplayer.co.uk',
            'liga1play.com',
          ];

        const regExpAllowedDomains = new RegExp(allowedDomains.join('|'));

        formattedAllRecords.forEach(([ _, referrer ]) => {
            if (!regExpAllowedDomains.test(referrer)) {
                unknownReferrerListAttachment.text += `*Referrer:* ${referrer}\n`;

            }
        });


        if (!unknownReferrerListAttachment.text) {
            return;
        }

        const slackBodyMessage = {
            text: `Unknown Referrer ${year}-${month}-${day}`,
            attachments: [
                {
                    text: `Please, check each Referrer listed and block if necessary in <${WAF_REFERRER_BLOCK_LIST}|WAF rule> after review and detect bad behavior`,
                    color: '#FFD700'
                },
                unknownReferrerListAttachment,
            ],
        };

        await sendMessageToOVPChannelSecurityAlerts(slackBodyMessage);
    } catch (error) {
        console.error('🚀 ~ file: referrerHeaderUnknown.js ~ line 73 ~ handler ~ error', error);
    }
};
