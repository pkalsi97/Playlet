import {
    ObjectService
} from '../utils/object-service'

interface S3EventRecord {
    eventVersion: string;
    eventSource: string;
    awsRegion: string;
    eventTime: string;
    eventName: string;
    userIdentity: {
        principalId: string;
    };
    requestParameters: {
        sourceIPAddress: string;
    };
    responseElements: {
        'x-amz-request-id': string;
        'x-amz-id-2': string;
    };
    s3: {
        s3SchemaVersion: string;
        configurationId: string;
        bucket: {
            name: string;
            ownerIdentity: {
                principalId: string;
            };
            arn: string;
        };
        object: {
            key: string;
            size: number;
            eTag: string;
            sequencer: string;
        };
    };
}

interface S3Event {
    Records: S3EventRecord[];
}
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

const objectService = new ObjectService(process.env.AWS_DEFAULT_REGION!,process.env.TRANSPORTSTORAGE_BUCKET_NAME!);




export const preprocessingHandler = async(messages: SQSEvent): Promise<any> => {
    try {
        for (const message of messages.Records){
            const s3Event: S3Event = JSON.parse(message.body);

            for (const event of s3Event.Records){

            };
        };
        return {
            statusCode: 200,
            body: 'Successfully logged events'
        };
        
    } catch (error) {
        console.error('Error processing event:', error);
        throw error;
    }
};

// init -> preprocessing status object (client will use to get status)
// do the steps and once complete -> move to next or move the message into DQL
// framework to determine if  retries can be done or not 

// step one -> get object -> write to temp
// basic validation
// stream validation
// meta data extraction
// gop creation
// dag creation

