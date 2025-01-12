import { ListBucketInventoryConfigurationsOutputFilterSensitiveLog } from '@aws-sdk/client-s3';
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

const objectServiceFunc = async(key:string):Promise<string> =>{
    const object = await objectService.getObject(key);

    const path = await objectService.writeToTemp(object,key);

    const deleteFirstObject = await objectService.deleteObject(key);

    const temp = await objectService.getFromTemp(path);

    const newKey = `${key}-test`;

    const uploadStream = await objectService.uploadObject(temp,newKey);

    const clearUp = await objectService.cleanUpFromTemp(path);
    
    return `${path}-${deleteFirstObject}-${uploadStream}-${clearUp}`;
}

export const preprocessingHandler = async(messages: SQSEvent): Promise<any> => {
    try {
        for (const message of messages.Records){
            const s3Event: S3Event = JSON.parse(message.body);

            for (const event of s3Event.Records){
                const response = await objectServiceFunc(event.s3.object.key);
                console.warn(response);
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