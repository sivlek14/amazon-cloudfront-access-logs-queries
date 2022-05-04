import { runQuery } from '../utils/athena.js';
import { formatRecords } from '../utils/index.js';
import { getQueryResultFromS3Location } from '../utils/s3.js';
import { sendMessageToOVPChannelSecurityAlerts } from '../utils/slack.js';

const { DATABASE, NAME_TABLE_VIEW, WAF_IP_LIST } = process.env;

export const handler = async () => {
    try {
        const currentDate = new Date();
        const year = currentDate.getUTCFullYear();
        const month = (currentDate.getUTCMonth() + 1).toString().padStart(2, '0');
        const day = (currentDate.getUTCDate() - 1).toString().padStart(2, '0');
        const ctasStatement = `
            SELECT
                COUNT(request_ip) as countRequest,
                SPLIT_PART(from_utf8(from_base64(url_decode(SPLIT_PART(SPLIT_PART(query_string, '&', 2), '=', 2)))), '/',1) as userId, array_join(array_agg(DISTINCT request_ip),','), array_join(array_agg(DISTINCT host_header),',')
            FROM
                "${DATABASE}"."${NAME_TABLE_VIEW}"
            WHERE
                year = '${year}'
                AND month = '${month}'
                AND day = '${day}'
                AND uri like '%.m3u8'
                AND try(from_base64(url_decode(SPLIT_PART(SPLIT_PART(query_string, '&', 2), '=', 2)))) is not null
                AND status < 400
            GROUP BY
                SPLIT_PART(from_utf8(from_base64(url_decode(SPLIT_PART(SPLIT_PART(query_string, '&', 2), '=', 2)))), '/', 1)
            ORDER BY
                countRequest DESC
            LIMIT 100;
        `;

        const queryResultS3Location = await runQuery(ctasStatement, true);
        const records = await getQueryResultFromS3Location(queryResultS3Location);
        const topTen = records.slice(0, 10);
        const resRecords = records.slice(10);
        const formattedResRecords = resRecords.map(formatRecords);
        const lenResRecords = formattedResRecords.length;
        const sumResRecordsCount = formattedResRecords.reduce((acc, curr) => acc + curr[0], 0);
        const avgResRecordsCount = parseInt(sumResRecordsCount / lenResRecords);
        const formattedTopTen = topTen.map(formatRecords);
        const attachments = [];

        formattedTopTen.forEach(([ countRequest, userId, ipAddressList, hostHeaderList ]) => {
            const percentOverUsage = parseInt((countRequest * 100 / avgResRecordsCount) - 100);

            const formattedUserId = userId.split(':')[1];
            let ipAddressListAttachment = '';

            ipAddressList.forEach(ipAddress => {
                ipAddressListAttachment += `-  *<https://ip-api.com/#${ipAddress}|${ipAddress}>*\n`;
            });

            attachments.push({
                text: `*User:* <https://production-centralized-api-logs.kb.us-east-1.aws.found.io:9243/app/discover#/?_g=(filters:!(),refreshInterval:(pause:!t,value:0),time:(from:now-2d%2Fd,to:now))&_a=(columns:!(log.request.clientIp,log.request.uri,User.username,Device.platform),filters:!(),index:'1a9a6c90-f92b-11eb-9e6b-65f50eae6fb0',interval:auto,query:(language:kuery,query:'User.id%20:%20%22${formattedUserId}%22'),sort:!(!('@timestamp',desc)))|${formattedUserId}> has *${percentOverUsage}%* over the AVG usage\nThis user use the following IP List:\n${ipAddressListAttachment}\n`,
                color: '#FF3200',
            });

        });


        const slackBodyMessage = {
            text: `Top 10 Consumer Users yesterday ${year}-${month}-${day}`,
            attachments: [
                {
                    text: `AVG Request is *${avgResRecordsCount}*`,
                    color: '#00FF00'
                },
                ...attachments,
                {
                    text: `Please, check each IP addresses listed and block if necessary in <${WAF_IP_LIST}|WAF rule> after review and detect bad behavior`,
                    color: '#FFD700'
                },
            ],
        };

        await sendMessageToOVPChannelSecurityAlerts(slackBodyMessage);
        console.log('🚀 ~ file: topUsageByUserId.js ~ line 80 ~ handler ~ slackBodyMessage', slackBodyMessage);
    } catch (error) {
        console.error('🚀 ~ file: topUsageByUserId.js ~ line 90 ~ handler ~ error', error);
    }
};
