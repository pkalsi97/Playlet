import {
    ObjectService
} from '../utils/object-service';

import {
    MetadataExtractor,
    ContentMetadata,
    TechnicalMetadata,
    QualityMetrics,
} from '../utils/transcoding-services/content-metadata-service';

import {
    BasicValidationResult,
    StreamValidationResult,
    ContentValidationService
} from '../utils/transcoding-services/content-validation-service';

import {
    GopCreator,
    GopConfig,
    GopResult,
    GopSegment,
} from '../utils/transcoding-services/gop-creation-service';

import {
    ObjectServiceError,
    TranscodingServiceError,
    InternalServerError,
    exceptionHandlerFunction,
    Fault
} from '../utils/error-handling'

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
const contentValidationService = new ContentValidationService(parseInt(process.env.UPLOAD_SIZE_LIMIT!,10));
const metadataExtractor = new MetadataExtractor();

const gopConfig:GopConfig = {
    keyframeInterval:2,
    forceClosedGop:true,
    sceneChangeDetection:false,
    outputDir:'tmp/gops',
};

const gopCreation = new GopCreator(gopConfig);

const initializeObject = async(key:string):Promise<string> =>{
    
    const object = await objectService.getObject(key);
    if (!object) {
        throw new ObjectServiceError("Unable to get object from Object Storage",503,Fault.SERVER,true);
    }

    const path = await objectService.writeToTemp(object,key);
    if (!path) {
        throw new ObjectServiceError("Unable to Write to tmp",503,Fault.SERVER,true);
    }

    return path;
};


export const preprocessingHandler = async(messages: SQSEvent): Promise<any> => {
    try {
        for (const message of messages.Records){
            const s3Event: S3Event = JSON.parse(message.body);

            for (const event of s3Event.Records){

                const path = await initializeObject(event.s3.object.key);
                const basicValidationResult : BasicValidationResult = await contentValidationService.validateBasics(path);
                console.warn(basicValidationResult)
                if(!basicValidationResult.isValid){
                    throw new TranscodingServiceError("Basic Validation Failure",400,Fault.CLIENT,true);
                }

                const streamValidationResult : StreamValidationResult = await contentValidationService.validateStreams(path);
                console.warn(streamValidationResult)
                const contentMetadata: ContentMetadata = await metadataExtractor.extractContentMetadata(path);
                console.warn(contentMetadata)
                const technicalMetadata: TechnicalMetadata = await metadataExtractor.extractTechnicalMetadata(path);
                console.warn(technicalMetadata)
                const qualityMetrics: QualityMetrics = await metadataExtractor.extractQualityMetrics(path);
                console.warn(qualityMetrics)

                const gop:GopResult = await gopCreation.createGopSegments(path);
            
                for (const segment of gop.segments){
                    const stream = await objectService.getFromTemp(segment.path);
                    const gopKey = `${event.s3.object.key}/${segment.path}`
                    const upload = await objectService.uploadObject(stream,gopKey);
                }
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

// Process record for DB
// get object from s3
// validation
// metadata extraction
// gop creation
// upload gops
// output for DAG

// -> Storage
    // Original Gops & Video metadata
    // Transcoded Gops & meta data

// user/video/originalGops
// user/video/transcoding/


// interface VideoMetadata {
//     // Original Video Metadata
//     original: {
//         duration: number;
//         size: number;
//         resolution: {
//             width: number;
//             height: number;
//         };
//         codec: string;
//         bitrate: number;
//         frameRate: number;
//     };

//     // GOP Information
//     gops: {
//         count: number;
//         duration: number;  // per GOP
//         paths: string[];
//         createdAt: string;
//     };

//     // Transcoding Information
//     transcoding: {
//         qualities: {
//             '360p': {
//                 resolution: { width: number; height: number; };
//                 bitrate: number;
//                 size: number;
//             };
//             '480p': { /* same structure */ };
//             '720p': { /* same structure */ };
//             '1080p': { /* same structure */ };
//         };
//         audio: {
//             codec: string;
//             bitrate: number;
//             sampleRate: number;
//         };
//     };

//     // Processing Status
//     status: {
//         gopCreation: 'pending' | 'completed' | 'failed';
//         transcoding: 'pending' | 'completed' | 'failed';
//         availableQualities: string[];
//         lastUpdated: string;
//     };

//     // Streaming Information
//     streaming: {
//         masterPlaylistUrl: string;
//         qualityPlaylistUrls: {
//             [quality: string]: string;
//         };
//         audioPlaylistUrl: string;
//     };

//     // System Information
//     system: {
//         userId: string;
//         videoId: string;
//         createdAt: string;
//         updatedAt: string;
//         processingTime: number;
//         storageUsed: number;
//     };
// }