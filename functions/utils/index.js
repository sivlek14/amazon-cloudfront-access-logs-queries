export const formattedRecords = record => {
    const [unit, data] = record.split('","');
    const unitNumber = parseFloat(unit.slice(1));

    return [unitNumber, data.slice(0, -1)];
};


export const formatRecords = record => {
    const [count, userId, ipList, hostHeaderList] = record.split('","');

    return [parseInt(count.slice(1)), userId, ipList.split(','), hostHeaderList.slice(0, -1).split(',')];
}


export const streamToString = stream =>
    new Promise((resolve, reject) => {
        const chunks = [];

        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(chunks.join('')));
    });

export const getPreviousDay = (date = new Date()) => {
    const previous = new Date(date.getTime());
    previous.setDate(date.getDate() - 1);

    return previous;
}

export const getQueryFormattedDate = () => {
    const previousDate = getPreviousDay();
    const year = previousDate.getUTCFullYear();
    const month = (previousDate.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = previousDate.getUTCDate().toString().padStart(2, '0');

    return { year, month, day };
};
