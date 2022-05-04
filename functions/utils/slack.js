import fetch from 'node-fetch';

const { SLACK_WEBHOOK_URL } = process.env

export const sendMessageToOVPChannelSecurityAlerts = async messageBody => {
    const body = {
        channel: 'fz-ovp-security-alerts',
        as_user: false,
        icon_emoji: ':male-detective:',
        username: 'OVP Bot',
        ...messageBody,
    };

    await slackWebhookRequest(body);
};

export const slackWebhookRequest = async body => {
    const options = {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' }
    };

    try {
        const response = await fetch(SLACK_WEBHOOK_URL, options);
        const jsonResponse = await response.json();

        if (response.status !== 200) {
            throw new Error(jsonResponse.error);
        }

        return true;
    } catch (error) {
        console.error(error);

        return false;
    }
};
