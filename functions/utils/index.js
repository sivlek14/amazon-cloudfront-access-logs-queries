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
