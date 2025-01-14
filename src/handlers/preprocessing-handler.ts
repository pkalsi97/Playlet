import ffmpeg from 'fluent-ffmpeg';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

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

if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
    ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH || '/opt/ffmpeg/ffmpeg');
    ffmpeg.setFfprobePath(process.env.FFPROBE_PATH || '/opt/ffprobe/ffprobe');
}


const execAsync = promisify(exec);  

const contentValidationService = new ContentValidationService(parseInt(process.env.UPLOAD_TIME_LIMIT!,10));
const metadataExtractor = new MetadataExtractor();
const objectService = new ObjectService(process.env.AWS_DEFAULT_REGION!,process.env.TRANSPORTSTORAGE_BUCKET_NAME!);

const gopConfig:GopConfig = {
    keyframeInterval:2,
    forceClosedGop:true,
    sceneChangeDetection:true,
    outputDir:'/tmp/gops',
    frameRate:30,
};

const gopCreator = new GopCreator(gopConfig);

const initSourceContentFunc = async(key:string):Promise<string> => {

    const object = await objectService.getObject(key);
    if (!object){
        throw new ObjectServiceError("Unable to get object from Object Storage",503,Fault.SERVER,true);
    }

    const path = await objectService.writeToTemp(object);
    if (!path) {
        throw new ObjectServiceError("Unable to store object in tmp",503,Fault.SERVER,true);
    }

    return path;
};

export const preprocessingHandler = async(messages: SQSEvent): Promise<any> => {

    try{
        for (const message of messages.Records){
            const s3Events:S3Event = JSON.parse(message.body);

            for (const event of s3Events.Records){

                const key: string = event.s3.object.key;
                const filePath: string = await initSourceContentFunc(key);
                console.warn(filePath);

                const basicValidationResult: BasicValidationResult = await contentValidationService.validateBasics(filePath);
                console.warn(basicValidationResult);
                if(!basicValidationResult.isValid){
                    throw new TranscodingServiceError("Invalid Content Provided",422,Fault.CLIENT,true);
                }

                const streamValidationResult: StreamValidationResult = await contentValidationService.validateStreams(filePath);
                console.warn(streamValidationResult);
                if (!streamValidationResult.isPlayable || !streamValidationResult.hasAudioStream || streamValidationResult.error) {
                    throw new TranscodingServiceError("Stream Validation Failed",422,Fault.CLIENT,true);
                }

                const technicalMetadata: TechnicalMetadata = await metadataExtractor.extractTechnicalMetadata(filePath);
                console.warn(technicalMetadata);
                const qualityMetrics: QualityMetrics = await metadataExtractor.extractQualityMetrics(filePath);
                console.warn(qualityMetrics);
                const contentMetadata: ContentMetadata = await metadataExtractor.extractContentMetadata(filePath);
                console.warn(contentMetadata);


                const gopCreationResponse : GopResult = await gopCreator.createGopSegments(filePath);
                console.warn(gopCreationResponse);

                for (const segment of gopCreationResponse.segments){
                    const stream = await objectService.getFromTemp(segment.path);
                    const gopKey: string = `${key}/gops/${segment.sequence}`; 
                    const uploadResult = await objectService.uploadObject(stream,gopKey);
                }
            }
        }

        return{
            statusCode:200,
            message: "Success",
        }

    } catch(error){
        console.warn(error);
        return {
            statusCode:503,
            message: "Failure",
        }
    }
};