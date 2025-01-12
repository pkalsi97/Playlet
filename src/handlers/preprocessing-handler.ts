interface SQSRecord {
    messageId: string;
    receiptHandle: string;
    body: string;
    attributes: {
        ApproximateReceiveCount: string;
        SentTimestamp: string;
        SenderId: string;
        ApproximateFirstReceiveTimestamp: string;
    };
    messageAttributes: Record<string, any>;
    md5OfBody: string;
    eventSource: string;
    eventSourceARN: string;
    awsRegion: string;
}

interface SQSEvent {
    Records: SQSRecord[];
}

export const preprocessingHandler = async(event: SQSEvent): Promise<any> => {
    try {
        console.warn('Received event:', JSON.stringify(event, null, 2));

        for (const record of event.Records) {
            const s3Event = JSON.parse(record.body);
            console.log(s3Event);
        }

        return {
            statusCode: 200,
            body: 'Successfully logged events'
        };
        
    } catch (error) {
        console.error('Error processing event:', error);
        throw error;
    }
};